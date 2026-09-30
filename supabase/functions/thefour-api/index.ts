// Source for the deployed Supabase Edge Function: thefour-api

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });

const config = () => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
};

const rest = async (path: string, init: RequestInit = {}) => {
  const c = config();
  if (!c) throw new Error("Supabase environment is not configured.");
  return fetch(c.url + "/rest/v1" + path, {
    ...init,
    headers: {
      apikey: c.key,
      Authorization: "Bearer " + c.key,
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
};

const storageFetch = async (path: string, init: RequestInit = {}) => {
  const c = config();
  if (!c) throw new Error("Supabase environment is not configured.");
  return fetch(c.url + "/storage/v1" + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + c.key,
      apikey: c.key,
      ...(init.headers || {})
    }
  });
};

const findSquad = async (code: string) => {
  const r = await rest(
    "/four_squads?code=eq." +
      encodeURIComponent(String(code).trim().toUpperCase()) +
      "&select=id,code,status,preferred_cinema,preferred_date,preferred_showtime,artwork_url,created_at"
  );
  if (!r.ok) return null;
  const rows = await r.json();
  return rows[0] || null;
};

const signObject = async (bucket: string, path: string, expiresIn = 86400) => {
  const r = await storageFetch(
    "/object/sign/" + encodeURIComponent(bucket) + "/" + path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn })
    }
  );
  if (!r.ok) return null;
  const data = await r.json();
  const c = config();
  if (!c || !data.signedURL) return null;
  return c.url + "/storage/v1" + data.signedURL;
};

const logEvent = async (
  code: string | undefined,
  eventType: string,
  channel: string,
  metadata: Record<string, unknown> = {}
) => {
  try {
    const squad = code ? await findSquad(String(code)) : null;
    await rest("/campaign_events", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        squad_id: squad?.id || null,
        event_type: eventType,
        channel,
        metadata
      })
    });
  } catch {
    // Analytics failures must never block the campaign journey.
  }
};

