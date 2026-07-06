/* Minimal Upstash Redis REST client (no dependency). All helpers are
   graceful no-ops when UPSTASH_REDIS_REST_URL / _TOKEN are not configured,
   so features degrade cleanly instead of erroring. */

const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export const kvEnabled = Boolean(URL_ && TOKEN);

async function cmd<T = unknown>(parts: (string | number)[]): Promise<T | null> {
  if (!kvEnabled) return null;
  try {
    const res = await fetch(`${URL_}/${parts.map(p => encodeURIComponent(String(p))).join('/')}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.result ?? null) as T;
  } catch {
    return null;
  }
}

export const kvGet = (key: string) => cmd<string>(['GET', key]);
export const kvSet = (key: string, value: string, ttlSec?: number) =>
  ttlSec ? cmd(['SET', key, value, 'EX', ttlSec]) : cmd(['SET', key, value]);
export const kvLPush = (key: string, value: string) => cmd<number>(['LPUSH', key, value]);
export const kvLTrim = (key: string, start: number, stop: number) => cmd(['LTRIM', key, start, stop]);
export const kvLRange = (key: string, start: number, stop: number) => cmd<string[]>(['LRANGE', key, start, stop]);
