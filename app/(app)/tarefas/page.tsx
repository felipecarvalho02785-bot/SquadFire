import { Topbar } from '@/components/Topbar';
import { getSupabaseServer } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import type { Lenha } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

export default async function TarefasPage() {
  let lenhas: Lenha[] = [];
  if (isSupabaseConfigured) {
    const supabase = await getSupabaseServer();
    const { data } = await supabase
      .from('lenha')
      .select('*')
      .neq('status', 'concluida')
      .order('prazo', { ascending: true, nullsFirst: false })
      .limit(200);
    lenhas = (data as Lenha[]) ?? [];
  }

  const forja = lenhas.filter((l) => l.tipo === 'forja');
  const rotina = lenhas.filter((l) => l.tipo === 'rotina');

  return (
    <div className="main">
      <Topbar title="Tarefas · Lenha 🪵" sub="Tudo que alimenta a Forja — de Forja e de Rotina." />
      <div className="content grid cols-2" style={{ gap: 18 }}>
        <Bloco titulo="🔥 Lenha de Forja" lenhas={forja} />
        <Bloco titulo="🔁 Lenha de Rotina" lenhas={rotina} />
      </div>
    </div>
  );
}

function Bloco({ titulo, lenhas }: { titulo: string; lenhas: Lenha[] }) {
  return (
    <div className="card">
      <div className="eyebrow">{titulo} · {lenhas.length}</div>
      {lenhas.length === 0 ? (
        <div className="s">Sem Lenha aqui por enquanto.</div>
      ) : (
        lenhas.map((l) => (
          <div className="row" key={l.id}>
            <span className={`badge ${l.prioridade === 'alta' ? 'risk' : 'dim'}`}>{l.prioridade}</span>
            <div className="grow">
              <div className="t">{l.titulo}</div>
              {l.prazo && <div className="s">prazo {l.prazo}</div>}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
