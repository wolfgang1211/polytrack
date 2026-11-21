/** Microsoft Clarity bootstrap helpers. The project id is read from NEXT_PUBLIC_CLARITY_ID, never hard-coded. */

const CLARITY_ID = /^[a-z0-9]{6,20}$/i;

/** Returns a trimmed, validated Clarity project id, or null when it is missing or malformed. */
export function clarityProjectId(raw: string | null | undefined): string | null {
  const id = (raw ?? '').trim();
  return CLARITY_ID.test(id) ? id : null;
}

/** Clarity runs only in production builds (Vercel production or preview), never in local dev or tests. */
export function shouldLoadClarity({ nodeEnv, id }: { nodeEnv: string | undefined; id: string | null }): boolean {
  return nodeEnv === 'production' && id !== null;
}

/**
 * Official Clarity tag, wrapped so it does nothing when the visitor sends Do Not Track or
 * Global Privacy Control (same rule as AlphaBoard's own telemetry). Text inputs stay masked:
 * Clarity masks them by default and this tag sets no unmask, identity or custom tags.
 */
export function clarityBootstrap(id: string): string {
  if (clarityProjectId(id) !== id) throw new Error('Invalid Clarity project id');
  return `(function(n){if(n&&(n.doNotTrack==='1'||n.globalPrivacyControl===true))return;`
    + `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};`
    + `t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;`
    + `y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script",${JSON.stringify(id)});`
    + `})(typeof navigator!=='undefined'?navigator:null);`;
}
