import { Suspense } from 'react';
import { Topbar } from '@/components/Topbar';
import { BibliotecaConteudo } from '@/components/BibliotecaConteudo';

export const dynamic = 'force-dynamic';

export default function BibliotecaPage() {
  return (
    <div className="main">
      <Topbar title="Biblioteca" sub="roteiros e criativos da squad" />
      <div className="content">
        <div className="pagehead">
          <div>
            <div className="eye">Operação · Acervo</div>
            <h2>Biblioteca</h2>
            <p>O acervo de roteiros e criativos da squad — do Google Drive e do que a Brigada adiciona aqui. Reaproveite o que já pegou fogo.</p>
          </div>
        </div>

        <Suspense fallback={<div className="card"><div className="s" style={{ color: 'var(--muted)' }}>carregando acervo…</div></div>}>
          <BibliotecaConteudo />
        </Suspense>
      </div>
    </div>
  );
}
