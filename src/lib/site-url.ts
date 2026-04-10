const DEFAULT_SITE_URL = 'https://aviationweather.vercel.app';

export function getSiteUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const baseUrl = envUrl && envUrl.length > 0 ? envUrl : DEFAULT_SITE_URL;

  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}