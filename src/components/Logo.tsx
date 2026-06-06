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
  return (
    <Image
      src="/alphaboard-logo-mark-purple-512.png"
      alt="AlphaBoard"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
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
