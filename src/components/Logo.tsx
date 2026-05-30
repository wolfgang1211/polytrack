interface LogoProps {
  /** pixel size of the square mark */
  size?: number;
  className?: string;
}

/**
 * AlphaBoard mark — a glassy rounded tile holding three rising candlestick bars
 * with an upward arrow accent. Reads as "markets + momentum" at any size.
 * Inline SVG so it stays crisp and needs no network request.
 */
export default function Logo({ size = 36, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="AlphaBoard"
    >
      <defs>
        <linearGradient id="ptTile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1a1242" />
          <stop offset="1" stopColor="#06121f" />
        </linearGradient>
        <linearGradient id="ptBar" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#7c3aed" />
          <stop offset="0.55" stopColor="#6366f1" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
        <linearGradient id="ptArrow" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="1" stopColor="#67e8f9" />
        </linearGradient>
        <filter id="ptGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Tile */}
      <rect x="3" y="3" width="74" height="74" rx="22" fill="url(#ptTile)" />
      <rect x="3.75" y="3.75" width="72.5" height="72.5" rx="21.25"
        fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" />
      {/* top sheen */}
      <rect x="3" y="3" width="74" height="34" rx="22" fill="rgba(255,255,255,0.05)" />

      {/* Three rising bars */}
      <g filter="url(#ptGlow)">
        <rect x="20" y="46" width="9" height="16" rx="3" fill="url(#ptBar)" opacity="0.85" />
        <rect x="34" y="36" width="9" height="26" rx="3" fill="url(#ptBar)" opacity="0.92" />
        <rect x="48" y="26" width="9" height="36" rx="3" fill="url(#ptBar)" />
      </g>

      {/* Upward arrow accent */}
      <g filter="url(#ptGlow)">
        <polyline points="22,40 36,30 46,35 58,20"
          fill="none" stroke="url(#ptArrow)" strokeWidth="4.5"
          strokeLinecap="round" strokeLinejoin="round" />
        <path d="M52 19 L60 18 L59 26"
          fill="none" stroke="url(#ptArrow)" strokeWidth="4.5"
          strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
