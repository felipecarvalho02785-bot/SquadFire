import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { PuxarTodosBtn } from '@/components/PuxarTodosBtn';
import { CriasFrescor } from '@/components/CriasFrescor';
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
  const termo = q.trim().toLowerCase();
  let [todas, faseMap] = await Promise.all([listCrias(), getFaseAtualPorCria()]);

  // Pull-on-view SEM travar a página. Pulado no PREFETCH (pré-aquecer não puxa).
  //  • Espelho vazio (1ª carga): sincroniza AGORA e relê — senão abriria vazio.
  //  • Espelho já tem Crias: sincroniza em SEGUNDO PLANO (after) — a página
  //    aparece na hora com o espelho atual e o dado fresco entra na próxima
  //    navegação (revalidamos a lista só se algo mudou).
  if (!(await ehPrefetch())) {
    if (todas.length === 0) {
      await sincronizarEspelhoSeVelho({ maxIdadeMs: 120_000 });
      [todas, faseMap] = await Promise.all([listCrias(), getFaseAtualPorCria()]);
    } else {
      after(async () => {
        const r = await sincronizarEspelhoSeVelho({ maxIdadeMs: 120_000 });
        if (r.status === 'ok' && r.upserts) revalidatePath('/crias', 'page');
      });
    }
  }

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

  // Frescor do espelho = o sincronizado_em MAIS RECENTE (ISO ordena = cronológico).
  const sincronizadoEm =
    todas.map((c) => c.sincronizado_em).filter((x): x is string => !!x).sort().at(-1) ?? null;

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
          {isSupabaseConfigured && <CriasFrescor sincronizadoEm={sincronizadoEm} />}
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
