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

    const members = membersResponse.ok ? await membersResponse.json() : [];
    for (const member of members) {
      if (member.photo_url) {
        member.photo_url = await signObject("four-photos", member.photo_url);
      }
      delete member.phone;
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
  const existing = await findSquad(code);
  let squadId = existing?.id as string | undefined;
  let memberNumber = requestedMember >= 1 && requestedMember <= 4 ? requestedMember : 1;

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

    if (!create.ok) return json({ error: "Could not create the Four." }, 502);

    const rows = await create.json();
    squadId = rows[0]?.id;
    memberNumber = 1;
  } else {
    const current = await rest(
      "/four_members?squad_id=eq." +
        encodeURIComponent(squadId) +
        "&select=id,member_number,phone,email&order=member_number.asc"
    );
    const occupied = current.ok ? await current.json() : [];

    const requestedOccupied = occupied.find(
      (x: { member_number: number }) => x.member_number === memberNumber
    );

    if (requestedMember && requestedOccupied) {
      const samePerson =
        String(requestedOccupied.phone || "").trim() === String(body.phone || "").trim() &&
        String(requestedOccupied.email || "").trim() === String(body.email || "").trim();

      if (!samePerson) return json({ error: "That Four place is already claimed." }, 409);
    } else if (!requestedMember) {
      const next = [1, 2, 3, 4].find(
        n => !occupied.some((x: { member_number: number }) => x.member_number === n)
      );
      if (!next) return json({ error: "This Four is already complete." }, 409);
      memberNumber = next;
    }

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
  }

  const existingMember = await rest(
    "/four_members?squad_id=eq." +
      encodeURIComponent(squadId) +
      "&member_number=eq." +
      memberNumber +
      "&select=id"
  );
  const existingMemberRows = existingMember.ok ? await existingMember.json() : [];

  const payload = {
    squad_id: squadId,
    member_number: memberNumber,
    name: body.name.trim(),
    phone: body.phone.trim(),
    email: body.email?.trim() || null,
    consent: true,
    joined_at: new Date().toISOString()
  };

  const member = existingMemberRows[0]?.id
    ? await rest("/four_members?id=eq." + encodeURIComponent(existingMemberRows[0].id), {
        method: "PATCH",
        body: JSON.stringify(payload)
      })
    : await rest("/four_members", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload)
      });

  if (!member.ok) return json({ error: "Could not save Four member." }, 502);

  await logEvent(
    code,
    body.preferredCinema
      ? "cinema_selected"
      : memberNumber === 1
      ? existing
        ? "member_joined"
        : "created"
      : "member_joined",
    "web",
    {
      consent: true,
      memberNumber,
      cinema: body.preferredCinema || null,
      showtime: body.preferredShowtime || null
    }
  );

  return json({ ok: true, code, squadId, memberNumber });
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
