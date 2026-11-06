import { BellRing, Map as MapIcon, Megaphone } from 'lucide-react';
import Link from 'next/link';
import { AccountMenu } from '@/components/auth/account-menu';
import { Logo } from '@/components/brand/logo';
import { EmergencyButton } from '@/components/emergency/emergency-button';
import { NetworkStatus } from '@/components/offline/network-status';
import { translate } from '@/i18n';
import { cn } from '@/lib/utils/cn';

const FOOTER_LINKS = [
  { href: '/carte-risque', label: 'riskMap.title' },
  { href: '/alertes', label: 'nav.alerts' },
  { href: '/statistiques', label: 'stats.title' },
  { href: '/qualite-indice', label: 'quality.title' },
  { href: '/apprendre', label: 'nav.learn' },
  { href: '/urgence', label: 'nav.emergency' },
] as const;

const navLink =
  'min-h-touch rounded-control text-ink hover:bg-line/60 inline-flex items-center gap-2 px-3 font-medium [&_svg]:size-5';

/** Gabarit commun : en-tête (logo, navigation, Urgence), état du réseau, contenu centré. */
export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <>
      {/* Mode démonstration (D-063) : visible sur toutes les pages, pour le jury comme pour l'équipe. */}
      {process.env.DEMO_MODE === 'true' && (
        <p className="bg-accent text-ink px-4 py-1.5 text-center text-sm font-semibold" role="note">
          {translate('demo.banner')}
        </p>
      )}
      <header className="border-line bg-surface-raised border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2 sm:px-6">
          <Link href="/" className="min-h-touch flex shrink-0 items-center">
            {/* Symbole seul sur petit écran : la place va au bouton Urgence et au compte. */}
            <Logo variant="symbol" height={32} priority className="sm:hidden" />
            <Logo height={28} priority className="hidden sm:block" />
          </Link>
          <nav aria-label={translate('nav.mainNav')} className="flex items-center gap-1">
            <Link href="/carte" className={navLink}>
              <MapIcon aria-hidden="true" />
              <span className="hidden sm:inline">{translate('nav.map')}</span>
              <span className="sr-only sm:hidden">{translate('nav.map')}</span>
            </Link>
            <Link href="/alertes" className={navLink}>
              <BellRing aria-hidden="true" />
              <span className="hidden sm:inline">{translate('nav.alerts')}</span>
              <span className="sr-only sm:hidden">{translate('nav.alerts')}</span>
            </Link>
            <Link href="/signaler" className={cn(navLink, 'hidden md:inline-flex')}>
              <Megaphone aria-hidden="true" />
              {translate('nav.report')}
            </Link>
            <AccountMenu />
            <EmergencyButton className="px-3" />
          </nav>
        </div>
      </header>
      <NetworkStatus />
      <main className={cn('mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12', className)}>
        {children}
      </main>
      <footer className="border-line bg-surface-raised border-t">
        <nav
          aria-label={translate('nav.footer')}
          className="mx-auto flex max-w-6xl flex-wrap gap-x-4 gap-y-1 px-4 py-4 sm:px-6"
        >
          {FOOTER_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-muted hover:text-ink min-h-touch inline-flex items-center text-sm underline-offset-2 hover:underline"
            >
              {translate(label)}
            </Link>
          ))}
        </nav>
      </footer>
    </>
  );
}
