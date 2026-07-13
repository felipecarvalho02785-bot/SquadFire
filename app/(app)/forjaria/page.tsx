import { getCurrentMembro } from '@/lib/auth';
import { getBrigada } from '@/lib/data/brigada';
import { isSupabaseConfigured } from '@/lib/env';
import { ForjariaClient } from './ForjariaClient';

export const dynamic = 'force-dynamic';

export default async function ForjariaPage() {
  const [membro, team] = await Promise.all([
    isSupabaseConfigured ? getCurrentMembro() : Promise.resolve(null),
    getBrigada(),
  ]);

  const integracoes = [
    { sigla: 'CU', nome: 'ClickUp', nota: 'Briefing vira comentário na task do cliente; Lenhas viram tarefas.', ok: !!process.env.CLICKUP_API_TOKEN },
    { sigla: 'SB', nome: 'Supabase', nota: 'Banco de dados e Storage de contratos/documentos.', ok: isSupabaseConfigured },
    { sigla: 'AN', nome: 'Faísca · Claude', nota: 'Raciocínio e escrita dos briefings.', ok: !!process.env.ANTHROPIC_API_KEY },
    { sigla: 'GM', nome: 'Faísca · Gemini', nota: 'Transcrição de áudio e leitura de contrato.', ok: !!(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) },
    { sigla: 'GD', nome: 'Google Drive', nota: 'Biblioteca de roteiros e criativos.', ok: false },
    { sigla: 'WA', nome: 'WhatsApp · Evolution API', nota: 'SLA dos grupos e disparos.', ok: false },
  ];

  return (
    <ForjariaClient
      membro={membro ? { id: membro.id, nome: membro.nome, email: membro.email, is_admin: membro.is_admin, papel_primario: membro.papel_primario, papeis: [membro.papel_primario] } : null}
      integracoes={integracoes}
      team={team}
    />
  );
}
