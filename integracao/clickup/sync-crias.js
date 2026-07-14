// ─────────────────────────────────────────────────────────────
// SquadFire · Integração ClickUp — sync das Crias (Squad 08)
// ─────────────────────────────────────────────────────────────
// Lê a lista-mestre, filtra Squad 08 e mapeia cada task → objeto `cria`.
// A gravação no banco (upsert por clickup_task_id) fica a cargo de quem
// consome mapTaskToCria() — este módulo é puro/testável e não conhece o DB.

import { CLICKUP } from './config.js';
import { getTasksListaMestre } from './client.js';

// ── helpers de leitura de custom fields ──────────────────────
function findField(task, fieldId) {
  return (task.custom_fields || []).find((f) => f.id === fieldId);
}

// Campo "drop down": value é o índice da opção selecionada.
function dropdownOption(field) {
  if (!field || field.value === undefined || field.value === null) return null;
  const opts = field.type_config?.options || [];
  // value pode vir como orderindex (number) ou id (string)
  const byOrder = opts.find((o) => o.orderindex === field.value);
  const byId = opts.find((o) => o.id === field.value);
  return byOrder || byId || null;
}

export function getSquad(task) {
  const opt = dropdownOption(findField(task, CLICKUP.fields.squad.id));
  return opt ? { label: opt.name, orderIndex: opt.orderindex, id: opt.id } : null;
}

export function isSquad08(task) {
  const squad = getSquad(task);
  if (!squad) return false;
  return (
    squad.id === CLICKUP.fields.squad.squad08OptionId ||
    squad.orderIndex === CLICKUP.fields.squad.squad08OrderIndex
  );
}

// Semana (orderindex 0 = Semana 1) → fase da Forja (1–7). Sem valor → null (backlog).
export function getSemana(task) {
  const opt = dropdownOption(findField(task, CLICKUP.fields.semana.id));
  if (!opt) return null;
  return typeof opt.orderindex === 'number' ? opt.orderindex + 1 : null;
}

// Status do ClickUp → status_cria (enum do banco: ativa | pausada | encerrada).
// A distinção fina (churn × finalizada) NÃO cabe no enum — vai em `motivo`,
// preservada nos metadados pra relatórios; a coluna `status` recebe só o enum.
function mapStatus(task) {
  const raw = (task.status?.status || '').toLowerCase();
  if (raw.includes('churn') || raw.includes('cancel'))
    return { status: 'encerrada', motivo: 'churn', backlog: false };
  if (raw.includes('final') || raw.includes('conclu'))
    return { status: 'encerrada', motivo: 'finalizada', backlog: false };
  if (raw.includes('paus') || raw.includes('hold') || raw.includes('espera'))
    return { status: 'pausada', motivo: null, backlog: false };
  if (raw.includes('backlog') || raw.includes('lead') || raw.includes('prospec'))
    return { status: 'ativa', motivo: null, backlog: true };
  // onboarding / execução / em andamento…
  return { status: 'ativa', motivo: null, backlog: false };
}

// "Data inicial" = start_date nativo da task (quando ocorreu a reunião/início).
// Converte o timestamp (ms) pra AAAA-MM-DD no fuso de Brasília.
export function dataInicioDaTask(task) {
  const ms = task.start_date ? Number(task.start_date) : null;
  if (!ms || !Number.isFinite(ms)) return null;
  // en-CA formata como AAAA-MM-DD; timeZone garante a data-calendário certa.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

// ── mapeamento ClickUp → cria ────────────────────────────────
export function mapTaskToCria(task) {
  const squad = getSquad(task);
  const semana = getSemana(task);
  const { status, motivo, backlog } = mapStatus(task);
  return {
    clickup_task_id: task.id,
    nome_cliente: task.name,
    clickup_squad: squad?.label ?? null,
    clickup_semana: backlog ? null : semana,
    // fase da Forja: sem Semana OU status backlog → pré-forja (sem prazos)
    fase: backlog ? null : semana,
    status, // enum status_cria: ativa | pausada | encerrada
    backlog,
    // Data inicial (start_date) → vira data_inicio da Forja no consumidor.
    data_inicio: backlog ? null : dataInicioDaTask(task),
    // metadados úteis pro consumidor (não necessariamente colunas)
    _source: {
      list_id: CLICKUP.listaMestre.listId,
      clickup_status: task.status?.status ?? null,
      motivo, // churn | finalizada | null — distinção fora do enum
      url: task.url ?? null,
    },
  };
}

// Puxa a lista-mestre, filtra Squad 08 e devolve os objetos `cria`.
export async function syncCrias({ includeClosed = true } = {}) {
  const tasks = await getTasksListaMestre({ includeClosed });
  const squad08 = tasks.filter(isSquad08);
  const crias = squad08.map(mapTaskToCria);
  return {
    total_tasks: tasks.length,
    squad08_count: squad08.length,
    crias,
  };
}