async function handleFours(request: Request) {
  if (request.method === "GET") {
    const code = new URL(request.url).searchParams.get("code");
    if (!code) return json({ error: "Four code is required." }, 400);

    const squad = await findSquad(code);
    if (!squad) return json({ error: "Four not found." }, 404);

    const membersResponse = await rest(
      "/four_members?squad_id=eq." +
        encodeURIComponent(squad.id) +
        "&select=member_number,name,phone,joined_at,photo_url&order=member_number.asc"
    );
    const shareResponse = await rest(
      "/four_member_shares?squad_id=eq." +
        encodeURIComponent(squad.id) +
        "&select=member_id,member_number,channel,confirmed_at"
    );

    const members = membersResponse.ok ? await membersResponse.json() : [];
    const shares = shareResponse.ok ? await shareResponse.json() : [];
    const shareMap = new Map<string, { channel:string; confirmed_at:string }>();
    for (const share of shares) {
      shareMap.set(String(share.member_id), {
        channel: String(share.channel || ""),
        confirmed_at: String(share.confirmed_at || "")
      });
    }

    for (const member of members) {
      const share = shareMap.get(String(member.id));
      member.shared = Boolean(share);
      member.share_channel = share?.channel || null;
      member.share_confirmed_at = share?.confirmed_at || null;
      if (member.photo_url) {
        member.photo_url = await signObject("four-photos", member.photo_url);
      }
      delete member.phone;
      delete member.id;
    }

    if (squad.artwork_url) {
      squad.artwork_url = await signObject("four-photos", squad.artwork_url);
    }

    return json({ squad, members });
  }

  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const body = await request.json();
  if (!body.code || !body.name || !body.phone || !body.consent) {
    return json({ error: "Name, phone, Four code and consent are required." }, 400);
  }

  const code = String(body.code).trim().toUpperCase();
  const requestedMember = Number(body.memberNumber || 0);
  let squad = await findSquad(code);
  let squadId: string | undefined = squad?.id;
  let createdSquad = false;

  if (!squadId) {
    const create = await rest("/four_squads", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        code,
        creator_name: body.name.trim(),
        creator_phone: body.phone.trim(),
        creator_email: body.email?.trim() || null,
        consent: true,
        status: "registered",
        preferred_cinema: body.preferredCinema || null,
        preferred_date: body.preferredDate || null,
        preferred_showtime: body.preferredShowtime || null
      })
    });

    if (!create.ok) {
      squad = await findSquad(code);
      if (!squad) return json({ error: "Could not create the Four." }, 502);
      squadId = squad.id;
    } else {
      const rows = await create.json();
      squadId = rows[0]?.id;
      createdSquad = true;
    }
  }

  if (!squadId) return json({ error: "Could not create the Four." }, 502);

  const memberRpc = await rest("/rpc/claim_four_member", {
    method: "POST",
    body: JSON.stringify({
      p_squad_id: squadId,
      p_member_number: requestedMember >= 1 && requestedMember <= 4 ? requestedMember : null,
      p_name: body.name.trim(),
      p_phone: body.phone.trim(),
      p_email: body.email?.trim() || null,
      p_consent: true,
      p_public_activity_opt_in: Boolean(body.publicActivityOptIn)
    })
  });

  if (!memberRpc.ok) {
    const detail = await memberRpc.text().catch(() => "");
    if (detail.includes("That Four place is already claimed")) return json({ error: "That Four place is already claimed." }, 409);
    if (detail.includes("This Four is already complete")) return json({ error: "This Four is already complete." }, 409);
    return json({ error: "Could not save Four member." }, 502);
  }

  const memberRows = await memberRpc.json();
  const memberNumber = Number(memberRows[0]?.member_number);
  const memberId = String(memberRows[0]?.member_id || "");
  if (![1,2,3,4].includes(memberNumber) || !memberId) return json({ error: "Could not determine Four member." }, 502);

  if (body.preferredCinema) {
    const update = await rest(
      "/four_squads?id=eq." + encodeURIComponent(squadId),
      {
        method: "PATCH",
        body: JSON.stringify({
          preferred_cinema: body.preferredCinema,
          preferred_date: body.preferredDate || null,
          preferred_showtime: body.preferredShowtime || null
        })
      }
    );
    if (!update.ok) return json({ error: "Could not save cinema choice." }, 502);
  }

  await logEvent(
    code,
    body.preferredCinema ? "cinema_selected" : createdSquad ? "created" : "member_joined",
    "web",
    {
      consent: true,
      memberNumber,
      cinema: body.preferredCinema || null,
      showtime: body.preferredShowtime || null,
      publicActivityOptIn: Boolean(body.publicActivityOptIn)
    }
  );

  return json({ ok: true, code, squadId, memberNumber, memberId });
}

async function verifyMemberPhone(squadId: string, memberNumber: number, phone: string) {
  const r = await rest(
    "/four_members?squad_id=eq." +
      encodeURIComponent(squadId) +
      "&member_number=eq." +
      memberNumber +
      "&select=id,phone"
  );
  if (!r.ok) return false;
  const rows = await r.json();
  return Boolean(
    rows[0]?.id &&
      String(rows[0].phone || "").trim() === String(phone || "").trim()
  );
}

