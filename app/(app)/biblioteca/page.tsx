import { Topbar } from '@/components/Topbar';
import { BibliotecaLista, type ItemBiblioteca } from '@/components/BibliotecaLista';

export const dynamic = 'force-dynamic';

const ITENS: ItemBiblioteca[] = [
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

        <BibliotecaLista itens={ITENS} />
      </div>
    </div>
  );
}
