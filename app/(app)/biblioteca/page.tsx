import { Topbar } from '@/components/Topbar';
import { BibliotecaClient } from '@/components/BibliotecaClient';
import { getBibliotecaItens } from '@/lib/data/biblioteca';
import { getCurrentMembro } from '@/lib/auth';
import { getSupabaseServer } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function BibliotecaPage() {
  let itens: Awaited<ReturnType<typeof getBibliotecaItens>> = [];
  let crias: { id: string; nome: string }[] = [];
  let meuId: string | null = null;

  if (isSupabaseConfigured) {
    const supabase = await getSupabaseServer();
    const [it, membro, criasData] = await Promise.all([
      getBibliotecaItens(),
      getCurrentMembro(),
      supabase.from('cria').select('id, nome_cliente').eq('status', 'ativa').order('nome_cliente'),
    ]);
    itens = it;
    meuId = membro?.id ?? null;
    crias = ((criasData.data as { id: string; nome_cliente: string }[]) ?? []).map((c) => ({ id: c.id, nome: c.nome_cliente }));
  }

  return (
    <div className="main">
      <Topbar title="Biblioteca" sub="roteiros e criativos da squad" />
      <div className="content">
        <div className="pagehead">
          <div>
            <div className="eye">Operação · Acervo</div>
            <h2>Biblioteca</h2>
            <p>O acervo de roteiros e criativos produzidos para as Crias — reaproveite o que já pegou fogo.</p>
          </div>
        </div>

        <BibliotecaClient itens={itens} crias={crias} meuId={meuId} />
      </div>
    </div>
  );
}
