import { NextResponse } from 'next/server';

type RegisterPayload = {
  code: string;
  name: string;
  phone: string;
  email?: string;
  consent: boolean;
};

function requiredEnv() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export async function POST(request: Request) {
  const body = (await request.json()) as RegisterPayload;
  if (!body.code || !body.name || !body.phone || !body.consent) {
    return NextResponse.json({ error: 'Name, phone, code and consent are required.' }, { status: 400 });
  }

  const env = requiredEnv();
  if (!env) {
    return NextResponse.json({ error: 'Production database is not configured yet.', demo: true }, { status: 503 });
  }

  const headers = {
    apikey: env.key,
    Authorization: 'Bearer ' + env.key,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  };

  const base = env.url.replace(/\/$/, '') + '/rest/v1';

  const existing = await fetch(base + '/four_squads?code=eq.' + encodeURIComponent(body.code) + '&select=id,code', { headers });
  if (!existing.ok) return NextResponse.json({ error: 'Could not check Four code.' }, { status: 502 });
  const rows = await existing.json() as Array<{ id: string; code: string }>;

  let squadId: string;
  if (rows[0]?.id) {
    squadId = rows[0].id;
    const update = await fetch(base + '/four_squads?id=eq.' + encodeURIComponent(squadId), {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        creator_name: body.name,
        creator_phone: body.phone,
        creator_email: body.email || null,
        consent: true,
        status: 'registered'
      })
    });
    if (!update.ok) return NextResponse.json({ error: 'Could not update Four registration.' }, { status: 502 });
  } else {
    const create = await fetch(base + '/four_squads', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        code: body.code,
        creator_name: body.name,
        creator_phone: body.phone,
        creator_email: body.email || null,
        consent: true,
        status: 'registered'
      })
    });
    if (!create.ok) return NextResponse.json({ error: 'Could not save Four registration.' }, { status: 502 });
    const created = await create.json() as Array<{ id: string }>;
    squadId = created[0].id;
  }

  await fetch(base + '/four_members?on_conflict=squad_id,member_number', {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      squad_id: squadId,
      member_number: 1,
      name: body.name,
      phone: body.phone,
      email: body.email || null,
      joined_at: new Date().toISOString()
    })
  });

  await fetch(base + '/campaign_events', {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({
      squad_id: squadId,
      event_type: 'registered',
      channel: 'web',
      metadata: { consent: true }
    })
  });

  return NextResponse.json({ ok: true, code: body.code, squadId });
}
