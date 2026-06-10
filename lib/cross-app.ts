import { createHmac } from 'crypto';

export function buildRegistrosUrl(email: string): string {
  const secret       = process.env.CROSS_APP_SECRET;
  const registrosUrl = process.env.CROSS_APP_REGISTROS_URL;
  if (!secret || !registrosUrl) throw new Error('CROSS_APP_SECRET o CROSS_APP_REGISTROS_URL no configurados');

  const ts  = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', secret).update(`${email}:${ts}`).digest('hex');

  const url = new URL('/auto-login-inv', registrosUrl);
  url.searchParams.set('email', email);
  url.searchParams.set('ts',    String(ts));
  url.searchParams.set('sig',   sig);
  return url.toString();
}
