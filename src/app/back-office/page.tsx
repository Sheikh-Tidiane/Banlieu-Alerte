import Link from 'next/link';
import { EscalationRulesForm } from '@/components/backoffice/escalation-rules-form';
import { LateBadge } from '@/components/backoffice/late-badge';
import { MarkNotificationsReadButton } from '@/components/subscriptions/subscription-actions';
import { ReportTypeIcon } from '@/components/reports/report-type-icon';
import { DemoBadge } from '@/components/ui/badge';
import { Card, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { translate } from '@/i18n';
import { STAFF_ROLES } from '@/permissions/policies';
import { requirePageUser } from '@/permissions/require';
import { getDashboard } from '@/services/backoffice/dashboard';
import { listEscalationRules } from '@/services/escalation/escalation';
import { listMyUserNotifications } from '@/services/notifications/user-notifications';

const dateFormatter = new Intl.DateTimeFormat('fr-SN', { dateStyle: 'medium', timeStyle: 'short' });

export default async function DashboardPage() {
  const user = await requirePageUser('/back-office', STAFF_ROLES);
  const [data, notifications, rules] = await Promise.all([
    getDashboard(user),
    listMyUserNotifications(user, 10),
    user.role === 'ADMIN' ? listEscalationRules() : Promise.resolve(null),
  ]);
  const unread = notifications.filter((n) => !n.read);

  const tiles = [
    {
      label: translate('backoffice.dashboard.new'),
      value: data.newCount,
      href: '/back-office/signalements?status=NEW',
    },
    {
      label: translate('backoffice.dashboard.inProgress'),
      value: data.inProgress,
      href: '/back-office/signalements?status=VERIFIED,ASSIGNED,IN_PROGRESS',
    },
    {
      label: translate('backoffice.dashboard.resolved'),
      value: data.resolved,
      href: '/back-office/signalements?status=RESOLVED',
    },
    {
      label: translate('backoffice.dashboard.openAbuse'),
      value: data.openAbuse,
      href: '/back-office/moderation',
    },
  ];

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-semibold">{translate('backoffice.nav.dashboard')}</h2>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.label}>
            <Link
              href={tile.href as '/back-office'}
              className="rounded-card border-line bg-surface-raised shadow-soft hover:border-primary block border p-4"
            >
              <span className="font-heading text-primary block text-3xl font-bold">
                {tile.value}
              </span>
              <span className="text-muted text-sm">{tile.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <Card>
        <p className="text-muted text-sm">
          {translate('backoffice.dashboard.medianFirstResponse')}
        </p>
        <p className="font-heading text-2xl font-bold">
          {data.medianFirstResponseHours === null
            ? translate('backoffice.dashboard.noData')
            : `${data.medianFirstResponseHours} ${translate('backoffice.dashboard.hours')}`}
        </p>
        {data.sampleSize > 0 && <p className="text-muted text-xs">n = {data.sampleSize}</p>}
      </Card>

      {unread.length > 0 && (
        <Card className="space-y-3" data-testid="staff-notifications">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{translate('subscribe.myNotifications')}</CardTitle>
            <MarkNotificationsReadButton endpoint="/api/account/followup" />
          </div>
          <ul className="space-y-1 text-sm">
            {unread.map((n) => (
              <li key={n.id}>
                {n.link ? (
                  <Link href={n.link as '/'} className="text-primary underline">
                    {n.title}
                  </Link>
                ) : (
                  n.title
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section aria-labelledby="late" className="space-y-3">
        <h3 id="late" className="text-xl font-semibold">
          {translate('backoffice.dashboard.lateTitle')}
        </h3>
        {data.late.length === 0 ? (
          <EmptyState title={translate('backoffice.dashboard.lateEmpty')} />
        ) : (
          <ul className="space-y-2">
            {data.late.map((report) => (
              <li key={report.trackingCode}>
                <Link
                  href={`/back-office/signalements/${report.trackingCode}`}
                  className="rounded-card border-line bg-surface-raised hover:border-primary flex flex-wrap items-center gap-3 border p-3"
                >
                  <ReportTypeIcon type={report.type} className="text-water size-5" />
                  <span className="font-semibold">{report.trackingCode}</span>
                  <span className="text-muted text-sm">
                    {report.neighborhood?.name ?? translate('map.unidentified')} ·{' '}
                    {dateFormatter.format(report.createdAt)}
                  </span>
                  <LateBadge level={report.escalationLevel} />
                  {report.isDemo && <DemoBadge />}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {rules && (
        <Card className="space-y-3">
          <CardTitle>{translate('escalation.rulesTitle')}</CardTitle>
          <p className="text-muted text-sm">{translate('escalation.rulesHint')}</p>
          <EscalationRulesForm rules={rules} />
        </Card>
      )}
    </div>
  );
}
