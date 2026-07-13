'use client';

import { useLanguage } from '@/components/LanguageProvider';
import type { Locale } from '@/lib/i18n';

const OPTIONS: Array<{ locale: Locale; label: string }> = [
  { locale: 'en', label: 'EN' },
  { locale: 'tr', label: 'TR' },
];

export default function LanguageToggle() {
  const { locale, setLocale } = useLanguage();

  return (
    <div
      className="flex items-center gap-0.5 rounded-xl p-0.5"
      style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.09)' }}
      aria-label="Language selector"
    >
      {OPTIONS.map(option => {
        const active = option.locale === locale;
        return (
          <button
            key={option.locale}
            type="button"
            onClick={() => setLocale(option.locale)}
            className={`relative rounded-lg px-2 py-1 text-[10px] font-black tracking-wide transition-all ${active ? 'text-white' : 'text-white/35 hover:text-white/70'}`}
            aria-pressed={active}
          >
            {active && (
              <span
                className="absolute inset-0 rounded-lg"
                style={{ background: 'var(--vi-tint)', border: '1px solid var(--vi-border)' }}
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