async function handleShareConfirmation(request: Request) {
  const body = await request.json();
  if (!body.code || !body.memberNumber || !body.phone || !body.channel) {
    return json({ error: "Four code, member number, phone and share channel are required." }, 400);
  }

  const code = String(body.code).trim().toUpperCase();
  const memberNumber = Number(body.memberNumber);
  const channel = String(body.channel).trim().toLowerCase();
  const allowed = new Set(["native_share","whatsapp","instagram","facebook","tiktok","other_self_confirmed"]);
  if (![1,2,3,4].includes(memberNumber)) return json({ error: "Invalid Four member." }, 400);
  if (!allowed.has(channel)) return json({ error: "Unsupported share channel." }, 400);

  const squad = await findSquad(code);
  if (!squad) return json({ error: "Four not found." }, 404);
  const memberResponse = await rest(
    "/four_members?squad_id=eq." + encodeURIComponent(squad.id) +
    "&member_number=eq." + memberNumber +
    "&select=id,phone,name"
  );
  if (!memberResponse.ok) return json({ error: "Could not verify Four member." }, 502);
  const members = await memberResponse.json();
  const member = members[0];
  if (!member || String(member.phone || "").trim() !== String(body.phone || "").trim()) {
    return json({ error: "That Four member could not be verified." }, 403);
  }

  const now = new Date().toISOString();
  const upsert = await rest("/four_member_shares?on_conflict=member_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      squad_id: squad.id,
      member_id: member.id,
      member_number: memberNumber,
      channel,
      confirmed_at: now
    })
  });
  if (!upsert.ok) return json({ error: "Could not record the share confirmation." }, 502);

  await logEvent(code, "shared", "web", {
    memberNumber,
    channel,
    shareConfirmed: true
  });

  const rpc = await rest("/rpc/issue_four_reward_card", {
    method: "POST",
    body: JSON.stringify({ p_squad_id: squad.id })
  });
  let cardIssued = false;
  let cardCode: string | null = null;
  if (rpc.ok) {
    const rows = await rpc.json();
    cardIssued = Boolean(rows[0]?.issued);
    cardCode = rows[0]?.card_code || null;
  }

  return json({
    ok: true,
    memberNumber,
    shareConfirmed: true,
    confirmedAt: now,
    cardIssued,
    rewardCard: memberNumber === 1 && cardIssued && cardCode ? { card_code: cardCode, issued_to: member.name } : null
  });
}

async function handlePublicActivity(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 12), 1), 30);
  const r = await rest(
    "/four_public_activity?select=name,member_number,joined_at,status,member_count&order=joined_at.desc&limit=" + limit
  );
  if (!r.ok) return json({ items: [] });
  const rows = await r.json();
  const items = rows.map((row: {
    name?: string|null;
    member_number?: number;
    joined_at?: string|null;
    status?: string|null;
    member_count?: number;
  }) => {
    const raw = String(row.name || "Someone").trim();
    const parts = raw.split(/\s+/).filter(Boolean);
    const displayName = parts.length > 1 ? parts[0] + " " + parts[1].charAt(0) + "." : (parts[0] || "Someone");
    return {
      display_name: displayName,
      member_number: Number(row.member_number || 1),
      joined_at: row.joined_at,
      member_count: Number(row.member_count || 1),
      status: row.status || "registered"
    };
  });
  return json({ items });
}

async function handleCreatorCard(request: Request) {
  const url = new URL(request.url);
  const code = String(url.searchParams.get("code") || "").trim().toUpperCase();
  const phone = String(url.searchParams.get("phone") || "").trim();
  if (!code || !phone) return json({ error: "Four code and creator phone are required." }, 400);
  const squad = await findSquad(code);
  if (!squad) return json({ error: "Four not found." }, 404);

  const creator = await rest(
    "/four_members?squad_id=eq." + encodeURIComponent(squad.id) +
    "&member_number=eq.1&select=id,name,phone"
  );
  if (!creator.ok) return json({ error: "Could not verify creator." }, 502);
  const creators = await creator.json();
  if (!creators[0] || String(creators[0].phone || "").trim() !== phone) {
    return json({ error: "Creator verification failed." }, 403);
  }

  const cardResponse = await rest(
    "/reward_cards?squad_id=eq." + encodeURIComponent(squad.id) +
    "&select=card_code,status,issued_at,claimed_at"
  );
  if (!cardResponse.ok) return json({ card: null });
  const cards = await cardResponse.json();
  if (!cards[0]) return json({ card: null, ready: false });

  const membersResponse = await rest(
    "/four_members?squad_id=eq." + encodeURIComponent(squad.id) +
    "&select=member_number,name&order=member_number.asc"
  );
  const members = membersResponse.ok ? await membersResponse.json() : [];
  return json({
    ready: true,
    card: {
      card_code: cards[0].card_code,
      status: cards[0].status,
      issued_at: cards[0].issued_at,
      claimed_at: cards[0].claimed_at,
      creator_name: creators[0].name,
      members
    }
  });
}

