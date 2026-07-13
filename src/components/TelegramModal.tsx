'use client';

import { useEffect } from 'react';
import { useLanguage } from '@/components/LanguageProvider';

const TELEGRAM_URL = 'https://t.me/polymarketTRalerts';

export default function TelegramModal({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl p-7 animate-scale-in"
        style={{
          background: 'linear-gradient(135deg, rgba(17,17,27,0.97) 0%, rgba(20,20,35,0.97) 100%)',
          border: '1px solid rgba(34,197,94,0.25)',
          boxShadow: '0 0 60px rgba(34,197,94,0.12), 0 25px 50px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/25 hover:text-white/60 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Icon */}
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}>
          <svg className="h-7 w-7 text-green-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.478 13.9l-2.95-.924c-.643-.204-.657-.643.136-.953l11.57-4.46c.537-.194 1.006.131.66.658z"/>
          </svg>
        </div>

        {/* Text */}
        <h2 className="mb-2 text-lg font-black text-white">{t('telegram.title')}</h2>
        <p className="mb-6 text-sm leading-relaxed text-white/55">
          {t('telegram.description')}
        </p>

        {/* CTA */}
        <a
          href={TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white transition-all hover:scale-[1.02] hover:brightness-110"
          style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 24px rgba(34,197,94,0.35)' }}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.478 13.9l-2.95-.924c-.643-.204-.657-.643.136-.953l11.57-4.46c.537-.194 1.006.131.66.658z"/>
          </svg>
          {t('telegram.cta')}
        </a>
      </div>
    </div>
  );
}
