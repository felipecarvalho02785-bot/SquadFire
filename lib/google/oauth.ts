import { env } from '@/lib/env';

// OAuth 2.0 do Google (Calendar) — sem SDK, só fetch. Fluxo dedicado com
// refresh token, para a agenda funcionar mesmo fora do momento do login.

const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
const USERINFO = 'https://www.googleapis.com/oauth2/v2/userinfo';

// fetch com timeout — um endpoint OAuth travado não pode prender a rota até o
// teto da plataforma (nem paralisar o cron que renova tokens).
async function fetchTO(url: string, init: RequestInit, ms = 10000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); }
  finally { clearTimeout(timer); }
}

// calendar.events = ler/criar eventos; openid+email = identificar a conta.
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'openid',
  'email',
].join(' ');

export function googleConfigurado(): boolean {
  return !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

export function redirectUri(): string {
  return process.env.GOOGLE_OAUTH_REDIRECT || `${env.siteUrl.replace(/\/$/, '')}/api/google/callback`;
}

export function urlDeConsentimento(state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID as string,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    access_type: 'offline', // pede refresh_token
    prompt: 'consent', // garante refresh_token mesmo em re-conexão
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH}?${p.toString()}`;
}

export interface TokenResp {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

export async function trocarCodigo(code: string): Promise<TokenResp> {
  const res = await fetchTO(TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET as string,
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`troca de código falhou: ${await res.text()}`);
  return res.json();
}

export async function renovarToken(refreshToken: string): Promise<TokenResp> {
  const res = await fetchTO(TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET as string,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`refresh falhou: ${await res.text()}`);
  return res.json();
}

export async function emailDaConta(accessToken: string): Promise<string | null> {
  try {
    const res = await fetchTO(USERINFO, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return null;
    const j = (await res.json()) as { email?: string };
    return j.email ?? null;
  } catch {
    return null;
  }
}