function adminTokenValid(request: Request) {
  const expected = Deno.env.get("ADMIN_DASHBOARD_TOKEN");
  return Boolean(expected && request.headers.get("x-admin-token") === expected);
}

async function handleAdminFour(request: Request) {
  if (!adminTokenValid(request)) return json({ error: "Unauthorized." }, 401);
  const code = String(new URL(request.url).searchParams.get("code") || "").trim().toUpperCase();
  if (!code) return json({ error: "Four code is required." }, 400);
  const squad = await findSquad(code);
  if (!squad) return json({ error: "Four not found." }, 404);

  const membersResponse = await rest(
    "/four_members?squad_id=eq." + encodeURIComponent(squad.id) +
    "&select=member_number,name,phone,email,joined_at,public_activity_opt_in&order=member_number.asc"
  );
  const shareResponse = await rest(
    "/four_member_shares?squad_id=eq." + encodeURIComponent(squad.id) +
    "&select=member_id,member_number,channel,confirmed_at"
  );
  const checkinResponse = await rest(
    "/four_checkins?squad_id=eq." + encodeURIComponent(squad.id) +
    "&select=member_number,checked_in_at,checked_in_by&order=member_number.asc"
  );
  const cardResponse = await rest(
    "/reward_cards?squad_id=eq." + encodeURIComponent(squad.id) +
    "&select=card_code,status,issued_at,claimed_at,claimed_by"
  );

  const members = membersResponse.ok ? await membersResponse.json() : [];
  const shares = shareResponse.ok ? await shareResponse.json() : [];
  const checkins = checkinResponse.ok ? await checkinResponse.json() : [];
  const cardRows = cardResponse.ok ? await cardResponse.json() : [];
  const shareMap = new Map<number,{channel:string;confirmed_at:string}>();
  for (const s of shares) shareMap.set(Number(s.member_number),{channel:String(s.channel||""),confirmed_at:String(s.confirmed_at||"")});
  return json({
    squad: {
      id: squad.id, code: squad.code, status: squad.status, created_at: squad.created_at,
      preferred_cinema: squad.preferred_cinema, preferred_date: squad.preferred_date, preferred_showtime: squad.preferred_showtime
    },
    members: members.map((m: Record<string,unknown>) => ({
      ...m,
      shared: shareMap.has(Number(m.member_number)),
      share_channel: shareMap.get(Number(m.member_number))?.channel || null,
      share_confirmed_at: shareMap.get(Number(m.member_number))?.confirmed_at || null,
      checked_in: checkins.some((x:{member_number:number})=>Number(x.member_number)===Number(m.member_number))
    })),
    reward_card: cardRows[0] || null
  });
}

