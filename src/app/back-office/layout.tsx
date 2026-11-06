import type { Metadata } from 'next';
import { BackofficeNav } from '@/components/backoffice/backoffice-nav';
import { PageShell } from '@/components/layout/page-shell';
import { Badge } from '@/components/ui/badge';
import { translate, type TranslationKey } from '@/i18n';
import { canInvite, canManageZones, canViewAudit, STAFF_ROLES } from '@/permissions/policies';
import { requirePageUser } from '@/permissions/require';
import { isDemoMode } from '@/services/demo/simulator';

export const metadata: Metadata = {
  title: {
    default: translate('backoffice.title'),
    template: `%s · ${translate('backoffice.title')}`,
  },
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default async function BackofficeLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser('/back-office', STAFF_ROLES);

  const items: { href: string; label: TranslationKey }[] = [
    { href: '/back-office', label: 'backoffice.nav.dashboard' },
    { href: '/back-office/signalements', label: 'backoffice.nav.reports' },
    { href: '/back-office/moderation', label: 'backoffice.nav.moderation' },
    { href: '/back-office/alertes', label: 'backoffice.nav.alerts' },
    { href: '/back-office/indice', label: 'backoffice.nav.risk' },
    { href: '/back-office/episodes', label: 'backoffice.nav.episodes' },
    { href: '/back-office/curage', label: 'backoffice.nav.cleanup' },
    ...(canManageZones(user)
      ? [{ href: '/back-office/zones', label: 'backoffice.nav.zones' as const }]
      : []),
    ...(canInvite(user)
      ? [{ href: '/back-office/utilisateurs', label: 'backoffice.nav.users' as const }]
      : []),
    ...(canViewAudit(user)
      ? [
          { href: '/back-office/journal', label: 'backoffice.nav.audit' as const },
          { href: '/back-office/supervision', label: 'backoffice.nav.supervision' as const },
        ]
      : []),
    ...(user.role === 'ADMIN' && isDemoMode()
      ? [{ href: '/back-office/demo', label: 'backoffice.nav.demo' as const }]
      : []),
  ];

  const scope: TranslationKey =
    user.role === 'ADMIN'
      ? 'backoffice.scopeAll'
      : user.role === 'AGENT'
        ? 'backoffice.scopeCommune'
        : 'backoffice.scopeNeighborhoods';

  return (
    <PageShell className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="sr-only">{translate('backoffice.title')}</h1>
        <Badge tone="primary">{translate(`roles.${user.role}`)}</Badge>
        <span className="text-muted text-sm">
          {translate('backoffice.scope')} : {translate(scope)}
        </span>
      </div>
      <BackofficeNav items={items} />
      {children}
    </PageShell>
  );
}
