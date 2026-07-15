import { Suspense } from 'react';
import { Topbar } from '@/components/Topbar';
import { CriaSearch } from '@/components/CriaSearch';
import { CriasLista } from '@/components/CriasLista';

export const dynamic = 'force-dynamic';

export default async function CriasPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;

  return (
    <div className="main">
      <Topbar title="Crias" sub="espelho do ClickUp · Squad 08" right={<CriaSearch inicial={q ?? ''} />} />
      <div className="content">
        <Suspense
          key={q ?? ''}
          fallback={
            <div className="pagehead">
              <div>
                <div className="eye">Carteira</div>
                <h2>Crias</h2>
                <p>Sincronizando com o ClickUp…</p>
              </div>
            </div>
          }
        >
          <CriasLista q={q ?? ''} />
        </Suspense>
      </div>
    </div>
  );
}