async function handleClaimCard(request: Request) {
  if (!adminTokenValid(request)) return json({ error: "Unauthorized." }, 401);
  const body = await request.json();
  if (!body.cardCode || !Array.isArray(body.checkedMembers)) return json({ error: "Card code and checked members are required." }, 400);
  const r = await rest("/rpc/claim_four_reward_card", {
    method: "POST",
    body: JSON.stringify({
      p_card_code: String(body.cardCode).trim().toUpperCase(),
      p_checked_members: body.checkedMembers.map((n:unknown)=>Number(n)),
      p_claimed_by: String(body.claimedBy || "Venue").trim()
    })
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    return json({ error: detail || "Could not claim reward card." }, 409);
  }
  const rows = await r.json();
  return json(rows[0] || { claimed: false });
}

async function handlePhoto(request: Request) {
  const body = await request.json();
  if (!body.code || !body.memberNumber || !body.phone || !body.dataUrl) {
    return json({ error: "Four code, member number, phone and photo are required." }, 400);
  }

  const squad = await findSquad(String(body.code));
  if (!squad) return json({ error: "Four not found." }, 404);

  const memberNumber = Number(body.memberNumber);
  if (![1, 2, 3, 4].includes(memberNumber)) {
    return json({ error: "Invalid Four member." }, 400);
  }

  if (!await verifyMemberPhone(squad.id, memberNumber, body.phone)) {
    return json({ error: "That Four member could not be verified." }, 403);
  }

  const match = String(body.dataUrl).match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) return json({ error: "Unsupported image format." }, 415);

  const mime = match[1];
  const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
  if (bytes.byteLength > 5 * 1024 * 1024) return json({ error: "Photo is too large." }, 413);

  const extension = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const path = squad.id + "/member-" + memberNumber + "." + extension;

  const upload = await storageFetch("/object/four-photos/" + path, {
    method: "POST",
    headers: {
      "Content-Type": mime,
      "x-upsert": "true"
    },
    body: bytes
  });

  if (!upload.ok) return json({ error: "Could not store photo." }, 502);

  const update = await rest(
    "/four_members?squad_id=eq." +
      encodeURIComponent(squad.id) +
      "&member_number=" +
      memberNumber,
    {
      method: "PATCH",
      body: JSON.stringify({ photo_url: path })
    }
  );

  if (!update.ok) return json({ error: "Photo stored but could not link it to the Four." }, 502);

  await logEvent(String(body.code), "photo_uploaded", "web", { memberNumber });
  const signedUrl = await signObject("four-photos", path);

  return json({ ok: true, memberNumber, photo_url: signedUrl });
}

async function handleArtwork(request: Request) {
  const body = await request.json();
  if (!body.code || !body.phone || !body.dataUrl) {
    return json({ error: "Four code, phone and artwork are required." }, 400);
  }

  const squad = await findSquad(String(body.code));
  if (!squad) return json({ error: "Four not found." }, 404);

  const authorizedMembers = await rest(
    "/four_members?squad_id=eq." + encodeURIComponent(squad.id) + "&select=phone"
  );
  const members = authorizedMembers.ok ? await authorizedMembers.json() : [];
  const authorized = members.some(
    (m: { phone?: string | null }) =>
      String(m.phone || "").trim() === String(body.phone || "").trim()
  );
  if (!authorized) return json({ error: "You are not a member of this Four." }, 403);

  const match = String(body.dataUrl).match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
  if (!match) return json({ error: "Unsupported artwork format." }, 415);

  const mime =
    match[1] === "png"
      ? "image/png"
      : match[1] === "webp"
      ? "image/webp"
      : "image/jpeg";
  const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
  if (bytes.byteLength > 8 * 1024 * 1024) return json({ error: "Artwork is too large." }, 413);

  const path = squad.id + "/final-four-artwork.jpg";
  const upload = await storageFetch("/object/four-photos/" + path, {
    method: "POST",
    headers: {
      "Content-Type": mime,
      "x-upsert": "true"
    },
    body: bytes
  });

  if (!upload.ok) return json({ error: "Could not store artwork." }, 502);

  const status = squad.status === "complete" ? "complete" : "registered";
  const update = await rest(
    "/four_squads?id=eq." + encodeURIComponent(squad.id),
    {
      method: "PATCH",
      body: JSON.stringify({ artwork_url: path, status })
    }
  );
  if (!update.ok) return json({ error: "Artwork stored but could not link it." }, 502);

  await logEvent(String(body.code), "artwork_generated", "web", { persisted: true });
  return json({ ok: true, artwork_url: await signObject("four-photos", path) });
}

