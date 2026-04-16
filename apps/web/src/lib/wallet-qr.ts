const DEFAULT_PUBLIC_ORIGIN = 'https://urban-eats-production.up.railway.app';

function normalizeOrigin(origin: string): string {
  const withScheme = /^https?:\/\//i.test(origin) ? origin : `https://${origin}`;
  return withScheme.replace(/\/+$/, '');
}

export function getWalletQrOrigin(fallbackOrigin?: string): string {
  return normalizeOrigin(
    process.env.FRONTEND_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.SERVER_URL ||
      process.env.VERCEL_URL ||
      fallbackOrigin ||
      DEFAULT_PUBLIC_ORIGIN
  );
}

export function buildWalletQrValue(clientId: string, fallbackOrigin?: string): string {
  return `${getWalletQrOrigin(fallbackOrigin)}/scan/${encodeURIComponent(clientId)}`;
}
