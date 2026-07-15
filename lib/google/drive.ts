import { getServiceAccountToken, isServiceAccountConfigured } from '@/lib/google/service-account';

// ── Leitura da pasta "Biblioteca de arquivos" do Google Drive ───────────────
// Estrutura esperada (mas o código tolera variações):
//   Biblioteca de arquivos
//   ├── Roteiros   → {área}   (docs)
//   └── Criativos  → {tema}   (imagens/vídeos) + arquivos soltos
// Varre a árvore (BFS, com teto de tempo/arquivos) e classifica cada arquivo em
// roteiro/criativo pela ramificação em que está; o "tema" é a 1ª subpasta abaixo
// da categoria (ex.: Previdenciário). Leitura via CONTA DE SERVIÇO (robô).

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const FILES = 'https://www.googleapis.com/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

export interface DriveItem {
  id: string;
  nome: string;
  mimeType: string;
  categoria: 'roteiro' | 'criativo';
  tema: string | null;
  webViewLink: string | null;
  ehImagem: boolean;
  modificadoEm: string | null;
  tamanho: number | null;
}

export interface DriveBiblioteca {
  itens: DriveItem[];
  truncado: boolean; // true se batemos o teto e paramos antes de varrer tudo
  erro: string | null;
}

function pastaRaiz(): string | null {
  return process.env.BIBLIOTECA_DRIVE_FOLDER_ID?.trim() || null;
}

export function isBibliotecaDriveConfigured(): boolean {
  return isServiceAccountConfigured() && !!pastaRaiz();
}

// fetch pro Drive com timeout e retry (429/5xx) — mesmo padrão do calendar.ts.
async function dfetch(url: string, token: string, tentativas = 3): Promise<Response> {
  for (let i = 0; ; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    let res: Response;
    try {
      res = await fetch(url, { headers: { authorization: `Bearer ${token}` }, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
    if ((res.status === 429 || res.status >= 500) && i < tentativas - 1) {
      await new Promise((r) => setTimeout(r, 400 * (i + 1) + Math.floor(300 * Math.random())));
      continue;
    }
    return res;
  }
}

function classificarPorMime(mime: string): 'roteiro' | 'criativo' {
  if (mime.startsWith('image/') || mime.startsWith('video/')) return 'criativo';
  if (/document|text|pdf|presentation/.test(mime)) return 'roteiro';
  return 'criativo';
}

type Fila = { id: string; categoria: 'roteiro' | 'criativo' | null; tema: string | null };
type DriveFile = { id: string; name: string; mimeType: string; webViewLink?: string; modifiedTime?: string; size?: string };

// Varre a Biblioteca e devolve todos os arquivos (não pastas), classificados.
export async function listarBibliotecaDrive(): Promise<DriveBiblioteca> {
  if (!isBibliotecaDriveConfigured()) return { itens: [], truncado: false, erro: null };
  const token = await getServiceAccountToken(DRIVE_SCOPE);
  if (!token) return { itens: [], truncado: false, erro: 'credencial da conta de serviço inválida' };

  const raiz = pastaRaiz() as string;
  const itens: DriveItem[] = [];
  const MAX_ARQUIVOS = 800;
  const MAX_PASTAS = 200;
  const prazo = Date.now() + 45_000; // teto de tempo (função Hobby = 60s)
  let pastas = 0;
  let truncado = false;
  const vistos = new Set<string>(); // evita loop se houver atalho/ciclo
  const fila: Fila[] = [{ id: raiz, categoria: null, tema: null }];

  while (fila.length) {
    if (Date.now() > prazo || pastas >= MAX_PASTAS || itens.length >= MAX_ARQUIVOS) {
      truncado = true;
      break;
    }
    const cur = fila.shift() as Fila;
    if (vistos.has(cur.id)) continue;
    vistos.add(cur.id);
    pastas += 1;

    let pageToken: string | undefined;
    for (let p = 0; p < 5; p++) {
      const q = encodeURIComponent(`'${cur.id}' in parents and trashed = false`);
      const fields = encodeURIComponent('nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime,size)');
      let url = `${FILES}?q=${q}&fields=${fields}&pageSize=200&orderBy=folder,name&supportsAllDrives=true&includeItemsFromAllDrives=true`;
      if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

      let res: Response;
      try {
        res = await dfetch(url, token);
      } catch (e) {
        // Erro na raiz é fatal (não conseguimos ler nada); em subpasta, segue.
        if (cur.id === raiz) return { itens, truncado, erro: (e as Error).message ?? 'falha ao ler o Drive' };
        break;
      }
      if (!res.ok) {
        if (cur.id === raiz) return { itens, truncado, erro: `Drive recusou (${res.status})` };
        break;
      }
      const j = (await res.json()) as { nextPageToken?: string; files?: DriveFile[] };
      for (const f of j.files ?? []) {
        if (f.mimeType === FOLDER_MIME) {
          // categoria: herda; se ainda indefinida, tenta pelo nome da pasta.
          let categoria = cur.categoria;
          if (categoria === null) {
            if (/roteiro/i.test(f.name)) categoria = 'roteiro';
            else if (/criativo/i.test(f.name)) categoria = 'criativo';
          }
          // tema: nulo enquanto estamos na/acima da pasta-categoria; ao descer o
          // 1º nível abaixo da categoria, o tema passa a ser o nome dessa pasta.
          let tema: string | null;
          if (cur.categoria === null) tema = null;
          else if (cur.tema === null) tema = f.name.trim();
          else tema = cur.tema;
          fila.push({ id: f.id, categoria, tema });
        } else {
          const categoria = cur.categoria ?? classificarPorMime(f.mimeType);
          itens.push({
            id: f.id,
            nome: f.name,
            mimeType: f.mimeType,
            categoria,
            tema: cur.tema,
            webViewLink: f.webViewLink ?? null,
            ehImagem: f.mimeType.startsWith('image/'),
            modificadoEm: f.modifiedTime ?? null,
            tamanho: f.size ? Number(f.size) : null,
          });
          if (itens.length >= MAX_ARQUIVOS) {
            truncado = true;
            break;
          }
        }
      }
      if (truncado || !j.nextPageToken) break;
      pageToken = j.nextPageToken;
    }
  }

  return { itens, truncado, erro: null };
}
