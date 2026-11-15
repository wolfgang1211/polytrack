'use client';

import { useEffect, useState } from 'react';
import type { FunnelSummary } from '@/lib/funnelStore';

const number = (value: number) => value.toLocaleString('en-US');
const rate = (value: number | null) => value == null ? 'Unavailable' : value.toFixed(1);

export function FunnelReport({ data }: { data: FunnelSummary }) {
  const maximum = Math.max(1, ...data.daily.map(row => row.views ?? 0));
  return <div className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-3">
      {[['Observed page views', number(data.totals.views)], ['Outbound clicks', number(data.totals.clicks)], ['Clicks per 100 views', rate(data.totals.clicksPer100Views)]].map(([label,value]) =>
        <div key={label} className="glass rounded-2xl p-5"><p className="text-xs text-white/50">{label}</p><p className="mt-2 text-3xl font-bold text-violet-200">{value}</p></div>)}
    </div>
    <p className="text-xs leading-relaxed text-white/50">Event counts, not unique visitors or conversions. Multiple clicks per view are possible, so the ratio can exceed 100. DNT/GPC visitors are excluded; delivery is best-effort. No Builder-attributed volume is inferred.</p>
    {data.totals.views === 0 && data.totals.clicks === 0 && <p className="glass rounded-xl p-4 text-sm text-white/60">No events observed in this range. Storage is available; this is not an estimate of total site traffic.</p>}
    <section className="glass rounded-2xl p-5" aria-labelledby="daily-funnel-title">
      <h2 id="daily-funnel-title" className="font-semibold">Daily trend <span className="text-xs font-normal text-white/40">UTC · observed events</span></h2>
      <div className="mt-5 space-y-4">{data.daily.map(row => <div key={row.day} className="grid gap-2 sm:grid-cols-[100px_1fr_160px] sm:items-center">
        <span className="font-mono text-xs text-white/60">{row.day}</span>
        {row.coverage === 'not-collected' ? <span className="text-xs text-white/35">Not collected</span> :
          <div className="h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-violet-400" style={{width:`${(row.views ?? 0) / maximum * 100}%`}} /></div>}
        <span className="text-xs text-white/50">{row.views === null ? 'No coverage' : `${number(row.views)} views · ${number(row.clicks ?? 0)} clicks`}</span>
      </div>)}</div>
      <p className="mt-5 text-xs text-white/35">Collection started {data.collectionStartedAt.replace('T',' ').replace('Z',' UTC')}. Earlier dates are unknown, not zero. Collection uptime and complete delivery are not guaranteed.</p>
    </section>
    <details className="glass rounded-2xl p-5" open>
      <summary className="cursor-pointer font-semibold">Page categories</summary>
      <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm">
        <thead className="text-xs text-white/40"><tr><th scope="col" className="pb-3">Page</th><th scope="col">Views</th><th scope="col">Clicks</th><th scope="col">Clicks / 100 views</th></tr></thead>
        <tbody>{data.pages.filter(row => row.views > 0 || row.clicks > 0).map(row => <tr key={row.page} className="border-t border-white/5"><th scope="row" className="py-3 font-normal text-white/75">{row.page}</th><td>{number(row.views)}</td><td>{number(row.clicks)}</td><td>{rate(row.clicksPer100Views)}</td></tr>)}</tbody>
      </table></div>
    </details>
    <details className="glass rounded-2xl p-5">
      <summary className="cursor-pointer font-semibold">Placement breakdown</summary>
      <p className="mt-3 text-xs text-white/40">Click counts only. Placement impressions are not measured, so a placement-specific CTR is unavailable.</p>
      <ul className="mt-3 space-y-3">{data.placements.map(row => <li key={`${row.page}:${row.placement}:${row.kind}`} className="flex flex-wrap justify-between gap-2 border-t border-white/5 pt-3 text-sm">
        <span className="text-white/60">{row.page} · {row.placement} <span className="text-white/35">({row.kind})</span></span><span className="font-semibold">{number(row.clicks)} clicks</span>
      </li>)}</ul>
      {data.placements.length === 0 && <p className="mt-3 text-xs text-white/40">No outbound clicks observed.</p>}
    </details>
  </div>;
}

export default function AnalyticsDashboard() {
  const [days,setDays] = useState(7);
  const [reload,setReload] = useState(0);
  const [data,setData] = useState<FunnelSummary | null>(null);
  const [loading,setLoading] = useState(true);
  const [failed,setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    void fetch(`/api/analytics/summary?days=${days}`, {cache:'no-store'})
      .then(async response => {
        if (!response.ok) throw new Error('Analytics unavailable');
        const body = await response.json();
        if (body?.scope !== 'local-qa' || !Array.isArray(body.daily) || !Array.isArray(body.pages) || !Array.isArray(body.placements)
          || !Number.isSafeInteger(body.totals?.views) || !Number.isSafeInteger(body.totals?.clicks)) throw new Error('Invalid analytics response');
        if (live) { setData(body); setFailed(false); }
      }).catch(() => { if(live) {setData(null);setFailed(true);} })
      .finally(() => { if(live) setLoading(false); });
    return () => {live=false;};
  }, [days,reload]);
  const retry = () => {setLoading(true);setFailed(false);setReload(value=>value+1);};
  return <div className="mx-auto max-w-5xl space-y-6">
    <header><p className="text-xs uppercase tracking-widest text-violet-300">Local operator view</p><h1 className="mt-2 text-3xl font-bold">Daily funnel</h1><p className="mt-3 text-sm leading-relaxed text-white/55">Local QA traffic only. No production visitors measured. No cookies, user identifiers, wallet addresses, complete URLs, or referral values are stored.</p></header>
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor="analytics-days" className="text-sm text-white/60">Range</label>
      <select id="analytics-days" value={days} onChange={event=>{setLoading(true);setFailed(false);setData(null);setDays(Number(event.target.value));}} className="rounded-lg border border-white/10 bg-[#151121] px-3 py-2 text-sm">{[7,14,30].map(day=><option key={day} value={day}>{day} days</option>)}</select>
      <button onClick={retry} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-violet-200">Refresh</button>
    </div>
    {loading && <p role="status" className="glass rounded-2xl p-6 text-white/50">Loading observed events…</p>}
    {!loading && failed && <div role="alert" className="glass rounded-2xl p-6"><h2 className="font-semibold">Analytics unavailable</h2><p className="mt-2 text-sm text-white/50">This view requires the explicitly enabled local SQLite collector. Disabled storage or a read failure is not shown as zero traffic.</p><button onClick={retry} className="mt-4 text-sm text-violet-300 underline">Try again</button></div>}
    {!loading && data && <FunnelReport data={data} />}
  </div>;
}
