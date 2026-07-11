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
