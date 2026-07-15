import { unstable_cache } from 'next/cache';
import { getSupabaseServer } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import { listarBibliotecaDrive, isBibliotecaDriveConfigured, type DriveBiblioteca } from '@/lib/google/drive';

export interface BiblioItem {
  id: string;
  titulo: string;
  tipo: 'roteiro' | 'criativo';
  conteudo: string | null;
  arquivoUrl: string | null;
  arquivoNome: string | null;
  criaId: string | null;
  criaNome: string | null;
  autorId: string | null;
  criadoEm: string;
  fonte: 'app' | 'drive';
  tema: string | null;
  thumbUrl: string | null; // preview (imagens do Drive, via proxy)
  mimeType: string | null;
}

type Raw = {
  id: string; titulo: string; tipo: 'roteiro' | 'criativo'; conteudo: string | null;
  arquivo_path: string | null; arquivo_nome: string | null; cria_id: string | null;
  autor_id: string | null; created_at: string; cria: { nome_cliente: string } | null;
};

// Acervo MANUAL (tabela biblioteca_item). Assina a URL do arquivo dos criativos.
export async function getBibliotecaItens(): Promise<BiblioItem[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from('biblioteca_item')
    .select('id, titulo, tipo, conteudo, arquivo_path, arquivo_nome, cria_id, autor_id, created_at, cria:cria_id(nome_cliente)')
    .order('created_at', { ascending: false })
    .limit(200);

  const rows = (data as unknown as Raw[]) ?? [];
  const out: BiblioItem[] = [];
  for (const r of rows) {
    let arquivoUrl: string | null = null;
    if (r.arquivo_path) {
      const { data: s } = await supabase.storage.from('entregaveis').createSignedUrl(r.arquivo_path, 21600);
      arquivoUrl = s?.signedUrl ?? null;
    }
    out.push({
      id: r.id, titulo: r.titulo, tipo: r.tipo, conteudo: r.conteudo,
      arquivoUrl, arquivoNome: r.arquivo_nome,
      criaId: r.cria_id, criaNome: r.cria?.nome_cliente ?? null,
      autorId: r.autor_id, criadoEm: r.created_at,
      fonte: 'app', tema: null, thumbUrl: null, mimeType: null,
    });
  }
  return out;
}

// Varredura do Drive cacheada (60s) — a MESMA biblioteca pra todo mundo (conta
// de serviço), então cachear entre requisições/usuários é correto e deixa a
// página rápida (só ~1 varredura por minuto paga o custo). Também é a fonte da
// lista de IDs permitidos usada pelo proxy de imagem.
export const getDriveBibliotecaCached = unstable_cache(
  async (): Promise<DriveBiblioteca> => listarBibliotecaDrive(),
  ['biblioteca-drive-v1'],
  { revalidate: 60, tags: ['biblioteca-drive'] },
);

function driveParaItens(d: DriveBiblioteca): BiblioItem[] {
  return d.itens.map((f) => ({
    id: `drive:${f.id}`,
    titulo: f.nome,
    tipo: f.categoria,
    conteudo: null,
    arquivoUrl: f.webViewLink,
    arquivoNome: f.nome,
    criaId: null,
    criaNome: null,
    autorId: null, // itens do Drive não têm dono no app → sem botão de excluir
    criadoEm: f.modificadoEm ?? '',
    fonte: 'drive',
    tema: f.tema,
    thumbUrl: f.ehImagem ? `/api/biblioteca/arquivo/${f.id}` : null,
    mimeType: f.mimeType,
  }));
}

export interface BibliotecaTudo {
  itens: BiblioItem[];
  temas: string[];
  driveConfigurado: boolean;
  driveErro: string | null;
  driveTruncado: boolean;
}

// Biblioteca completa = acervo manual (Supabase) + Google Drive (cacheado).
// O Drive é resiliente: se falhar, a página ainda mostra o acervo manual.
export async function getBibliotecaTudo(): Promise<BibliotecaTudo> {
  const driveConfigurado = isBibliotecaDriveConfigured();
  const [manuais, drive] = await Promise.all([
    getBibliotecaItens(),
    driveConfigurado ? getDriveBibliotecaCached().catch(() => null) : Promise.resolve(null),
  ]);

  const doDrive = drive ? driveParaItens(drive) : [];
  const temas = Array.from(new Set(doDrive.map((i) => i.tema).filter((t): t is string => !!t))).sort((a, b) => a.localeCompare(b));

  return {
    itens: [...manuais, ...doDrive],
    temas,
    driveConfigurado,
    driveErro: drive === null && driveConfigurado ? 'não deu para ler o Drive agora' : drive?.erro ?? null,
    driveTruncado: drive?.truncado ?? false,
  };
}
