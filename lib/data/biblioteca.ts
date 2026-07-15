import { getSupabaseServer } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';

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
}

type Raw = {
  id: string; titulo: string; tipo: 'roteiro' | 'criativo'; conteudo: string | null;
  arquivo_path: string | null; arquivo_nome: string | null; cria_id: string | null;
  autor_id: string | null; created_at: string; cria: { nome_cliente: string } | null;
};

// Acervo real da Biblioteca. Assina a URL do arquivo dos criativos (6h).
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
    });
  }
  return out;
}
