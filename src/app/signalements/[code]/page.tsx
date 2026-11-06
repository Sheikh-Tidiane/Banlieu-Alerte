import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { PageShell } from '@/components/layout/page-shell';
import { Comments } from '@/components/reports/comments';
import { ReportActions } from '@/components/reports/report-actions';
import { ReportTypeIcon } from '@/components/reports/report-type-icon';
import { ResolutionQuestion } from '@/components/reports/resolution-question';
import { StatusTimeline } from '@/components/reports/status-timeline';
import { Badge, DemoBadge, StatusBadge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { translate } from '@/i18n';
import { findMergeTarget, getPublicReport } from '@/services/reports/read';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return { title: `${translate('reportForm.trackingCode')} ${code}` };
}

const dateFormatter = new Intl.DateTimeFormat('fr-SN', { dateStyle: 'long', timeStyle: 'short' });

export default async function ReportDetailPage({ params }: Props) {
  const { code } = await params;
  const report = await getPublicReport(code);
  if (!report) {
    // Doublon fusionné : renvoi vers le signalement principal (D-038).
    const target = await findMergeTarget(code);
    if (target) redirect(`/signalements/${target}`);
    notFound();
  }

  const photo = report.photos[0];

  return (
    <PageShell className="max-w-3xl space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={report.status} />
          {report.isDemo && <DemoBadge />}
        </div>
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <span className="bg-water/10 text-water rounded-pill grid size-12 shrink-0 place-items-center">
            <ReportTypeIcon type={report.type} className="size-6" />
          </span>
          {translate(`reportType.${report.type}`)}
        </h1>
        <p className="text-muted">
          {translate('reportForm.trackingCode')}{' '}
          <span className="text-ink font-semibold">{report.trackingCode}</span>
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_18rem]">
        <div className="space-y-6">
          {photo && (
            <Image
              src={photo.url}
              alt={translate('detail.photo')}
              width={photo.width ?? 800}
              height={photo.height ?? 600}
              className="rounded-card border-line h-auto w-full border"
              unoptimized
            />
          )}
          <Card>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-muted text-sm">{translate('detail.reportedOn')}</dt>
                <dd className="font-medium">
                  <time dateTime={report.createdAt}>
                    {dateFormatter.format(new Date(report.createdAt))}
                  </time>
                </dd>
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
                <dt className="text-muted text-sm">{translate('detail.position')}</dt>
                <dd className="font-medium">
                  {report.lat.toFixed(3)}, {report.lng.toFixed(3)}
                  {report.isApproximate && (
                    <Badge className="ml-2">{translate('detail.approximate')}</Badge>
                  )}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted text-sm">{translate('detail.description')}</dt>
                <dd className="whitespace-pre-line">
                  {report.description ?? translate('detail.noDescription')}
                </dd>
              </div>
            </dl>
          </Card>
          <section aria-labelledby="timeline" className="space-y-4">
            <h2 id="timeline" className="text-xl font-semibold">
              {translate('detail.timeline')}
            </h2>
            <StatusTimeline history={report.history} />
          </section>
          <Comments code={report.trackingCode} initial={report.comments} />
        </div>
        <aside className="space-y-4">
          {/* Toujours monté : après « non », le statut change et le message de confirmation
              doit rester visible. La question n'apparaît que si l'API la propose à l'auteur. */}
          <ResolutionQuestion code={report.trackingCode} />
          <ReportActions
            trackingCode={report.trackingCode}
            initialCount={report.confirmationCount}
          />
          <Link href="/carte" className={buttonVariants({ variant: 'outline', fullWidth: true })}>
            {translate('detail.backToMap')}
          </Link>
        </aside>
      </div>
    </PageShell>
  );
}
