import Image from 'next/image';

interface LogoProps {
  /** pixel size of the mark */
  size?: number;
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
