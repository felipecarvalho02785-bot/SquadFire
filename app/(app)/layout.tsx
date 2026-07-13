import { Sidebar } from '@/components/Sidebar';
import { getCurrentMembro } from '@/lib/auth';
import { getPulso } from '@/lib/data/covil';
import { isSupabaseConfigured } from '@/lib/env';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [membro, pulso] = await Promise.all([
    isSupabaseConfigured ? getCurrentMembro() : Promise.resolve(null),
    getPulso(),
  ]);

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
            ⚙️ Modo demonstração — Supabase não configurado. Defina as variáveis de ambiente para
            conectar o banco (ver <code>.env.example</code>).
          </div>
        )}
          {children}
        </div>
      </div>
    </>
  );
}
