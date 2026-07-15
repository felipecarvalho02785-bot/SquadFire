import crypto from 'node:crypto';

// ── Autenticação por CONTA DE SERVIÇO (robô) para o Google Drive ─────────────
// A Biblioteca lê uma pasta COMPARTILHADA do Drive. Em vez de depender do login
// de um membro (OAuth), o servidor assina um JWT com a chave da conta de serviço
// e troca por um access token — server-to-server, sem tela de consentimento e
// sem token que expira por inatividade. Basta compartilhar a pasta com o e-mail
// da conta de serviço (permissão de Leitor). Ver docs/biblioteca-drive.md.

interface SAKey {
  client_email: string;
  private_key: string;
}

// Lê a chave de GOOGLE_SERVICE_ACCOUNT_JSON. Aceita o JSON cru OU base64 (o
// base64 evita problemas de quebra de linha ao colar no painel da Vercel).
function carregarChave(): SAKey | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  let texto = raw;
  if (!raw.startsWith('{')) {
    try {
      texto = Buffer.from(raw, 'base64').toString('utf8');
    } catch {
      return null;
    }
  }
  try {
    const obj = JSON.parse(texto) as { client_email?: string; private_key?: string };
    if (!obj.client_email || !obj.private_key) return null;
    // Normaliza \n escapados (caso o painel tenha escapado as quebras de linha).
    const private_key = String(obj.private_key).replace(/\\n/g, '\n');
    return { client_email: obj.client_email, private_key };
  } catch {
    return null;
  }
}

export function isServiceAccountConfigured(): boolean {
  return !!carregarChave();
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Cache do token por escopo (o token vale ~1h; renova 1min antes de expirar).
const cache = new Map<string, { token: string; exp: number }>();

// Access token válido da conta de serviço para um escopo. null se não
// configurada ou se o Google recusar (ex.: chave inválida).
export async function getServiceAccountToken(scope: string): Promise<string | null> {
  const agora = Math.floor(Date.now() / 1000);
  const em = cache.get(scope);
  if (em && em.exp - 60 > agora) return em.token;

  const chave = carregarChave();
  if (!chave) return null;

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(
    JSON.stringify({
      iss: chave.client_email,
      scope,
      aud: 'https://oauth2.googleapis.com/token',
      iat: agora,
      exp: agora + 3600,
    }),
  );
  const entrada = `${header}.${claim}`;
  let assinatura: string;
  try {
    assinatura = b64url(crypto.sign('RSA-SHA256', Buffer.from(entrada), chave.private_key));
  } catch {
    return null; // chave malformada
  }
  const assertion = `${entrada}.${assinatura}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  let res: Response;
  try {
    res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
      signal: ctrl.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) return null;
  const j = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) return null;
  cache.set(scope, { token: j.access_token, exp: agora + (j.expires_in ?? 3600) });
  return j.access_token;
}
