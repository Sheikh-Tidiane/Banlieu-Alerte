import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertStatusBadge, AlertTypeBadge } from '@/components/backoffice/alert-status-badge';
import { DemoBadge, RiskBadge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState, StateBanner } from '@/components/ui/states';
import { translate } from '@/i18n';
import { resolveNotificationMode } from '@/lib/notifications';
import { badgeLevel } from '@/lib/risk/explain';
import { cn } from '@/lib/utils/cn';
import { STAFF_ROLES } from '@/permissions/policies';
import { requirePageUser } from '@/permissions/require';
import { ALERT_STATUSES, listStaffAlerts } from '@/services/alerts/read';

export const metadata: Metadata = { title: translate('backoffice.alerts.title') };

const dateFormatter = new Intl.DateTimeFormat('fr-SN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Africa/Dakar',
});

type Props = { searchParams: Promise<{ statut?: string }> };

export default async function StaffAlertsPage({ searchParams }: Props) {
  const user = await requirePageUser('/back-office/alertes', STAFF_ROLES);
  const { statut } = await searchParams;
  const status = ALERT_STATUSES.find((s) => s === statut);
  const alerts = await listStaffAlerts(user, status);
  const filters = [undefined, ...ALERT_STATUSES] as const;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">{translate('backoffice.alerts.title')}</h2>
          <p className="text-muted">{translate('backoffice.alerts.intro')}</p>
        </div>
        <Link href="/back-office/alertes/nouvelle" className={buttonVariants()}>
          <Plus aria-hidden="true" />
          {translate('backoffice.alerts.new')}
        </Link>
      </div>
      {resolveNotificationMode() === 'simulation' && (
        <StateBanner kind="info" title={translate('notifications.simulationMode')} />
      )}
      <nav aria-label={translate('backoffice.alerts.type')} className="flex flex-wrap gap-2">
        {filters.map((value) => (
          <Link
            key={value ?? 'all'}
            href={value ? `/back-office/alertes?statut=${value}` : '/back-office/alertes'}
            aria-current={value === status ? 'page' : undefined}
            className={cn(
              'min-h-touch rounded-pill inline-flex items-center border px-4 text-sm font-medium',
              value === status ? 'border-primary bg-primary/10 text-primary' : 'border-line',
            )}
          >
            {value
              ? translate(`backoffice.alerts.status.${value}`)
              : translate('backoffice.alerts.all')}
          </Link>
        ))}
      </nav>
      {alerts.length === 0 ? (
        <EmptyState title={translate('backoffice.alerts.empty')} />
      ) : (
        <ul className="grid gap-3">
          {alerts.map((alert) => (
            <li key={alert.id}>
              <Link
                href={`/back-office/alertes/${alert.id}`}
                className="rounded-card border-line bg-surface-raised hover:border-primary block space-y-2 border p-4"
                data-testid="staff-alert"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <AlertStatusBadge status={alert.status} />
                  <AlertTypeBadge type={alert.type} />
                  <RiskBadge level={badgeLevel(alert.level)} />
                  {alert.isDemo && <DemoBadge />}
                </span>
                <span className="font-heading block font-semibold">{alert.title}</span>
                <span className="text-muted block text-sm">
                  {alert.neighborhoods.map((n) => n.neighborhood.name).join(', ')} ·{' '}
                  {translate(`backoffice.alerts.origin.${alert.origin}`)} ·{' '}
                  {dateFormatter.format(alert.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
