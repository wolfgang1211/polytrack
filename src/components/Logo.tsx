interface LogoProps {
  /** pixel size of the square mark */
  size?: number;
  className?: string;
}

/**
 * AlphaBoard mark — a purple gradient tile holding a sharp upward "A" peak
 * (the alpha). Minimal, geometric, reads cleanly at any size. Inline SVG so it
 * stays crisp and needs no network request.
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
        <linearGradient id="abTile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="0.55" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
        <linearGradient id="abPeak" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ede9fe" />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
      </defs>

      {/* Tile */}
      <rect x="3" y="3" width="74" height="74" rx="22" fill="url(#abTile)" />
      {/* top sheen */}
      <rect x="3" y="3" width="74" height="34" rx="22" fill="rgba(255,255,255,0.10)" />
      <rect x="3.75" y="3.75" width="72.5" height="72.5" rx="21.25"
        fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />

      {/* Alpha "A" peak — two ascending strokes + crossbar */}
      <g
        fill="none"
        stroke="url(#abPeak)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 56 L40 24 L58 56" />
        <path d="M31 46 L49 46" strokeWidth="6" />
      </g>
    </svg>
  );
}
