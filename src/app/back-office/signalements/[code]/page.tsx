import { ArrowLeft, ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AssignForm,
  MergeForm,
  NoteForm,
  StatusForm,
} from '@/components/backoffice/report-processing';
import { CommentModeration } from '@/components/backoffice/comment-moderation';
import { LateBadge } from '@/components/backoffice/late-badge';
import { ReportTypeIcon } from '@/components/reports/report-type-icon';
import { Badge, DemoBadge, StatusBadge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { StateBanner } from '@/components/ui/states';
import { translate } from '@/i18n';
import { STAFF_ROLES } from '@/permissions/policies';
import { requirePageUser } from '@/permissions/require';
import { getStaffReport } from '@/services/backoffice/reports';
import { ServiceError } from '@/services/errors';

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: (await params).code };
}

const dateFormatter = new Intl.DateTimeFormat('fr-SN', { dateStyle: 'medium', timeStyle: 'short' });

export default async function StaffReportPage({ params }: Props) {
  const { code } = await params;
  const user = await requirePageUser(`/back-office/signalements/${code}`, STAFF_ROLES);

  let report: Awaited<ReturnType<typeof getStaffReport>>;
  try {
    report = await getStaffReport(user, code);
  } catch (error) {
    if (error instanceof ServiceError && error.code === 'NOT_FOUND') notFound();
    if (error instanceof ServiceError && error.code === 'FORBIDDEN') {
      return (
        <StateBanner kind="error" title={translate('auth.forbiddenTitle')} body={error.message} />
      );
    }
    throw error;
  }

  const notes = report.comments.filter((c) => c.isInternal);
  const publicComments = report.comments.filter((c) => !c.isInternal);
  const photo = report.photos[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/back-office/signalements" className={buttonVariants({ variant: 'ghost' })}>
          <ArrowLeft aria-hidden="true" />
          {translate('backoffice.report.back')}
        </Link>
        {report.status !== 'REJECTED' && (
          <Link
            href={`/signalements/${report.trackingCode}`}
            className={buttonVariants({ variant: 'ghost' })}
          >
            <ExternalLink aria-hidden="true" />
            {translate('backoffice.report.publicPage')}
          </Link>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={report.status} />
          <LateBadge level={report.escalationLevel} />
          {report.resolutionFeedback && (
            <Badge tone={report.resolutionFeedback === 'CONFIRMED' ? 'safe' : 'warning'}>
              {translate(`backoffice.report.feedback${report.resolutionFeedback}`)}
            </Badge>
          )}
          {report.isDemo && <DemoBadge />}
          {report.duplicateOf && (
            <Badge tone="neutral">
              {translate('backoffice.report.duplicateOf')} {report.duplicateOf.trackingCode}
            </Badge>
          )}
        </div>
        <h2 className="flex items-center gap-3 text-2xl font-bold">
          <ReportTypeIcon type={report.type} className="text-water size-6" />
          {translate(`reportType.${report.type}`)} · {report.trackingCode}
        </h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-muted text-sm">{translate('detail.reportedOn')}</dt>
                <dd className="font-medium">{dateFormatter.format(report.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-muted text-sm">{translate('detail.neighborhood')}</dt>
                <dd className="font-medium">
                  {report.neighborhood?.name ?? translate('map.unidentified')}
                </dd>
              </div>
              <div>
                <dt className="text-muted text-sm">{translate('detail.severity')}</dt>
                <dd className="font-medium">{translate(`severity.${report.severity}`)}</dd>
              </div>
              <div>
                <dt className="text-muted text-sm">
                  {translate('backoffice.report.exactPosition')}
                </dt>
                <dd className="font-medium">
                  {report.lat.toFixed(6)}, {report.lng.toFixed(6)}
                </dd>
              </div>
              <div>
                <dt className="text-muted text-sm">{translate('backoffice.report.author')}</dt>
                <dd className="font-medium">
                  {translate(
                    report.hasAuthorAccount
                      ? 'backoffice.report.authorAccount'
                      : 'backoffice.report.authorAnonymous',
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted text-sm">
                  {translate('backoffice.reports.columns.confirmations')}
                </dt>
                <dd className="font-medium">{report.confirmationCount}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted text-sm">{translate('detail.description')}</dt>
                <dd className="whitespace-pre-line">
                  {report.description ?? translate('detail.noDescription')}
                </dd>
              </div>
            </dl>
          </Card>

          {photo && (
            <Image
              src={`/api/photos/${photo.storageKey}`}
              alt={translate('detail.photo')}
              width={photo.width ?? 800}
              height={photo.height ?? 600}
              unoptimized
              className="rounded-card border-line h-auto w-full max-w-xl border"
            />
          )}

          <section aria-labelledby="history" className="space-y-3">
            <h3 id="history" className="text-xl font-semibold">
              {translate('backoffice.report.historyTitle')}
            </h3>
            <ol className="space-y-3">
              {report.statusHistory.map((step) => (
                <li key={step.id} className="rounded-card border-line bg-surface-raised border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {step.fromStatus && <StatusBadge status={step.fromStatus} />}
                    {step.fromStatus && <span aria-hidden="true">→</span>}
                    <StatusBadge status={step.toStatus} />
                  </div>
                  <p className="text-muted mt-1 text-sm">
                    {dateFormatter.format(step.createdAt)} · {translate('backoffice.report.by')}{' '}
                    {step.changedBy
                      ? `${step.changedBy.name} (${translate(`roles.${step.changedBy.role}`)})`
                      : translate('backoffice.report.system')}
                  </p>
                  {step.note && <p className="mt-1 text-sm">{step.note}</p>}
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="notes" className="space-y-3">
            <h3 id="notes" className="text-xl font-semibold">
              {translate('backoffice.report.notesTitle')}
            </h3>
            {notes.length === 0 ? (
              <p className="text-muted text-sm">{translate('backoffice.report.notesEmpty')}</p>
            ) : (
              <ul className="space-y-2">
                {notes.map((note) => (
                  <li key={note.id} className="rounded-card border-accent bg-accent/10 border p-3">
                    <p className="whitespace-pre-line">{note.body}</p>
                    <p className="text-muted mt-1 text-xs">
                      {note.author?.name ?? translate('comments.anonymous')} ·{' '}
                      {dateFormatter.format(note.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {report.permissions.canAddNote && <NoteForm code={report.trackingCode} />}
          </section>

          {publicComments.length > 0 && (
            <section aria-labelledby="public-comments" className="space-y-3">
              <h3 id="public-comments" className="text-xl font-semibold">
                {translate('comments.title')}
              </h3>
              <CommentModeration
                canModerate={report.permissions.canModerate}
                comments={publicComments.map((c) => ({
                  id: c.id,
                  body: c.body,
                  status: c.status,
                  author: c.author?.name ?? translate('comments.anonymous'),
                  createdAt: dateFormatter.format(c.createdAt),
                }))}
              />
            </section>
          )}
        </div>

        {/* Sur mobile, les actions de traitement passent avant le détail. */}
        <aside className="order-first space-y-4 lg:order-none">
          <Card className="space-y-3">
            <CardTitle>{translate('backoffice.report.statusTitle')}</CardTitle>
            {/* Remonté à chaque changement de statut : le choix proposé suit les transitions permises. */}
            <StatusForm
              key={report.status}
              code={report.trackingCode}
              transitions={report.permissions.transitions}
            />
          </Card>

          <Card className="space-y-3">
            <CardTitle>{translate('backoffice.report.assignTitle')}</CardTitle>
            <p className="text-sm">
              {translate('backoffice.reports.columns.assignee')} :{' '}
              <strong>{report.assignee?.name ?? translate('backoffice.report.assignNone')}</strong>
            </p>
            {report.permissions.canAssign && (
              <AssignForm
                key={report.assignee?.id ?? 'none'}
                code={report.trackingCode}
                assignable={report.assignable}
                currentAssigneeId={report.assignee?.id ?? null}
                selfId={user.id}
              />
            )}
          </Card>

          <Card className="space-y-3">
            <CardTitle>{translate('backoffice.report.nearby')}</CardTitle>
            {report.nearby.length === 0 ? (
              <p className="text-muted text-sm">{translate('backoffice.report.nearbyEmpty')}</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {report.nearby.map((n) => (
                  <li key={n.trackingCode}>
                    <Link
                      href={`/back-office/signalements/${n.trackingCode}`}
                      className="text-primary font-semibold underline-offset-2 hover:underline"
                    >
                      {n.trackingCode}
                    </Link>{' '}
                    · {translate(`reportStatus.${n.status}`)} · {n.distance} m
                  </li>
                ))}
              </ul>
            )}
            {report.permissions.canMerge && !report.duplicateOf && report.status !== 'REJECTED' && (
              <MergeForm
                code={report.trackingCode}
                suggestions={report.nearby.map((n) => n.trackingCode)}
              />
            )}
          </Card>

          {report.abuseFlags.length > 0 && (
            <Card className="space-y-2">
              <CardTitle>{translate('backoffice.report.abuseTitle')}</CardTitle>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {report.abuseFlags.map((flag) => (
                  <li key={flag.id}>{flag.reason}</li>
                ))}
              </ul>
              <Link
                href="/back-office/moderation"
                className="text-primary text-sm font-semibold underline"
              >
                {translate('backoffice.nav.moderation')}
              </Link>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
