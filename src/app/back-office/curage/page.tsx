import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  CleanupPhotoForm,
  PlanCleanupForm,
  UpdateCleanupForm,
} from '@/components/cleanup/cleanup-actions';
import { ReportTypeIcon } from '@/components/reports/report-type-icon';
import { Badge, DemoBadge } from '@/components/ui/badge';
import { Card, CardTitle } from '@/components/ui/card';
import { EmptyState, StateBanner } from '@/components/ui/states';
import { interpolate, translate } from '@/i18n';
import { STAFF_ROLES } from '@/permissions/policies';
import { requirePageUser } from '@/permissions/require';
import { listCleanupPriorities, listOperations } from '@/services/cleanup/cleanup';

export const metadata: Metadata = { title: translate('cleanup.title') };

const dateFormatter = new Intl.DateTimeFormat('fr-SN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Africa/Dakar',
});

export default async function CleanupPage() {
  const user = await requirePageUser('/back-office/curage', STAFF_ROLES);
  const canManage = user.role === 'AGENT' || user.role === 'ADMIN';
  const [{ items, heavyRain, untreated }, operations] = await Promise.all([
    listCleanupPriorities(user),
    listOperations(user),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">{translate('cleanup.title')}</h2>
        <p className="text-muted max-w-3xl">{translate('cleanup.intro')}</p>
      </div>
      {heavyRain && untreated > 0 && (
        <StateBanner
          kind="error"
          title={interpolate(translate('cleanup.heavyRain'), { count: untreated })}
        />
      )}
      {!canManage && <StateBanner kind="info" title={translate('cleanup.readOnly')} />}

      {items.length === 0 ? (
        <EmptyState title={translate('cleanup.empty')} />
      ) : (
        <ol className="grid gap-3" data-testid="cleanup-priorities">
          {items.map((item, index) => (
            <li key={item.id}>
              <Card className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-heading text-lg font-bold">{index + 1}.</span>
                  <ReportTypeIcon type={item.type} className="text-water size-5" />
                  <Link
                    href={`/back-office/signalements/${item.trackingCode}`}
                    className="text-primary font-semibold underline"
                  >
                    {item.trackingCode}
                  </Link>
                  <span className="text-muted text-sm">
                    {translate(`reportType.${item.type}`)} ·{' '}
                    {item.neighborhood ?? translate('map.unidentified')} ·{' '}
                    {translate(`severity.${item.severity}`)}
                  </span>
                  {item.isDemo && <DemoBadge />}
                </div>
                <p className="text-sm">
                  {translate('cleanup.risk')} :{' '}
                  {item.riskScore === null
                    ? translate('cleanup.noRisk')
                    : `${item.riskScore} / 100`}
                  {item.priority !== null && (
                    <>
                      {' '}
                      · {translate('cleanup.priority')} :{' '}
                      <span className="font-semibold">{item.priority}</span>
                    </>
                  )}{' '}
                  · {translate('cleanup.operation')} :{' '}
                  {item.operation ? (
                    <Badge tone="water">
                      {translate(`cleanup.status.${item.operation.status}`)}
                    </Badge>
                  ) : (
                    translate('cleanup.none')
                  )}
                </p>
                {canManage && !item.operation && (
                  <PlanCleanupForm trackingCode={item.trackingCode} />
                )}
              </Card>
            </li>
          ))}
        </ol>
      )}

      <section aria-labelledby="operations" className="space-y-3">
        <h3 id="operations" className="font-heading text-xl font-semibold">
          {translate('cleanup.operations')}
        </h3>
        {operations.length === 0 ? (
          <EmptyState title={translate('cleanup.operationsEmpty')} />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {operations.map((op) => {
              const open = op.status === 'PLANNED' || op.status === 'IN_PROGRESS';
              return (
                <li key={op.id}>
                  <Card className="space-y-3" data-testid="cleanup-operation">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={op.status === 'DONE' ? 'safe' : 'water'}>
                        {translate(`cleanup.status.${op.status}`)}
                      </Badge>
                      {op.isDemo && <DemoBadge />}
                    </div>
                    <CardTitle>
                      {op.report.trackingCode} · {op.team}
                    </CardTitle>
                    <p className="text-muted text-sm">
                      {op.plannedFor &&
                        `${translate('cleanup.plannedFor')} : ${dateFormatter.format(op.plannedFor)}`}
                      {op.completedAt &&
                        ` · ${translate('cleanup.status.DONE')} : ${dateFormatter.format(op.completedAt)}`}
                    </p>
                    {op.note && <p className="text-sm">{op.note}</p>}
                    {op.photos.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {op.photos.map((photo) => (
                          <figure key={photo.id} className="space-y-1">
                            <Image
                              src={`/api/photos/${photo.storageKey}`}
                              alt={`${translate('cleanup.photoAlt')} – ${translate(photo.phase === 'BEFORE' ? 'cleanup.photoBefore' : 'cleanup.photoAfter')}`}
                              width={120}
                              height={90}
                              unoptimized
                              className="rounded-control h-[90px] w-[120px] object-cover"
                            />
                            <figcaption className="text-muted text-xs">
                              {translate(
                                photo.phase === 'BEFORE'
                                  ? 'cleanup.photoBefore'
                                  : 'cleanup.photoAfter',
                              )}
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    )}
                    {canManage && open && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <UpdateCleanupForm id={op.id} status={op.status} />
                        <div className="space-y-2">
                          <CleanupPhotoForm id={op.id} phase="BEFORE" />
                          <CleanupPhotoForm id={op.id} phase="AFTER" />
                        </div>
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
