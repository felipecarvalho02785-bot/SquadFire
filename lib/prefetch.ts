import { headers } from 'next/headers';

// True quando o request é um PREFETCH do roteador do Next (pré-aquecimento de
// aba), não uma navegação real. Usado pra pular efeitos colaterais (sync do
// ClickUp, geração de Lenhas) no prefetch — assim pré-aquecer é barato e não
// dispara escrita/rede por abas que o usuário nem abriu.
export async function ehPrefetch(): Promise<boolean> {
  try {
    const h = await headers();
    return h.get('next-router-prefetch') === '1' || h.get('purpose') === 'prefetch';
  } catch {
    return false;
  }
}
