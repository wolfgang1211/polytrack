interface LogoProps {
  /** pixel size of the mark */
  size?: number;
  className?: string;
}

/**
 * AlphaBoard mark — single-piece, stylized "A" matching the refreshed brand mark.
 * Soft lavender → deeper purple vertical gradient, clean geometry, no outline.
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
        <linearGradient id="abGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9d5ff" />
          <stop offset="0.45" stopColor="#c084fc" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>

      {/* Single-piece stylized A: trunk + legs unified, with a clean aperture */}
      <path
        d="M36 10 L28 38 L18 72 L32 72 L40 48 L48 72 L62 72 L52 38 Z"
        fill="url(#abGrad)"
      />

      {/* Optional light apex highlight for depth */}
      <path
        d="M36 10 L34 18 L38 18 Z"
        fill="rgba(255,255,255,0.25)"
      />
    </svg>
  );
}
