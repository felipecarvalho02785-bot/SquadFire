'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { iniciais } from '@/lib/format';
import { salvarConta, salvarPreferencias, exportarMeusDados } from '@/lib/actions';

type Papel = 'gestor_contas' | 'gestor_projetos' | 'gestor_trafego';
const PAPEL_LABEL: Record<Papel, string> = { gestor_contas: 'Contas', gestor_projetos: 'Projetos', gestor_trafego: 'Tráfego' };

interface Integr { sigla: string; nome: string; nota: string; ok: boolean }
interface GoogleStatus { conectado: boolean; email: string | null; configurado: boolean }
interface Membro { id: string; nome: string; email: string; is_admin: boolean; papel_primario: Papel; papeis: Papel[] }

type PrefsDados = {
  notif?: { sla: boolean; roda: boolean; briefing: boolean; mencoes: boolean };
  canais?: { inapp: boolean; email: boolean; whatsapp: boolean };
  ia?: { voz: boolean; cross: boolean; cache: boolean };
  forja?: { auto: boolean; manual: boolean; travado: boolean };
  sla?: number;
  twofa?: boolean;
};
const DEFAULTS = {
  notif: { sla: true, roda: true, briefing: true, mencoes: false },
  canais: { inapp: true, email: true, whatsapp: false },
  ia: { voz: true, cross: false, cache: true },
  forja: { auto: true, manual: true, travado: true },
  sla: 7,
  twofa: false,
};

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button type="button" className={`switch${on ? ' on' : ''}`} role="switch" aria-checked={on} aria-label={label ?? (on ? 'Ligado' : 'Desligado')} onClick={() => onChange(!on)} />;
}

