import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertCard } from '@/components/alerts/alert-card';
import { ApproveAlertForm, ReasonActionForm } from '@/components/backoffice/alert-editor';
import { AlertStatusBadge, AlertTypeBadge } from '@/components/backoffice/alert-status-badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { StateBanner } from '@/components/ui/states';
import { translate } from '@/i18n';
import { resolveNotificationMode } from '@/lib/notifications';
import { describeFactor } from '@/lib/risk/explain';
import type { FactorKey, FactorResult } from '@/lib/risk/types';
import { toDakarInput } from '@/lib/utils/dakar-time';
import { STAFF_ROLES } from '@/permissions/policies';
import { requirePageUser } from '@/permissions/require';
import { getStaffAlert, listAlertableNeighborhoods, toPublicAlert } from '@/services/alerts/read';
import { ServiceError } from '@/services/errors';

export const metadata: Metadata = { title: translate('backoffice.alerts.title') };

const dateFormatter = new Intl.DateTimeFormat('fr-SN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Africa/Dakar',
});

type Props = { params: Promise<{ id: string }> };

export default async function StaffAlertPage({ params }: Props) {
  const { id } = await params;
  const user = await requirePageUser(`/back-office/alertes/${id}`, STAFF_ROLES);

  let detail: Awaited<ReturnType<typeof getStaffAlert>>;
  try {
    detail = await getStaffAlert(user, id);
  } catch (error) {
    if (error instanceof ServiceError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
  const { alert, deliveries, failures, canAct, targets } = detail;
  const neighborhoods = await listAlertableNeighborhoods(user);
  const simulated = resolveNotificationMode() === 'simulation';
  const prediction = alert.riskPrediction;
  const predictionFactors = prediction
    ? (prediction.factors as { factors: FactorResult[]; topFactors: FactorKey[] })
    : null;

  return (
    <div className="space-y-6">
      <Link href="/back-office/alertes" className={buttonVariants({ variant: 'ghost' })}>
        <ArrowLeft aria-hidden="true" />
        {translate('backoffice.alerts.back')}
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <AlertStatusBadge status={alert.status} />
        <AlertTypeBadge type={alert.type} />
      </div>
      <h2 className="text-2xl font-semibold">{alert.title}</h2>
      {simulated && <StateBanner kind="info" title={translate('notifications.simulationMode')} />}
      {!canAct && <StateBanner kind="info" title={translate('backoffice.alerts.readOnly')} />}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="order-2 space-y-6 lg:order-1">
          <section aria-labelledby="preview" className="space-y-2">
            <h3 id="preview" className="font-heading text-lg font-semibold">
              {translate('backoffice.alerts.preview')}
            </h3>
            <AlertCard alert={toPublicAlert(alert)} />
          </section>

          {prediction && predictionFactors && (
            <Card className="space-y-2">
              <CardTitle>{translate('backoffice.alerts.prediction')}</CardTitle>
              <p className="text-sm">
                {translate('alertsPage.score')} {prediction.score ?? '–'}{' '}
                {translate('alertsPage.outOf')} · {prediction.horizonHours} h ·{' '}
                {translate('alertsPage.ruleVersion')} v{prediction.ruleVersion.number}
                {prediction.weatherFetchedAt &&
                  ` · ${translate('alertsPage.weatherFetchedAt')} ${dateFormatter.format(prediction.weatherFetchedAt)}`}
              </p>
              <ul className="list-disc pl-5 text-sm">
                {predictionFactors.topFactors.map((key) => {
                  const factor = predictionFactors.factors.find((f) => f.key === key);
                  return factor ? <li key={key}>{describeFactor(factor)}</li> : null;
                })}
              </ul>
            </Card>
          )}

          <Card className="space-y-3">
            <CardTitle>{translate('backoffice.alerts.details')}</CardTitle>
            <dl className="grid gap-1 text-sm">
              <div>
                <dt className="inline font-medium">
                  {translate('backoffice.alerts.createdBy')} :{' '}
                </dt>
                <dd className="inline">
                  {alert.createdBy
                    ? `${alert.createdBy.name} (${translate(`roles.${alert.createdBy.role}`)})`
                    : translate('backoffice.alerts.system')}
                </dd>
              </div>
              <div>
                <dt className="inline font-medium">
                  {translate('backoffice.alerts.createdAt')} :{' '}
                </dt>
                <dd className="inline">{dateFormatter.format(alert.createdAt)}</dd>
              </div>
              <div>
                <dt className="inline font-medium">{translate('backoffice.alerts.type')} : </dt>
                <dd className="inline">{translate(`backoffice.alerts.origin.${alert.origin}`)}</dd>
              </div>
              {alert.scheduledAt && (
                <div>
                  <dt className="inline font-medium">
                    {translate('backoffice.alerts.scheduledAt')} :{' '}
                  </dt>
                  <dd className="inline">{dateFormatter.format(alert.scheduledAt)}</dd>
                </div>
              )}
            </dl>
          </Card>

          <section aria-labelledby="decisions" className="space-y-2">
            <h3 id="decisions" className="font-heading text-lg font-semibold">
              {translate('backoffice.alerts.decisions')}
            </h3>
            {alert.approvals.length === 0 ? (
              <p className="text-muted text-sm">{translate('backoffice.alerts.decisionsEmpty')}</p>
            ) : (
              <ol className="space-y-2" data-testid="alert-decisions">
                {alert.approvals.map((approval) => {
                  const fields = (approval.changes as { fields?: string[] } | null)?.fields ?? [];
                  return (
                    <li
                      key={approval.id}
                      className="rounded-control border-line border p-3 text-sm"
                    >
                      <p className="font-medium">
                        {translate(`backoffice.alerts.decision${approval.decision}`)}{' '}
                        {approval.approver.name} ({translate(`roles.${approval.approver.role}`)}) ·{' '}
                        {dateFormatter.format(approval.createdAt)}
                      </p>
                      {approval.reason && <p>{approval.reason}</p>}
                      {fields.length > 0 && (
                        <p className="text-muted">
                          {translate('backoffice.alerts.changedFields')} : {fields.join(', ')}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <section aria-labelledby="deliveries" className="space-y-2">
            <h3 id="deliveries" className="font-heading text-lg font-semibold">
              {translate('backoffice.alerts.deliveries')}
            </h3>
            {deliveries.length === 0 ? (
              <p className="text-muted text-sm">{translate('backoffice.alerts.deliveriesEmpty')}</p>
            ) : (
              <ul className="space-y-1 text-sm" data-testid="alert-deliveries">
                {deliveries.map((d) => (
                  <li key={`${d.channel}-${d.status}-${d.mode}`}>
                    {translate(`backoffice.alerts.channel${d.channel}`)} :{' '}
                    <span className="font-semibold">{d.count}</span>{' '}
                    {translate(`backoffice.alerts.delivery${d.status}`)} ({d.mode})
                  </li>
                ))}
              </ul>
            )}
            {failures.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-semibold">{translate('backoffice.alerts.failures')}</p>
                <ul className="text-danger list-disc pl-5 text-sm">
                  {failures.map((f) => (
                    <li key={f.id}>{f.error}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>

        {canAct && (
          <aside className="order-1 space-y-4 lg:order-2">
            {alert.status === 'PENDING_APPROVAL' && (
              <>
                <Card className="space-y-3">
                  <CardTitle>{translate('backoffice.alerts.approveTitle')}</CardTitle>
                  <ApproveAlertForm
                    id={alert.id}
                    neighborhoods={neighborhoods}
                    initial={{
                      type: alert.type,
                      level: alert.level,
                      issuerName: alert.issuerName,
                      title: alert.title,
                      messageFr: alert.messageFr,
                      messageWo: alert.messageWo ?? '',
                      woReviewed: alert.woReviewed,
                      advice: alert.advice ?? '',
                      neighborhoodIds: targets.map((t) => t.id),
                      validUntil: toDakarInput(alert.validUntil),
                      scheduledAt: toDakarInput(alert.scheduledAt),
                    }}
                  />
                </Card>
                <Card className="space-y-3">
                  <CardTitle>{translate('backoffice.alerts.rejectTitle')}</CardTitle>
                  <ReasonActionForm id={alert.id} action="reject" />
                </Card>
              </>
            )}
            {(alert.status === 'SCHEDULED' ||
              (alert.status === 'SENT' && alert.validUntil > new Date())) && (
              <Card className="space-y-3">
                <CardTitle>{translate('backoffice.alerts.cancelTitle')}</CardTitle>
                <ReasonActionForm id={alert.id} action="cancel" />
              </Card>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
