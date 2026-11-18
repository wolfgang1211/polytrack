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
 * The original artwork is white. In the light theme only the logo image itself is
 * inverted to black (scoped to this element; never a whole-UI filter). Artwork,
 * shape and alt text are unchanged.
 */
const LIGHT_THEME_INVERT = '[[data-theme=light]_&]:invert';

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
        src="/alphaboard-mark-white-512.png"
        alt="AlphaBoard"
        width={size}
        height={size}
        className={LIGHT_THEME_INVERT}
        style={{ width: '84%', height: '84%', objectFit: 'contain' }}
      />
    </span>
  );
}

export function WordmarkLogo({ height = 30, className }: WordmarkLogoProps) {
  const width = Math.round(height * 4.25);

  return (
    <Image
      src="/alphaboard-wordmark-white.png"
      alt="AlphaBoard"
      width={width}
      height={height}
      className={`${LIGHT_THEME_INVERT}${className ? ` ${className}` : ''}`}
      style={{ width, height, objectFit: 'contain' }}
    />
  );
}
