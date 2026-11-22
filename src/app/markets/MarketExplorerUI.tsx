import type { ReactNode } from 'react';

/* Shared, stateless presentational frame for the market explorer views (Polymarket and Kalshi).
   Only structure and neutral theme styling live here; provider data, units and formatting stay in each client.
   data-explorer-* attributes are stable structural hooks for tests, not styling hooks. */

const cx = (...c: (string | undefined)[]) => c.filter(Boolean).join(' ');

export function ExplorerHeader({ id, title, provider, description, children }: {
  id?: string; title: ReactNode; provider: ReactNode; description: ReactNode; children?: ReactNode;
}) {
  return (
    <header data-explorer-header="" className="flex min-w-0 flex-col gap-3">
      <div className="min-w-0">
        <p className="mb-3 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold text-ink/60"
          style={{ border: '1px solid rgba(var(--ink-rgb),0.12)' }}>
          {provider}
        </p>
        <h1 id={id} className="text-3xl font-black leading-none tracking-tight text-ink sm:text-4xl">{title}</h1>
        <div className="mt-3 max-w-2xl text-sm text-ink/55">{description}</div>
      </div>
      {children}
    </header>
  );
}

export function ExplorerCard({ children, className }: { children: ReactNode; className?: string }) {
  return <article data-explorer-card="" className={cx('glass flex min-w-0 flex-col rounded-2xl', className)}>{children}</article>;
}

export function ExplorerToolbar({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <div data-explorer-toolbar="" role="group" aria-label={label}
      className={cx('flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between', className)}>
      {children}
    </div>
  );
}

/** Native disclosure: closed unless `open` is passed. The summary is plain text, never a link or button.
    `flex` on <summary> hides the native marker, so a decorative chevron (CSS-only, via group-open) replaces it. */
export function ExplorerDetails({ summary, children, open, className }: {
  summary: ReactNode; children: ReactNode; open?: boolean; className?: string;
}) {
  return (
    <details data-explorer-details="" open={open} className={cx('group min-w-0', className)}>
      <summary className="flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-lg text-xs font-semibold text-ink/60 hover:text-ink/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
        <svg data-explorer-chevron="" aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          className="h-3 w-3 shrink-0 transition-transform group-open:rotate-90">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {summary}
      </summary>
      {children}
    </details>
  );
}
