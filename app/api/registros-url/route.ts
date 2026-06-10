import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { buildRegistrosUrl } from '@/lib/cross-app';

export async function GET() {
  const session = await getServerSession(authOptions);
  const email   = session?.user?.email ?? null;

  if (!email) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  try {
    return NextResponse.json({ url: buildRegistrosUrl(email) });
  } catch {
    return NextResponse.json({ error: 'Configuración incompleta' }, { status: 500 });
  }
}
