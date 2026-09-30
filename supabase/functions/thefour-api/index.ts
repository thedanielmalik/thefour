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
  const r = await rest("/four_squads?code=eq." + encodeURIComponent(code) + "&select=id,code,status,preferred_cinema,preferred_date,preferred_showtime,artwork_url,created_at");
  if (!r.ok) return null;
  const rows = await r.json();
  return rows[0] || null;
};

const signObject = async (bucket: string, path: string, expiresIn = 86400) => {
  const r = await storageFetch("/object/sign/" + encodeURIComponent(bucket) + "/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn })
  });
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
    const squad = code ? await findSquad(String(code).trim().toUpperCase()) : null;
    await rest("/campaign_events", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ squad_id: squad?.id || null, event_type: eventType, channel, metadata })
    });
  } catch {
    // Analytics failures must never block the campaign journey.
  }
};
