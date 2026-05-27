// Polymarket builder code — her dış link ve CLOB API isteğine eklenir
export const BUILDER_CODE =
  '0x3de582e958417cb3a2ed5ac595fae482af3dc1706d2a683d0a0a7230d4c2aa7e';

const POLYMARKET = 'https://polymarket.com';

/**
 * Polymarket profil URL'si, builder code ile
 */
export function profileUrl(address: string): string {
  return `${POLYMARKET}/profile/${address}?ref=${BUILDER_CODE}`;
}

/**
 * Polymarket event/piyasa URL'si, builder code ile
 * eventSlug varsa kullanır, yoksa slug'a fallback yapar
 */
export function marketUrl(eventSlug?: string, slug?: string): string {
  const path = eventSlug ? `/event/${eventSlug}` : slug ? `/market/${slug}` : '';
  return `${POLYMARKET}${path}?ref=${BUILDER_CODE}`;
}

/**
 * Herhangi bir Polymarket URL'sine builder code query param ekler
 * Zaten ref parametresi varsa üzerine yazar
 */
export function withBuilderCode(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set('ref', BUILDER_CODE);
    return u.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}ref=${BUILDER_CODE}`;
  }
}
