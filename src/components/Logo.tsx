interface LogoProps {
  /** pixel size of the mark */
  size?: number;
  className?: string;
}

/**
 * AlphaBoard mark — a clean, free-standing "A" (alpha) glyph in two-tone purple.
 * No background tile: just the geometric letterform, matching the brand mockup.
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
        <linearGradient id="abLeft" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a855f7" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="abRight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d8b4fe" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
      </defs>

      {/* Right leg (lighter) — drawn first so the left leg overlaps at the apex */}
      <path
        d="M42 12 L66 70 L54 70 L34 22 Z"
        fill="url(#abRight)"
      />
      {/* Left leg (darker) */}
      <path
        d="M38 12 L14 70 L26 70 L46 22 Z"
        fill="url(#abLeft)"
      />
      {/* Crossbar */}
      <rect x="26" y="46" width="28" height="10" rx="3" fill="url(#abLeft)" />
    </svg>
  );
}
