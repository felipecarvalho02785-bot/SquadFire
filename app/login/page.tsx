'use client';

import { useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { isSupabaseConfigured, env } from '@/lib/env';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrarComGoogle() {
    if (!isSupabaseConfigured) {
      setErro('Supabase ainda não configurado neste ambiente.');
      return;
    }
    setLoading(true);
    setErro(null);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${env.siteUrl}/auth/callback` },
    });
    if (error) {
      setErro(error.message);
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="card" style={{ maxWidth: 380, width: '100%', textAlign: 'center' }}>
        <div className="mark" style={{ width: 52, height: 52, margin: '4px auto 16px', fontSize: 26 }}>
          🔥
        </div>
        <h1 style={{ fontSize: 22 }}>SquadFire</h1>
        <p style={{ color: 'var(--muted)', marginTop: 6, marginBottom: 22 }}>
          A Forja das Crias · Squad 08
        </p>
        <button className="btn primary" style={{ width: '100%', justifyContent: 'center' }}
          onClick={entrarComGoogle} disabled={loading}>
          {loading ? 'Abrindo…' : 'Entrar com Google'}
        </button>
        {erro && <p style={{ color: 'var(--risk)', fontSize: 12.5, marginTop: 14 }}>{erro}</p>}
        <p style={{ color: 'var(--muted)', fontSize: 11.5, marginTop: 22 }}>
          Acesso restrito à squad (allowlist). Fale com o admin para ser liberado.
        </p>
      </div>
    </div>
  );
}
