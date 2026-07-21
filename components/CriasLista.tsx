import { PuxarTodosBtn } from '@/components/PuxarTodosBtn';
import { CriasCarteira, type CriaVM } from '@/components/CriasCarteira';
import { listCrias, getFaseAtualPorCria } from '@/lib/data/crias';
import { getCurrentMembro } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/env';
import { brl, faseLabel, iniciais, saudeDaCria } from '@/lib/format';
import { sincronizarEspelhoSeVelho } from '@/lib/clickup/espelho';
import { ehPrefetch } from '@/lib/prefetch';

// Componente STREAMADO (dentro de <Suspense> na página): antes de ler o espelho,
// dispara um sync leve do ClickUp SE estiver velho (> 2min) — assim abrir a aba
// reflete o ClickUp de verdade, sem depender só do cron diário. O shell (Topbar)
// já apareceu; a lista entra quando o sync/leitura terminam.
export async function CriasLista({ q }: { q: string }) {
  // Pull-on-view: idempotente, throttled e resiliente (nunca derruba a página).
  // Pulado no PREFETCH — pré-aquecer a aba não deve puxar o ClickUp nem escrever.
  if (!(await ehPrefetch())) await sincronizarEspelhoSeVelho({ maxIdadeMs: 120_000 });

  const termo = q.trim().toLowerCase();
  const [todas, faseMap] = await Promise.all([listCrias(), getFaseAtualPorCria()]);
  const membro = isSupabaseConfigured ? await getCurrentMembro() : null;
  const crias = termo
    ? todas.filter((c) => c.nome_cliente.toLowerCase().includes(termo) || (c.area_atuacao ?? '').toLowerCase().includes(termo))
    : todas;

  // Fase de EXIBIÇÃO = a fase corrente da Forja (fonte do detalhe), caindo pro
  // clickup_semana só quando não há Forja/fase. Assim a carteira nunca discorda
  // do detalhe quando o time avança a fase à frente da Semana do ClickUp.
  const semanaDe = (c: { id: string; clickup_semana: number | null }): number | null =>
    faseMap.get(c.id) ?? c.clickup_semana;

  const emForja = crias.filter((c) => semanaDe(c) != null).length;
  const backlog = crias.length - emForja;

  const itens: CriaVM[] = crias.map((c) => {
    const semana = semanaDe(c);
    return {
      id: c.id,
      nome: c.nome_cliente,
      iniciais: iniciais(c.nome_cliente),
      area: c.area_atuacao ?? 'Área a definir',
      semana,
      faseNome: semana ? faseLabel(semana) : null,
      investimento: brl(c.investimento_midia),
      investimentoNum: c.investimento_midia ?? null,
      saude: saudeDaCria({ status: c.status, em_risco: c.em_risco, clickup_semana: semana }),
    };
  });

  return (
    <>
      <div className="pagehead">
        <div>
          <div className="eye">Carteira · {todas.length} Crias{termo ? ` · ${crias.length} para "${q}"` : ''}</div>
          <h2>Crias</h2>
          <p>Squad 08 · espelho do ClickUp (Estruturação): {emForja} em execução + {backlog} no backlog. Clique numa Cria pra abrir a Forja.</p>
          {membro?.is_admin && <PuxarTodosBtn />}
        </div>
      </div>

      {crias.length === 0 ? (
        <div className="empty">
          <b>{termo ? `Nenhuma Cria para "${q}"` : 'Nenhuma Cria ainda'}</b>
          <p>{termo ? 'Tente outro termo ou limpe a busca.' : 'As Crias entram pelo sync do ClickUp (lista-mestre, Squad 08) ou pelo cadastro do Gestor de Contas. Rode a sincronização para materializar os clientes.'}</p>
        </div>
      ) : (
        <CriasCarteira itens={itens} />
      )}
    </>
  );
}
