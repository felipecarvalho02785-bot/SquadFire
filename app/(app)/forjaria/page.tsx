import { getCurrentMembro } from '@/lib/auth';
import { getBrigada } from '@/lib/data/brigada';
import { getSupabaseServer } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import { googleConfigurado } from '@/lib/google/oauth';
import { statusGoogle } from '@/lib/google/calendar';
import { ForjariaClient } from './ForjariaClient';

export const dynamic = 'force-dynamic';

export default async function ForjariaPage() {
  const [membro, team] = await Promise.all([
    isSupabaseConfigured ? getCurrentMembro() : Promise.resolve(null),
    getBrigada(),
  ]);
  const gStatus = membro ? await statusGoogle(membro.id) : { conectado: false, email: null };
  const google = { conectado: gStatus.conectado, email: gStatus.email, configurado: googleConfigurado() };

  // Preferências já salvas no banco (fonte da verdade; o cliente cai pro
  // localStorage só quando não há banco/membro).
  let prefs: Record<string, unknown> | null = null;
  if (membro) {
    const supabase = await getSupabaseServer();
    const { data } = await supabase.from('preferencia').select('dados').eq('membro_id', membro.id).maybeSingle();
    prefs = ((data as { dados: Record<string, unknown> } | null)?.dados) ?? null;
  }

  const integracoes = [
    { sigla: 'CU', nome: 'ClickUp', nota: 'Briefing vira comentário na task do cliente; Lenhas viram tarefas.', ok: !!process.env.CLICKUP_API_TOKEN },
    { sigla: 'SB', nome: 'Supabase', nota: 'Banco de dados e Storage de contratos/documentos.', ok: isSupabaseConfigured },
    { sigla: 'GM', nome: 'Faísca · Gemini', nota: 'Toda a IA da Faísca: chat, transcrição de áudio e escrita dos briefings.', ok: !!(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) },
    { sigla: 'GA', nome: 'Google Agenda', nota: google.conectado ? `Conectado${google.email ? ` · ${google.email}` : ''} — Rodas de Fogo e prazos no seu calendário.` : 'Sincronize Rodas de Fogo e prazos das fases com o seu Google Agenda.', ok: google.conectado },
    { sigla: 'WA', nome: 'WhatsApp · Evolution API', nota: 'SLA dos grupos e disparos.', ok: false },
  ];

  return (
    <ForjariaClient
      membro={membro ? { id: membro.id, nome: membro.nome, email: membro.email, is_admin: membro.is_admin, papel_primario: membro.papel_primario, papeis: [membro.papel_primario] } : null}
      integracoes={integracoes}
      team={team}
      google={google}
      prefs={prefs}
    />
  );
}
