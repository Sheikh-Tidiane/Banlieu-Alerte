import type { Metadata } from 'next';
import Image from 'next/image';
import { PageShell } from '@/components/layout/page-shell';
import { Badge } from '@/components/ui/badge';
import { translate, type TranslationKey } from '@/i18n';
import { cn } from '@/lib/utils/cn';

export const metadata: Metadata = { title: translate('brand.title') };

type Surface = 'light' | 'dark' | 'brand';

const surfaces: Record<Surface, string> = {
  light: 'border-line bg-surface-raised text-ink',
  dark: 'border-ink bg-ink text-surface',
  brand: 'border-primary bg-primary text-primary-foreground',
};

const variants: { key: TranslationKey; file: string; surface: Surface; w: number; h: number }[] = [
  {
    key: 'brand.variants.horizontal',
    file: 'logo-horizontal.svg',
    surface: 'light',
    w: 220,
    h: 48,
  },
  {
    key: 'brand.variants.horizontalDark',
    file: 'logo-horizontal-dark.svg',
    surface: 'dark',
    w: 220,
    h: 48,
  },
  { key: 'brand.variants.vertical', file: 'logo-vertical.svg', surface: 'light', w: 167, h: 90 },
  {
    key: 'brand.variants.verticalDark',
    file: 'logo-vertical-dark.svg',
    surface: 'dark',
    w: 167,
    h: 90,
  },
  { key: 'brand.variants.symbol', file: 'symbol.svg', surface: 'light', w: 80, h: 80 },
  { key: 'brand.variants.symbolDark', file: 'symbol-dark.svg', surface: 'dark', w: 80, h: 80 },
  {
    key: 'brand.variants.monoBlack',
    file: 'logo-horizontal-mono-black.svg',
    surface: 'light',
    w: 220,
    h: 48,
  },
  {
    key: 'brand.variants.monoWhite',
    file: 'logo-horizontal-mono-white.svg',
    surface: 'brand',
    w: 220,
    h: 48,
  },
];

const sizes = [
  { file: 'favicon-16.png', size: 16 },
  { file: 'favicon-32.png', size: 32 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
];

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <h2 id={id} className="text-2xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function BrandPage() {
  return (
    <PageShell className="space-y-12">
      <div className="space-y-4">
        <Badge tone="safe">{translate('brand.chosen')}</Badge>
        <h1 className="text-3xl font-bold sm:text-4xl">{translate('brand.title')}</h1>
        <Image
          src="/brand/logo-horizontal.svg"
          alt={translate('app.name')}
          width={366}
          height={80}
          className="h-auto max-w-full"
          priority
        />
        <p className="text-muted max-w-2xl text-lg">{translate('brand.lead')}</p>
      </div>

      <Section id="variants" title={translate('brand.variantsTitle')}>
        <ul className="grid gap-4 sm:grid-cols-2">
          {variants.map(({ key, file, surface, w, h }) => (
            <li
              key={file}
              className={cn('rounded-card flex flex-col gap-4 border p-5', surfaces[surface])}
            >
              <p className="text-sm font-semibold opacity-80">{translate(key)}</p>
              <div className="grid min-h-28 place-items-center">
                <Image
                  src={`/brand/${file}`}
                  alt=""
                  width={w}
                  height={h}
                  className="h-auto max-w-full"
                />
              </div>
              <code className="text-xs opacity-80">public/brand/{file}</code>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="sizes" title={translate('brand.sizesTitle')}>
        <p className="text-muted max-w-2xl">{translate('brand.sizesLead')}</p>
        <div className="rounded-card border-line bg-surface-raised flex flex-wrap items-end gap-6 border p-5">
          {sizes.map(({ file, size }) => (
            <figure key={file} className="flex max-w-full flex-col items-center gap-2">
              {/* Images non optimisées : on montre les fichiers réels, pixel pour pixel. */}
              <Image
                src={`/brand/${file}`}
                alt=""
                width={size}
                height={size}
                unoptimized
                className="h-auto max-w-full"
              />
              <figcaption className="text-muted text-xs">{size} px</figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section id="app-icons" title={translate('brand.appIconsTitle')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <figure className="rounded-card border-line bg-surface-raised flex flex-col items-center gap-3 border p-5">
            <Image
              src="/brand/icon-maskable-192.png"
              alt=""
              width={144}
              height={144}
              unoptimized
              className="rounded-pill"
            />
            <figcaption className="text-muted text-sm">{translate('brand.maskable')}</figcaption>
          </figure>
          <figure className="rounded-card border-line bg-surface-raised flex flex-col items-center gap-3 border p-5">
            <Image
              src="/brand/apple-touch-icon.png"
              alt=""
              width={144}
              height={144}
              unoptimized
              className="border-line rounded-[32px] border"
            />
            <figcaption className="text-muted text-sm">{translate('brand.apple')}</figcaption>
          </figure>
          <figure className="rounded-card border-line bg-surface-raised flex flex-col gap-3 border p-5 sm:col-span-2">
            <Image
              src="/brand/og-image.png"
              alt=""
              width={1200}
              height={630}
              unoptimized
              className="rounded-control border-line h-auto w-full border"
            />
            <figcaption className="text-muted text-sm">{translate('brand.ogImage')}</figcaption>
          </figure>
        </div>
      </Section>

      <Section id="rules" title={translate('brand.rulesTitle')}>
        <ul className="list-disc space-y-2 pl-5">
          {(['source', 'clearSpace', 'minSize', 'backgrounds'] as const).map((rule) => (
            <li key={rule}>{translate(`brand.rules.${rule}`)}</li>
          ))}
        </ul>
      </Section>

      <Section id="concepts" title={translate('brand.conceptsTitle')}>
        <ul className="grid gap-4 sm:grid-cols-3">
          {(['a', 'b', 'c'] as const).map((id) => (
            <li
              key={id}
              className={cn(
                'rounded-card bg-surface-raised flex flex-col items-center gap-3 border p-5 text-center',
                id === 'b' ? 'border-primary border-2' : 'border-line',
              )}
            >
              <Image
                src={`/brand/concepts/concept-${id}-light.svg`}
                alt=""
                width={64}
                height={64}
              />
              <p className="font-semibold">{translate(`brand.concepts.${id}.name`)}</p>
              <p className="text-muted text-sm">{translate(`brand.concepts.${id}.intent`)}</p>
            </li>
          ))}
        </ul>
      </Section>
    </PageShell>
  );
}
