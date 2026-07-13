import { Sidebar } from '@/components/Sidebar';
import { getCurrentMembro } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/env';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const membro = isSupabaseConfigured ? await getCurrentMembro() : null;

  return (
    <div className="shell">
      <Sidebar membro={membro} />
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
  );
}
