'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { outboundEvent } from '@/lib/outboundAnalytics';
import { pageGroup, permitsAnalytics } from '@/lib/funnelSchema';

function sendTelemetry(endpoint: string, payload: unknown) {
  const body = JSON.stringify(payload);
  if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }))) return;
  void fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
}

export function emitPageView(pathname: string): boolean {
  const page = pageGroup(pathname);
  if (!page || document.visibilityState !== 'visible' || !permitsAnalytics(navigator)) return false;
  try { sendTelemetry('/api/analytics/pageview', { event: 'page_view', page }); return true; }
  catch { return false; }
}

/** Delegated handler includes regular links, keyboard activation and middle
 * clicks without preventing navigation or attaching user/wallet identifiers. */
export function handleOutboundClick(event: MouseEvent) {
  if (!permitsAnalytics(navigator)) return;
  if (event.type === 'auxclick' && event.button !== 1) return;
  if (event.type === 'click' && event.button !== 0) return;
  if (!(event.target instanceof Element)) return;
  const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
  if (!anchor) return;
  const payload = outboundEvent(anchor.href);
  if (!payload) return;
  const page = pageGroup(window.location?.pathname ?? '');
  try {
    window.dispatchEvent(new CustomEvent('alphaboard:outbound', { detail: payload }));
    sendTelemetry('/api/analytics/outbound', page ? { ...payload, page } : payload);
  } catch { /* Telemetry must never prevent an outbound navigation. */ }
}

export default function OutboundAnalytics() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || !pageGroup(pathname) || !permitsAnalytics(navigator)) return;
    let live = true, enabled = false, emitted = false;
    const emit = () => {
      if (live && enabled && !emitted && emitPageView(pathname)) emitted = true;
    };
    document.addEventListener('visibilitychange', emit);
    // No public production collection is silently activated by a local flag.
    void fetch('/api/analytics/status', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(status => { enabled = status?.enabled === true && status?.scope === 'local-qa'; emit(); })
      .catch(() => {});
    return () => { live = false; document.removeEventListener('visibilitychange', emit); };
  }, [pathname]);
  useEffect(() => {
    document.addEventListener('click', handleOutboundClick, true);
    document.addEventListener('auxclick', handleOutboundClick, true);
    return () => {
      document.removeEventListener('click', handleOutboundClick, true);
      document.removeEventListener('auxclick', handleOutboundClick, true);
    };
  }, []);
  return null;
}
