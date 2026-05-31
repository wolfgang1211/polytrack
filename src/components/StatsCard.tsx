'use client';

interface Props {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
  gradient?: string;
  icon?: React.ReactNode;
  delay?: number;
}

export default function StatsCard({ label, value, sub, valueClass, gradient, icon, delay = 0 }: Props) {
  return (
    <div
      className="glass glass-hover gradient-border rounded-2xl p-5 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">{label}</p>
        {icon && (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: gradient ?? 'var(--vi-tint)', border: '1px solid var(--vi-border-xs)' }}>
            <span className="text-sm">{icon}</span>
          </div>
        )}
      </div>
      <p className={`text-2xl font-black tracking-tight ${valueClass ?? 'text-white'}`}>{value}</p>
      {sub && <p className="mt-1 text-[11px] text-white/30">{sub}</p>}
    </div>
  );
}
