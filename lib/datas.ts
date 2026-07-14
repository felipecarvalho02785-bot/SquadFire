// ─────────────────────────────────────────────────────────────
// SquadFire · Datas no fuso da squad (America/Sao_Paulo)
// ─────────────────────────────────────────────────────────────
// O servidor (Vercel) roda em UTC. Sem centralizar "hoje"/"agora" aqui, todo
// cálculo de data erra das ~21h à meia-noite (BRT): o SLA vira "atrasado" ~3h
// cedo, a contagem de dias da Forja pula, a saudação e a agenda pegam o dia
// errado. Brasília é UTC-3 o ano inteiro (sem horário de verão desde 2019).
const TZ = 'America/Sao_Paulo';

// 'AAAA-MM-DD' de hoje no fuso de Brasília.
export function hojeBRT(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

// Hora do dia (0–23) agora, em Brasília — pra saudação ("bom dia/boa noite").
export function horaBRT(d: Date = new Date()): number {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }).formatToParts(d);
  return Number(p.find((x) => x.type === 'hour')?.value ?? 0);
}

// Partes de calendário (ano, mês 0-based, dia) de um instante, no fuso de Brasília.
export function partesDataBRT(d: Date): { ano: number; mes: number; dia: number } {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const val = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return { ano: val('year'), mes: val('month') - 1, dia: val('day') };
}

// Diferença em dias civis entre uma data ('AAAA-MM-DD' ou ISO) e hoje (BRT).
// Positivo = a data está no passado. Neutro a fuso: compara a meia-noite UTC
// das duas datas civis.
export function diasDesdeBRT(iso: string): number {
  const alvo = Date.parse(iso.slice(0, 10) + 'T00:00:00Z');
  const hoje = Date.parse(hojeBRT() + 'T00:00:00Z');
  return Math.floor((hoje - alvo) / 86400000);
}

// Limites do dia de hoje (BRT) como instantes ISO — pra janelas de consulta
// (ex.: eventos "de hoje" no Google Agenda). Brasília = UTC-3.
export function limitesDoDiaBRT(): { ini: string; fim: string } {
  const hoje = hojeBRT();
  return {
    ini: new Date(`${hoje}T00:00:00-03:00`).toISOString(),
    fim: new Date(`${hoje}T23:59:59-03:00`).toISOString(),
  };
}
