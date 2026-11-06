import type { Metadata } from 'next';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Card, CardTitle } from '@/components/ui/card';
import { StateBanner } from '@/components/ui/states';
import { translate } from '@/i18n';
import { requirePageUser } from '@/permissions/require';
import { getSupervisionData, type CheckStatus } from '@/services/supervision/health';

export const metadata: Metadata = { title: translate('supervision.title') };

const dateFormatter = new Intl.DateTimeFormat('fr-SN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Africa/Dakar',
});

const TONE: Record<CheckStatus, NonNullable<BadgeProps['tone']>> = {
  ok: 'safe',
  warning: 'warning',
  error: 'danger',
};

const CHECKS = ['database', 'risk', 'jobs', 'weather', 'notifications'] as const;

export default async function SupervisionPage() {
  await requirePageUser('/back-office/supervision', ['ADMIN']);
  const { health, jobs, errors, failures } = await getSupervisionData();
  const details = 'details' in health ? health.details : null;
  const checks = health.checks as Partial<Record<(typeof CHECKS)[number], CheckStatus>>;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">{translate('supervision.title')}</h2>
        <p className="text-muted">{translate('supervision.intro')}</p>
      </div>
      <StateBanner
        kind={health.status === 'ok' ? 'success' : health.status === 'warning' ? 'info' : 'error'}
        title={translate(`supervision.status.${health.status}`)}
      />

      <Card className="space-y-3" data-testid="health-checks">
        <ul className="grid gap-2 sm:grid-cols-2">
          {CHECKS.map((check) => {
            const status = checks[check];
            return status ? (
              <li key={check} className="flex items-center justify-between gap-2">
                <span>{translate(`supervision.check.${check}`)}</span>
                <Badge tone={TONE[status]}>{translate(`supervision.level.${status}`)}</Badge>
              </li>
            ) : null;
          })}
        </ul>
        {details && (
          <p className="text-muted text-sm">
            {translate('supervision.lastRisk')} :{' '}
            {details.lastRiskRunAt
              ? `${dateFormatter.format(new Date(details.lastRiskRunAt))} (${details.lastRiskRunTrigger})`
              : translate('supervision.never')}{' '}
            · {translate('supervision.lastJob')} :{' '}
            {details.lastJobAt
              ? dateFormatter.format(new Date(details.lastJobAt))
              : translate('supervision.never')}
          </p>
        )}
        <p className="text-muted text-sm">
          {translate('supervision.modes')} : {translate('supervision.notificationsMode')}{' '}
          {health.notificationsMode} · {translate('supervision.demoMode')}{' '}
          {translate(health.demoMode ? 'supervision.on' : 'supervision.off')}
        </p>
      </Card>

      <section aria-labelledby="jobs" className="space-y-2">
        <h3 id="jobs" className="font-heading text-xl font-semibold">
          {translate('supervision.jobs')}
        </h3>
        {jobs.length === 0 ? (
          <p className="text-muted text-sm">{translate('supervision.jobsEmpty')}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {jobs.map((job) => (
              <li key={job.id} className="flex flex-wrap items-center gap-2">
                <Badge tone={job.ok === false ? 'danger' : job.ok ? 'safe' : 'neutral'}>
                  {job.name}
                </Badge>
                <span>{dateFormatter.format(job.startedAt)}</span>
                <span className="text-muted min-w-0 break-all">
                  {job.error ?? JSON.stringify(job.summary ?? {})}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-2">
          <CardTitle>{translate('supervision.errors')}</CardTitle>
          {errors.length === 0 ? (
            <p className="text-muted text-sm">{translate('supervision.errorsEmpty')}</p>
          ) : (
            <ul className="space-y-1 text-sm break-words" data-testid="error-log">
              {errors.map((e) => (
                <li key={e.id}>
                  <span className="font-medium">{e.source}</span> ·{' '}
                  {dateFormatter.format(e.createdAt)} — {e.message}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="space-y-2">
          <CardTitle>{translate('supervision.failures')}</CardTitle>
          {failures.length === 0 ? (
            <p className="text-muted text-sm">{translate('supervision.failuresEmpty')}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {failures.map((f) => (
                <li key={f.id}>
                  {dateFormatter.format(f.createdAt)} · {f.channel} · {f.alert.title} — {f.error}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