function Seg({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { key: string; label: string; icon?: React.ReactNode }[] }) {
  return (
    <div className="seg2">
      {options.map((o) => (
        <button type="button" key={o.key} className={o.key === value ? 'on' : ''} onClick={() => onChange(o.key)}>
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  );
}

const ic = {
  aparencia: <path d="M12 3a9 9 0 100 18c1 0 1.5-.8 1.5-1.5 0-.4-.2-.8-.5-1a1.5 1.5 0 011-2.6H16a5 5 0 005-5c0-3.9-4-8-9-8z" />,
  conta: <path d="M12 12a4 4 0 100-8 4 4 0 000 8zM5 21c0-3.9 3.1-6 7-6s7 2.1 7 6" />,
  notif: <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />,
  ia: <path d="M12 2l2.2 6.2L20 10l-5.8 1.8L12 18l-2.2-6.2L4 10l5.8-1.8z" />,
  plug: <path d="M9 2v6M15 2v6M7 8h10v3a5 5 0 01-10 0zM12 16v6" />,
  equipe: <path d="M9 11a3 3 0 100-6 3 3 0 000 6zM2 20c0-3 2.5-5 6.5-5m6.5-4a3 3 0 100-6M22 20c0-3-2.5-5-6.5-5" />,
  forja: <path d="M12 3c1.8 3-1 4-.7 6.3.3 1.8 2.2 2 2-.2 1.7 1.3 2.5 3.4 2.2 5.4C16.9 19 14.7 22 12 22c-3.1 0-5.4-2.4-5.4-5.6 0-2.5 1.5-4 2.4-5.2.5 1.7 2.2 1.4 2.1-.4C11 8.5 9.6 6 12 3z" />,
  seg: <path d="M12 3l7 3v5c0 4.2-2.9 7.7-7 9-4.1-1.3-7-4.8-7-9V6z" />,
  moon: <path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" /></>,
  monitor: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
};
const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

export function ForjariaClient({ membro, integracoes, team, google, prefs, clickupRealtime }: { membro: Membro | null; integracoes: Integr[]; team: Membro[]; google?: GoogleStatus; prefs?: PrefsDados | null; clickupRealtime?: boolean }) {
  const router = useRouter();
  async function desconectarGoogle() {
    await fetch('/api/google/disconnect', { method: 'POST' });
    router.refresh();
  }

  // Meus dados (LGPD): baixa um JSON com o perfil + prefs + Lenhas/comentários/briefings.
  const [exportando, setExportando] = useState(false);
  async function exportarDados() {
    setExportando(true);
    try {
      const r = await exportarMeusDados();
      if (r.ok && r.json) {
        const url = URL.createObjectURL(new Blob([r.json], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url; a.download = 'meus-dados-squadfire.json'; a.click();
        URL.revokeObjectURL(url);
      } else { alert(r.error ?? 'não deu para exportar'); }
    } finally { setExportando(false); }
  }

  // Encerra a sessão nos OUTROS aparelhos (mantém este). Via Supabase Auth.
  async function encerrarOutras() {
    if (!confirm('Sair da sua conta em todos os outros aparelhos?')) return;
    try {
      const { getSupabaseBrowser } = await import('@/lib/supabase/client');
      const { error } = await getSupabaseBrowser().auth.signOut({ scope: 'others' });
      alert(error ? 'não deu para encerrar as outras sessões' : 'Sessões dos outros aparelhos encerradas.');
    } catch { alert('não deu para encerrar as outras sessões'); }
  }

  // Exclusão de conta: acesso é por allowlist do SSO → é ato de admin. Orienta.
  function excluirConta() {
    alert('Para excluir sua conta e seus dados, fale com um admin da squad — o acesso é por allowlist do SSO. Você pode exportar seus dados aqui antes.');
  }

  // ClickUp — ativar o tempo real (registra o webhook + guarda o secret no banco)
  const [cuLoading, setCuLoading] = useState(false);
  const [cuMsg, setCuMsg] = useState<string | null>(null);
  const [cuOk, setCuOk] = useState(false);
  async function ativarClickup() {
    setCuLoading(true); setCuMsg(null);
    try {
      const res = await fetch('/api/clickup/webhook/register', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.ok) { setCuOk(true); setCuMsg('Tempo real ativado ✓'); router.refresh(); }
      else { setCuOk(false); setCuMsg(data.error ?? 'não deu para ativar'); }
    } catch {
      setCuOk(false); setCuMsg('falha de conexão');
    } finally {
      setCuLoading(false);
    }
  }
  // Aparência — aplica ao vivo no documento (fica no localStorage: precisa
  // valer antes da 1ª pintura, sem ida ao banco).
  const [tema, setTema] = useState('escuro');
  const [reduz, setReduz] = useState(false);
  const [densidade, setDensidade] = useState('confortavel');
  // Preferências — inicializadas do banco (prefs); localStorage é só fallback
  // no modo demo (sem membro/banco).
  const P = (prefs ?? {}) as PrefsDados;
  const [notif, setNotif] = useState(P.notif ?? DEFAULTS.notif);
  const [canais, setCanais] = useState(P.canais ?? DEFAULTS.canais);
  const [ia, setIa] = useState(P.ia ?? DEFAULTS.ia);
  const [forja, setForja] = useState(P.forja ?? DEFAULTS.forja);
  const [sla, setSla] = useState(P.sla ?? DEFAULTS.sla);
  const [twofa, setTwofa] = useState(P.twofa ?? DEFAULTS.twofa);
  // Conta — controlados pra poder gravar
  const [contaNome, setContaNome] = useState(membro?.nome ?? 'Felipe Carvalho');
  const [contaPapel, setContaPapel] = useState<Papel>(membro?.papel_primario ?? 'gestor_contas');
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startSalvar] = useTransition();

  // Ao montar: aparência sempre vem do localStorage (o script inline do layout
  // já aplicou no documento). Sem membro (demo), lê também as prefs do cache.
  useEffect(() => {
    try {
      const l = localStorage;
      const t = l.getItem('sf-tema');
      if (t) setTema(t);
      if (l.getItem('sf-densidade') === 'compacto') setDensidade('compacto');
      if (l.getItem('sf-reduz') === '1') setReduz(true);
      if (!membro) {
        const raw = l.getItem('sf-prefs');
        if (raw) {
          const p = JSON.parse(raw);
          if (p.notif) setNotif(p.notif);
          if (p.canais) setCanais(p.canais);
          if (p.ia) setIa(p.ia);
          if (p.forja) setForja(p.forja);
          if (typeof p.sla === 'number') setSla(p.sla);
          if (typeof p.twofa === 'boolean') setTwofa(p.twofa);
        }
      }
    } catch {
      /* localStorage indisponível — segue com os defaults */
    }
  }, [membro]);

  function persiste(chave: string, valor: string) {
    try { localStorage.setItem(chave, valor); } catch { /* ignora */ }
  }

  function aplicaTema(v: string) {
    setTema(v);
    persiste('sf-tema', v);
    const root = document.documentElement;
    const claro = v === 'claro' || (v === 'sistema' && window.matchMedia('(prefers-color-scheme: light)').matches);
    if (claro) root.setAttribute('data-theme', 'light');
    else root.removeAttribute('data-theme');
  }
  function aplicaReduz(v: boolean) { setReduz(v); persiste('sf-reduz', v ? '1' : '0'); document.documentElement.classList.toggle('no-anim', v); }
  function aplicaDensidade(v: string) { setDensidade(v); persiste('sf-densidade', v); document.documentElement.classList.toggle('density-compact', v === 'compacto'); }

  function salvar() {
    setErro(null);
    const dados = { notif, canais, ia, forja, sla, twofa };
    // cache local imediato (e única fonte no modo demo)
    try { localStorage.setItem('sf-prefs', JSON.stringify(dados)); } catch { /* ignora */ }

    if (!membro) { setSalvo(true); setTimeout(() => setSalvo(false), 1800); return; }

    startSalvar(async () => {
      const [rp, rc] = await Promise.all([
        salvarPreferencias(dados),
        salvarConta({ nome: contaNome, papel: contaPapel }),
      ]);
      if (!rp.ok || !rc.ok) {
        setErro(rp.error ?? rc.error ?? 'não deu para salvar');
        return;
      }
      setSalvo(true);
      setTimeout(() => setSalvo(false), 1800);
      router.refresh();
    });
  }

  const email = membro?.email ?? 'felipecarve3digital@gmail.com';

  return (
    <div className="main">
      <div className="topbar">
        <h1>Forjaria</h1><span className="sub">· configurações</span>
        <div style={{ flex: 1 }} />
        {erro && <span className="s" style={{ color: 'var(--risk)', marginRight: 10 }}>{erro}</span>}
        <button className="btn primary savebtn" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : salvo ? 'Salvo ✓' : 'Salvar alterações'}</button>
      </div>
      <div className="content">
        <div className="daygreet">
          <div className="eye">Gestão · Configurações</div>
          <h2>Configurações</h2>
          <p>Aparência, conta, notificações, IA, integrações, acessos e segurança do Squad 8.</p>
        </div>

        <div className="set-grid">
          {/* Aparência */}
          <div className="card setcard">
            <div className="sc-h"><span className="ic"><Svg>{ic.aparencia}</Svg></span><span className="t">Aparência</span></div>
            <div className="setrow">
              <div className="rmain"><div className="t">Tema</div><div className="s">Escuro (padrão da marca), claro ou seguir o sistema.</div></div>
              <Seg value={tema} onChange={aplicaTema} options={[
                { key: 'escuro', label: 'Escuro', icon: <Svg>{ic.moon}</Svg> },
                { key: 'claro', label: 'Claro', icon: <Svg>{ic.sun}</Svg> },
                { key: 'sistema', label: 'Sistema', icon: <Svg>{ic.monitor}</Svg> },
              ]} />
            </div>
            <div className="setrow">
              <div className="rmain"><div className="t">Reduzir animações</div><div className="s">Desliga o movimento contínuo (brasas, pulsos) — respeita acessibilidade.</div></div>
              <Toggle on={reduz} onChange={aplicaReduz} />
            </div>
            <div className="setrow">
              <div className="rmain"><div className="t">Densidade</div><div className="s">Espaçamento das listas e cards.</div></div>
              <Seg value={densidade} onChange={aplicaDensidade} options={[{ key: 'confortavel', label: 'Confortável' }, { key: 'compacto', label: 'Compacto' }]} />
            </div>
          </div>

          {/* Conta */}
          <div className="card setcard">
            <div className="sc-h"><span className="ic"><Svg>{ic.conta}</Svg></span><span className="t">Conta</span></div>
            <div className="setrow"><div className="rmain"><div className="t">Nome</div></div><input className="txtin" value={contaNome} onChange={(e) => setContaNome(e.target.value)} maxLength={80} /></div>
            <div className="setrow"><div className="rmain"><div className="t">E-mail</div><div className="s">Login via Google SSO</div></div><input className="txtin" defaultValue={email} readOnly /></div>
            <div className="setrow"><div className="rmain"><div className="t">Papel primário</div><div className="s">Define a tela-casa do Covil.</div></div>
              <select className="selin" value={contaPapel} onChange={(e) => setContaPapel(e.target.value as Papel)}>
                <option value="gestor_contas">Gestor de Contas</option>
                <option value="gestor_projetos">Gestor de Projetos</option>
                <option value="gestor_trafego">Gestor de Tráfego</option>
              </select>
            </div>
            <div className="setrow"><div className="rmain"><div className="t">Idioma</div></div><select className="selin" defaultValue="pt"><option value="pt">Português (BR)</option></select></div>
            <div className="setrow"><div className="rmain"><div className="t">Fuso horário</div></div><select className="selin" defaultValue="sp"><option value="sp">America/São_Paulo (BRT)</option></select></div>
          </div>

          {/* Notificações */}
          <div className="card setcard">
            <div className="sc-h"><span className="ic"><Svg>{ic.notif}</Svg></span><span className="t">Notificações</span></div>
            <div className="setrow"><div className="rmain"><div className="t">Estopim / SLA em risco</div><div className="s">Alerta quando uma Forja está esfriando ou apagando.</div></div><Toggle on={notif.sla} onChange={(v) => setNotif({ ...notif, sla: v })} /></div>
            <div className="setrow"><div className="rmain"><div className="t">Roda de Fogo</div><div className="s">Lembrete das reuniões e do briefing pendente.</div></div><Toggle on={notif.roda} onChange={(v) => setNotif({ ...notif, roda: v })} /></div>
            <div className="setrow"><div className="rmain"><div className="t">Briefing semanal pronto</div></div><Toggle on={notif.briefing} onChange={(v) => setNotif({ ...notif, briefing: v })} /></div>
            <div className="setrow"><div className="rmain"><div className="t">Menções da Faísca</div></div><Toggle on={notif.mencoes} onChange={(v) => setNotif({ ...notif, mencoes: v })} /></div>
            <div className="setrow"><div className="rmain"><div className="t">Canais</div><div className="s">Onde receber os avisos.</div></div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className={`chipsel${canais.inapp ? ' on' : ''}`} onClick={() => setCanais({ ...canais, inapp: !canais.inapp })}>In-app</button>
                <button className={`chipsel${canais.email ? ' on' : ''}`} onClick={() => setCanais({ ...canais, email: !canais.email })}>E-mail</button>
                <button className={`chipsel${canais.whatsapp ? ' on' : ''}`} onClick={() => setCanais({ ...canais, whatsapp: !canais.whatsapp })}>WhatsApp</button>
              </div>
            </div>
          </div>

          {/* Faísca & IA */}
          <div className="card setcard">
            <div className="sc-h"><span className="ic"><Svg>{ic.ia}</Svg></span><span className="t">Faísca &amp; IA</span><span className="s">Google Gemini</span></div>
            <div className="setrow"><div className="rmain"><div className="t">Modelo de ingestão</div><div className="s">Áudio, PDF e imagem (transcrição/extração).</div></div><select className="selin" defaultValue="flash"><option value="flash">Gemini 2.0 Flash</option><option value="pro">Gemini 1.5 Pro</option></select></div>
            <div className="setrow"><div className="rmain"><div className="t">Modelo de raciocínio</div><div className="s">Chat, briefing e plano de gargalos — tudo no Gemini (tier gratuito).</div></div><select className="selin" defaultValue="flash"><option value="flash">Gemini 2.0 Flash</option><option value="pro">Gemini 1.5 Pro</option></select></div>
            <div className="setrow"><div className="rmain"><div className="t">Voz da Faísca</div><div className="s">Responder por voz além do texto (TTS).</div></div><Toggle on={ia.voz} onChange={(v) => setIa({ ...ia, voz: v })} /></div>
            <div className="setrow"><div className="rmain"><div className="t">Cross-check em itens críticos</div><div className="s">Revalida a saída em itens sensíveis (ex.: extração do contrato).</div></div><Toggle on={ia.cross} onChange={(v) => setIa({ ...ia, cross: v })} /></div>
            <div className="setrow"><div className="rmain"><div className="t">Cache de contexto</div><div className="s">Reaproveita regras da marca e templates — reduz custo/latência.</div></div><Toggle on={ia.cache} onChange={(v) => setIa({ ...ia, cache: v })} /></div>
          </div>
        </div>

        {/* Integrações (full width) */}
        <div className="card setcard">
          <div className="sc-h"><span className="ic"><Svg>{ic.plug}</Svg></span><span className="t">Integrações</span></div>
          {integracoes.map((i) => (
            <div className="intg-row" key={i.nome}>
              <span className="iic">{i.sigla}</span>
              <div className="rmain"><div className="t">{i.nome}</div><div className="s">{i.nota}</div></div>
              <span className={`stbadge ${i.ok ? 'on' : 'off'}`}>{i.ok ? 'Conectado' : 'Desconectado'}</span>
              {i.sigla === 'GA' ? (
                google && !google.configurado ? (
                  <span className="s" style={{ color: 'var(--faint)', maxWidth: 150, textAlign: 'right' }}>Falta o OAuth do Google Cloud</span>
                ) : google?.conectado ? (
                  <button className="btn" onClick={desconectarGoogle}>Desconectar</button>
                ) : (
                  <a className="btn" href="/api/google/connect">Conectar</a>
                )
              ) : i.sigla === 'CU' ? (
                cuMsg ? (
                  <span className="s" style={{ color: cuOk ? 'var(--ember-hi)' : 'var(--risk)', maxWidth: 180, textAlign: 'right' }}>{cuMsg}</span>
                ) : (
                  <button className="btn" onClick={ativarClickup} disabled={cuLoading || !i.ok} title={!i.ok ? 'Falta o CLICKUP_API_TOKEN' : 'Registra o webhook pra sincronizar em tempo real'}>
                    {cuLoading ? 'Ativando…' : clickupRealtime ? 'Reativar tempo real' : 'Ativar tempo real'}
                  </button>
                )
              ) : (
                <button className="btn" disabled title="Em breve">{i.ok ? 'Gerenciar' : 'Conectar'}</button>
              )}
            </div>
          ))}
        </div>

        {/* Equipe & Acessos (full width) */}
        <div className="card setcard">
          <div className="sc-h"><span className="ic"><Svg>{ic.equipe}</Svg></span><span className="t">Equipe &amp; Acessos</span><span className="s">Admin</span></div>
          {team.length === 0 ? (
            <div className="s" style={{ color: 'var(--muted)', paddingTop: 6 }}>Adicione membros na allowlist (tabela membro).</div>
          ) : team.map((m) => (
            <div className="mrow" key={m.id}>
              <span className="avatar" style={{ width: 34, height: 34 }}>{iniciais(m.nome)}</span>
              <div className="rmain"><div className="t">{m.nome} {m.is_admin && <span className="badge admin" style={{ marginLeft: 4 }}>Admin</span>}</div><div className="s">{m.email}</div></div>
              <span className="badge ember">{PAPEL_LABEL[m.papel_primario]}</span>
              <button className="btn" disabled title="Gestão de papéis é feita por um admin (via allowlist)">Editar papéis</button>
            </div>
          ))}
        </div>

        <div className="set-grid">
          {/* Operação · Forja */}
          <div className="card setcard">
            <div className="sc-h"><span className="ic"><Svg>{ic.forja}</Svg></span><span className="t">Operação · Forja</span></div>
            <div className="setrow"><div className="rmain"><div className="t">SLA por fase</div><div className="s">Prazo de cada uma das 7 fases (alerta, não trava).</div></div>
              <div className="stepper"><button onClick={() => setSla(Math.max(1, sla - 1))}>−</button><span className="val">{sla} dias</span><button onClick={() => setSla(sla + 1)}>+</button></div>
            </div>
            <div className="setrow"><div className="rmain"><div className="t">Criar Estruturação ao cadastrar Cria</div><div className="s">1 Cria = 1 Estruturação, automática.</div></div><Toggle on={forja.auto} onChange={(v) => setForja({ ...forja, auto: v })} /></div>
            <div className="setrow"><div className="rmain"><div className="t">Início da Forja manual</div><div className="s">Avanço de fase por checklist; a IA calcula prazos ao confirmar o contrato.</div></div><Toggle on={forja.manual} onChange={(v) => setForja({ ...forja, manual: v })} /></div>
            <div className="setrow"><div className="rmain"><div className="t">Produto travado em "Estruturação"</div><div className="s">Produto único — sem escolha no cadastro.</div></div><Toggle on={forja.travado} onChange={(v) => setForja({ ...forja, travado: v })} /></div>
          </div>

          {/* Segurança & LGPD */}
          <div className="card setcard">
            <div className="sc-h"><span className="ic"><Svg>{ic.seg}</Svg></span><span className="t">Segurança &amp; LGPD</span></div>
            <div className="setrow"><div className="rmain"><div className="t">Autenticação em 2 fatores</div><div className="s">Além do Google SSO.</div></div><Toggle on={twofa} onChange={setTwofa} /></div>
            <div className="setrow"><div className="rmain"><div className="t">Sessões ativas</div><div className="s">Sai da sua conta nos outros aparelhos (mantém este).</div></div><button className="btn" onClick={encerrarOutras}>Encerrar outras</button></div>
            <div className="setrow"><div className="rmain"><div className="t">Retenção de dados</div><div className="s">Contratos e briefings enviados às APIs de IA.</div></div><select className="selin" defaultValue="12"><option value="6">6 meses</option><option value="12">12 meses</option><option value="24">24 meses</option></select></div>
            <div className="setrow"><div className="rmain"><div className="t">Consentimento LGPD registrado</div><div className="s">Base legal para tratar dados das Crias.</div></div><span className="stbadge on">Ativo</span></div>
            <div className="setrow"><div className="rmain"><div className="t">Meus dados</div></div><div style={{ display: 'flex', gap: 8 }}><button className="btn" onClick={exportarDados} disabled={exportando}>{exportando ? 'Exportando…' : 'Exportar'}</button><button className="btn" style={{ color: 'var(--risk)', borderColor: 'rgba(255,58,68,0.4)' }} onClick={excluirConta}>Excluir conta</button></div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
