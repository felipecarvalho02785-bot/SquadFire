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
    <div style={{ position: 'relative', minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="dragon-bg" aria-hidden />
      <div
        className="card"
        style={{ position: 'relative', zIndex: 1, maxWidth: 400, width: '100%', textAlign: 'center', padding: '34px 30px' }}
      >
        <div
          className="mark"
          style={{ width: 60, height: 60, borderRadius: 14, margin: '0 auto 18px', overflow: 'hidden' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/squad-icon.png" alt="SquadFire" width={60} height={60}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Squad 08 · E3 Digital</div>
        <h1 style={{ fontFamily: 'var(--sans)', fontSize: 30, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Squad<span style={{ color: 'var(--ember)' }}>Fire</span>
        </h1>
        <p style={{ color: 'var(--muted)', marginTop: 8, marginBottom: 26, fontSize: 14 }}>
          A Forja das Crias — onde o cliente esquenta até virar aço.
        </p>
        <button className="btn primary" style={{ width: '100%', justifyContent: 'center', padding: '12px 15px' }}
          onClick={entrarComGoogle} disabled={loading}>
          {loading ? 'Abrindo…' : 'Entrar com Google'}
        </button>
        {erro && <p style={{ color: 'var(--risk)', fontSize: 12.5, marginTop: 14 }}>{erro}</p>}
        <p style={{ color: 'var(--faint)', fontSize: 11.5, marginTop: 24 }}>
          🔒 Acesso restrito à squad (allowlist). Fale com o admin para ser liberado.
        </p>
      </div>
    </div>
  );
}
