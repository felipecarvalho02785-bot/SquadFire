import { BibliotecaClient } from '@/components/BibliotecaClient';
import { getBibliotecaTudo } from '@/lib/data/biblioteca';
import { getCurrentMembro } from '@/lib/auth';
import { getSupabaseServer } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';

// Server component STREAMADO (dentro de <Suspense> na página): o shell da
// Biblioteca aparece na hora e o acervo (manual + Drive) entra quando pronto.
// O Drive é cacheado 60s, então quase sempre vem rápido.
export async function BibliotecaConteudo() {
  if (!isSupabaseConfigured) {
    return <BibliotecaClient itens={[]} crias={[]} meuId={null} temas={[]} driveConfigurado={false} driveErro={null} driveTruncado={false} ehAdmin={false} />;
  }

  const supabase = await getSupabaseServer();
  const [tudo, membro, criasData] = await Promise.all([
    getBibliotecaTudo(),
    getCurrentMembro(),
    supabase.from('cria').select('id, nome_cliente').eq('status', 'ativa').order('nome_cliente'),
  ]);

  const crias = ((criasData.data as { id: string; nome_cliente: string }[]) ?? []).map((c) => ({ id: c.id, nome: c.nome_cliente }));

  return (
    <BibliotecaClient
      itens={tudo.itens}
      crias={crias}
      meuId={membro?.id ?? null}
      temas={tudo.temas}
      driveConfigurado={tudo.driveConfigurado}
      driveErro={tudo.driveErro}
      driveTruncado={tudo.driveTruncado}
      ehAdmin={!!membro?.is_admin}
    />
  );
}
