import { NextResponse } from 'next/server';
import { getCurrentMembro } from '@/lib/auth';
import { getDriveBibliotecaCached } from '@/lib/data/biblioteca';
import { getServiceAccountToken } from '@/lib/google/service-account';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 15 * 1024 * 1024; // não proxeia arquivo gigante (thumbs são leves)

// Proxy de preview das IMAGENS da Biblioteca no Drive. Faz streaming do arquivo
// usando a conta de serviço — assim a imagem aparece no app mesmo sem ser
// pública. SEGURANÇA: só serve IDs que a varredura já reconheceu como parte da
// biblioteca (não é um proxy aberto pro Drive) e exige membro logado.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const membro = await getCurrentMembro();
  if (!membro) return new NextResponse('não autorizado', { status: 401 });

  const { id } = await params;
  const lib = await getDriveBibliotecaCached();
  const item = lib.itens.find((i) => i.id === id);
  if (!item) return new NextResponse('arquivo fora da biblioteca', { status: 404 });
  if (!item.ehImagem) return new NextResponse('preview indisponível', { status: 415 });
  if (item.tamanho && item.tamanho > MAX_BYTES) return new NextResponse('arquivo grande demais', { status: 413 });

  const token = await getServiceAccountToken('https://www.googleapis.com/auth/drive.readonly');
  if (!token) return new NextResponse('credencial indisponível', { status: 503 });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  let res: Response;
  try {
    res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(item.id)}?alt=media`, {
      headers: { authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    });
  } catch {
    return new NextResponse('falha ao buscar', { status: 502 });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok || !res.body) return new NextResponse('falha ao buscar', { status: 502 });

  return new NextResponse(res.body, {
    headers: {
      'content-type': item.mimeType || 'image/jpeg',
      'cache-control': 'private, max-age=3600',
    },
  });
}
