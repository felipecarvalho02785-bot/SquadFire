import { Topbar } from '@/components/Topbar';

export const dynamic = 'force-dynamic';

interface Item { titulo: string; cria: string; tipo: 'Roteiro' | 'Criativo'; data: string }

const ITENS: Item[] = [
  { titulo: 'Roteiro VSL · Previdenciário', cria: 'M. Oliveira Advogados', tipo: 'Roteiro', data: 'esta semana' },
  { titulo: 'Carrossel · 5 erros no INSS', cria: 'Mendes Advocacia', tipo: 'Criativo', data: 'ontem' },
  { titulo: 'Roteiro Reels · Autoridade', cria: 'Letícia Stein', tipo: 'Roteiro', data: 'há 3 dias' },
  { titulo: 'Criativo estático · Oferta', cria: 'Mozini Advocacia', tipo: 'Criativo', data: 'esta semana' },
  { titulo: 'Roteiro anúncio · Trabalhista', cria: 'Edi Carlos Advocacia', tipo: 'Roteiro', data: 'há 5 dias' },
  { titulo: 'Criativo vídeo · Depoimento', cria: 'Ribeiro & Associados', tipo: 'Criativo', data: 'há 1 semana' },
];

export default function BibliotecaPage() {
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

        <div className="tkfilter">
          <button className="on">Todos</button>
          <button>Roteiros</button>
          <button>Criativos</button>
        </div>

        <div className="grid cols-3">
          {ITENS.map((it, i) => (
            <div className="card" key={i}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span className={`ttag ${it.tipo === 'Roteiro' ? 'forja' : 'rotina'}`}>{it.tipo}</span>
                <span className="s" style={{ color: 'var(--faint)' }}>{it.data}</span>
              </div>
              <div className="t" style={{ marginTop: 10, fontSize: 14 }}>{it.titulo}</div>
              <div className="s" style={{ color: 'var(--muted)', marginTop: 4 }}>{it.cria}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
