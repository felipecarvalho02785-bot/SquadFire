import { notFound } from 'next/navigation';
import { RodaDeFogo } from '@/components/RodaDeFogo';
import { getCriaDetalhe } from '@/lib/data/crias';

export const dynamic = 'force-dynamic';

export default async function RodaDeFogoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const det = await getCriaDetalhe(id);
  if (!det) notFound();

  const { cria, forja, fases, lenhas, gestor } = det;
  const faseAtual = fases.find((f) => f.id === forja?.fase_atual_id) ?? fases.find((f) => f.status === 'em_andamento');
  const proximas = (faseAtual ? lenhas.filter((l) => l.fase_da_forja_id === faseAtual.id) : [])
    .map((l) => ({ id: l.id, titulo: l.titulo, sub: faseAtual?.fase?.nome ?? 'Fase', done: l.status === 'concluida' }));

  return (
    <RodaDeFogo
      criaId={cria.id}
      nome={cria.nome_cliente}
      area={cria.area_atuacao}
      faseOrdem={faseAtual?.ordem ?? 0}
      faseNome={faseAtual?.fase?.nome ?? 'sem fase'}
      gestorContas={gestor?.nome ?? null}
      cliente={cria.nome_cliente}
      proximas={proximas}
    />
  );
}
