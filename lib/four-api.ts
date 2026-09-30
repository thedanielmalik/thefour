const DEFAULT_API = 'https://pblahfvxzldcjyurpvgd.supabase.co/functions/v1/thefour-api';
const DEFAULT_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBibGFoZnZ4emxkY2p5dXJwdmdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MjQ1ODIsImV4cCI6MjEwNjIwMDU4Mn0.Vf12fyijUH1fZRRRF9ajdwScf3trXfa2YpUSZ6v34ZI';

export const FOUR_API_URL = process.env.NEXT_PUBLIC_FOUR_API_URL || DEFAULT_API;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON;

export async function fourApi(path:string, init:RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type','application/json');
  headers.set('Authorization','Bearer '+SUPABASE_ANON_KEY);
  return fetch(FOUR_API_URL + path, { ...init, headers });
}
