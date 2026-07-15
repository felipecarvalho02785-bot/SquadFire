import { Sidebar } from '@/components/Sidebar';
import { FaiscaDrawer } from '@/components/FaiscaDrawer';
import { VidaFx } from '@/components/VidaFx';
import { getCurrentMembro } from '@/lib/auth';
import { getPulso } from '@/lib/data/covil';
import { isSupabaseConfigured } from '@/lib/env';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [membro, pulso] = await Promise.all([
    isSupabaseConfigured ? getCurrentMembro() : Promise.resolve(null),
    getPulso(),
  ]);

  // Gate de membership: o SSO do Google aceita QUALQUER conta, mas só quem está
  // na allowlist (tabela membro) é da Brigada. Uma sessão válida fora da
  // allowlist não abre o app — assim um não-membro não dispara os pull-on-view
  // (sync/escritas com service_role) das telas. Os dados já eram protegidos por
  // RLS; isto fecha o custo/efeito colateral e dá uma tela clara de "peça acesso".
  if (isSupabaseConfigured && !membro) {
    return (
      <>
        <div className="dragon-bg" aria-hidden />
        <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <div className="card" style={{ maxWidth: 460, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', padding: '30px 26px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/squad-icon.png" alt="SquadFire" width={48} height={48} />
            <h1 style={{ fontSize: 20, margin: 0 }}>Acesso pendente</h1>
            <p style={{ color: 'var(--muted)', margin: 0, fontSize: 14 }}>
              Sua conta Google entrou, mas ainda não faz parte da Brigada. Peça a um admin do SquadFire para liberar o seu e-mail no acervo de membros.
            </p>
            <a className="btn" href="/auth/signout">Sair</a>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="dragon-bg" aria-hidden />
      <div className="shell">
        <Sidebar membro={membro} pulso={pulso} />
        <div className="main">
        {!isSupabaseConfigured && (
          <div
            style={{
              background: 'rgba(245,165,36,0.12)',
              borderBottom: '1px solid var(--line)',
              color: 'var(--flame)',
              padding: '8px 28px',
              fontSize: 12.5,
            }}
          >
            Modo demonstração — Supabase não configurado. Defina as variáveis de ambiente para
            conectar o banco (ver <code>.env.example</code>).
          </div>
        )}
          {children}
        </div>
      </div>
      <FaiscaDrawer />
      <VidaFx />
    </>
  );
}