async function handleReward(request: Request) {
  const body = await request.json();
  if (!body.code) return json({ error: "Four code is required." }, 400);

  const code = String(body.code).trim().toUpperCase();
  const squad = await findSquad(code);
  if (!squad) return json({ error: "Four not found." }, 404);

  const c = config();
  if (!c) return json({ error: "Supabase environment is not configured." }, 503);

  const r = await fetch(c.url + "/rest/v1/rpc/qualify_four_reward", {
    method: "POST",
    headers: {
      apikey: c.key,
      Authorization: "Bearer " + c.key,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ p_squad_id: squad.id })
  });

  if (!r.ok) return json({ error: "Could not qualify reward." }, 502);

  const rows = await r.json();
  const result = rows[0] || {
    qualified: false,
    reward_code: null,
    rank: null
  };

  if (result.qualified) {
    await logEvent(code, "reward_qualified", "web", { rank: result.rank });
  }

  return json({ ...result, code });
}

async function handleAdminEvents(request: Request) {
  if (!adminTokenValid(request)) return json({ error: "Unauthorized." }, 401);
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 100);
  const r = await rest("/campaign_events?select=event_type,channel,metadata,created_at,squad_id&order=created_at.desc&limit=" + limit);
  if (!r.ok) return json({ error: "Could not load campaign events." }, 502);
  const rows = await r.json();
  const ids = Array.from(new Set(rows.map((row: { squad_id?: string|null }) => row.squad_id).filter(Boolean))) as string[];
  const codeMap = new Map<string,string>();
  if (ids.length) {
    const squadResponse = await rest("/four_squads?select=id,code&id=in.(" + ids.join(",") + ")");
    if (squadResponse.ok) {
      const squads = await squadResponse.json();
      for (const squad of squads) codeMap.set(String(squad.id), String(squad.code || ""));
    }
  }
  return json({events: rows.map((row: {event_type?:string;channel?:string|null;metadata?:Record<string,unknown>|null;created_at?:string;squad_id?:string|null})=>({event_type:String(row.event_type||""),channel:row.channel||null,metadata:row.metadata||null,created_at:row.created_at||"",squad_id:row.squad_id||null,code:row.squad_id?codeMap.get(String(row.squad_id))||null:null}))});
}

async function handleMetrics(request: Request) {
  const expected = Deno.env.get("ADMIN_DASHBOARD_TOKEN");
  if (!expected || request.headers.get("x-admin-token") !== expected) {
    return json({ error: "Unauthorized." }, 401);
  }

  const r = await rest("/four_campaign_metrics?select=*");
  if (!r.ok) return json({ error: "Could not load campaign metrics." }, 502);

  const rows = await r.json();
  return json(rows[0] || {});
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const path = new URL(request.url).pathname;

    if (path.endsWith("/metrics") && request.method === "GET") return handleMetrics(request);
    if (path.endsWith("/admin/events") && request.method === "GET") return handleAdminEvents(request);
    if (path.endsWith("/activity") && request.method === "GET") return handlePublicActivity(request);
    if (path.endsWith("/card") && request.method === "GET") return handleCreatorCard(request);
    if (path.endsWith("/admin/four") && request.method === "GET") return handleAdminFour(request);
    if (path.endsWith("/claim-card") && request.method === "POST") return handleClaimCard(request);
    if (path.endsWith("/share") && request.method === "POST") return handleShareConfirmation(request);
    if (path.endsWith("/reward") && request.method === "POST") return handleReward(request);
    if (path.endsWith("/photos") && request.method === "POST") return handlePhoto(request);
    if (path.endsWith("/artwork") && request.method === "POST") return handleArtwork(request);

    if (path.endsWith("/events") && request.method === "POST") {
      const body = await request.json();
      if (!body.eventType) return json({ error: "eventType is required." }, 400);
      await logEvent(
        body.code,
        String(body.eventType),
        String(body.channel || "web"),
        body.metadata || {}
      );
      return json({ ok: true });
    }

    return handleFours(request);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unexpected error." },
      500
    );
  }
});
