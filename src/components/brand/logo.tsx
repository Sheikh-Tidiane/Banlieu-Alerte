import Image from 'next/image';
import { translate } from '@/i18n';

// Le logo vient toujours des fichiers de public/brand/ (docs/MARQUE.md) :
// jamais redessiné, étiré ni recoloré dans un composant.
const variants = {
  horizontal: { src: '/brand/logo-horizontal.svg', ratio: 293 / 64 },
  'horizontal-dark': { src: '/brand/logo-horizontal-dark.svg', ratio: 293 / 64 },
  vertical: { src: '/brand/logo-vertical.svg', ratio: 178 / 96 },
  symbol: { src: '/brand/symbol.svg', ratio: 1 },
} as const;

export type LogoVariant = keyof typeof variants;

export function Logo({
  variant = 'horizontal',
  height = 32,
  priority = false,
  className,
}: {
  variant?: LogoVariant;
  height?: number;
  priority?: boolean;
  className?: string;
}) {
  const { src, ratio } = variants[variant];
  return (
    <Image
      src={src}
      alt={translate('app.name')}
      width={Math.round(height * ratio)}
      height={height}
      priority={priority}
      className={className}
    />
  );
}
