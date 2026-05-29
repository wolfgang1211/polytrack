interface LogoProps {
  /** pixel size of the square mark */
  size?: number;
  className?: string;
}

/**
 * PolyTrack mark — "P" with a rising trendline running through it.
 * Inline SVG so it inherits crisp rendering at any size and needs no network request.
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
      aria-label="PolyTrack"
    >
      <defs>
        <linearGradient id="ptMark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="76" height="76" rx="20" fill="#0b1220" />
      {/* P */}
      <path
        d="M30 60 V28 a10 10 0 0 1 10 -10 h5 a11 11 0 0 1 0 22 h-15"
        fill="none"
        stroke="url(#ptMark)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* rising trendline */}
      <polyline
        points="26,56 38,44 48,50 60,30"
        fill="none"
        stroke="#34d399"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="60" cy="30" r="4.5" fill="#34d399" />
    </svg>
  );
}
