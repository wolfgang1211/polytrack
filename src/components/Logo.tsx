import Image from 'next/image';

interface LogoProps {
  /** pixel size of the mark */
  size?: number;
  className?: string;
}

interface WordmarkLogoProps {
  height?: number;
  className?: string;
}

/**
 * AlphaBoard logo mark sourced from the uploaded AlphaBoard-04 artwork.
 */
export default function Logo({ size = 36, className }: LogoProps) {
  // The source artwork bleeds to the edges (the glyph touches the canvas border),
  // which looks clipped at small sizes. Render it inside a slightly larger,
  // transparent box so the mark gets a little breathing room on every side.
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Image
        src="/alphaboard-logo-mark-purple-512.png"
        alt="AlphaBoard"
        width={size}
        height={size}
        style={{ width: '84%', height: '84%', objectFit: 'contain' }}
      />
    </span>
  );
}

export function WordmarkLogo({ height = 30, className }: WordmarkLogoProps) {
  const width = Math.round(height * 4.25);

  return (
    <Image
      src="/alphaboard-logo-wordmark.png"
      alt="AlphaBoard"
      width={width}
      height={height}
      className={className}
      style={{ width, height, objectFit: 'contain' }}
    />
  );
}
