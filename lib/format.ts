export function brl(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export function statusLabel(s: string): string {
  return { ativa: 'Ativa', pausada: 'Pausada', encerrada: 'Encerrada' }[s] ?? s;
}

export function faseLabel(semana: number | null | undefined): string {
  if (!semana) return 'Backlog · pré-forja';
  const nomes = [
    'Alinhamento / Boas-vindas',
    'Diagnóstico 360',
    'Treinamento Comercial',
    'Consultoria Comercial',
    'Implementação CRM + IA',
    'Auditoria de Mídia',
    'Auditoria Criativa',
  ];
  return `Fase ${semana} · ${nomes[semana - 1] ?? ''}`;
}

export function iniciais(nome: string): string {
  return nome.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

// Saúde da Forja de uma Cria (para o pill da carteira).
export function saudeDaCria(c: { status: string; em_risco: boolean; clickup_semana: number | null }): {
  label: string;
  kind: 'good' | 'warn' | 'crit' | 'dim';
} {
  if (c.status === 'pausada') return { label: 'Cinzas', kind: 'dim' };
  if (c.status === 'encerrada') return { label: 'Temperada', kind: 'dim' };
  if (!c.clickup_semana) return { label: 'Pré-Forja', kind: 'dim' };
  if (c.em_risco) return { label: 'Apagando', kind: 'crit' };
  return { label: 'Em Chamas', kind: 'good' };
}
