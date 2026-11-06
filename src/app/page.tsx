import { CloudRain, Map as MapIcon, Megaphone, MapPin } from 'lucide-react';
import Link from 'next/link';
import { EmergencyButton } from '@/components/emergency/emergency-button';
import { PageShell } from '@/components/layout/page-shell';
import { ReportTypeIcon } from '@/components/reports/report-type-icon';
import { HomeRiskBanner } from '@/components/risk/home-risk-banner';
import { TutorialPrompt } from '@/components/onboarding/tutorial';
import { DemoBadge, StatusBadge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, StateBanner } from '@/components/ui/states';
import { translate } from '@/i18n';
import { listActiveAlerts } from '@/services/alerts/read';
import { getPublicStats, listPublicReports } from '@/services/reports/read';
import { getRiskOverview } from '@/services/risk/read';

export const dynamic = 'force-dynamic';

const steps = [
  { key: 'home.steps.predict', icon: CloudRain },
  { key: 'home.steps.alert', icon: Megaphone },
  { key: 'home.steps.report', icon: MapPin },
] as const;

const dateFormatter = new Intl.DateTimeFormat('fr-SN', { dateStyle: 'medium' });

async function loadHomeData() {
  try {
    const [stats, recent, overview, alerts] = await Promise.all([
      getPublicStats(),
      listPublicReports({}, 4),
      getRiskOverview(),
      listActiveAlerts(),
    ]);
    return { stats, recent, overview, activeAlerts: alerts.length };
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const data = await loadHomeData();

  return (
    <PageShell className="space-y-12">
      <TutorialPrompt />
      <section className="space-y-5">
        <h1 className="text-primary text-3xl font-bold sm:text-5xl">{translate('home.title')}</h1>
        <p className="text-muted max-w-2xl text-lg sm:text-xl">{translate('app.tagline')}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="space-y-1">
            <Link href="/signaler" className={buttonVariants({ size: 'lg', fullWidth: true })}>
              <Megaphone aria-hidden="true" />
              {translate('homePage.cta')}
            </Link>
            <p className="text-muted text-center text-sm sm:text-left">
              {translate('homePage.ctaHint')}
            </p>
          </div>
          <Link href="/carte" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
            <MapIcon aria-hidden="true" />
            {translate('homePage.seeMap')}
          </Link>
          <EmergencyButton size="lg" />
        </div>
        <p className="rounded-card border-danger/30 bg-danger/5 border p-4 font-medium">
          {translate('home.safety')}
        </p>
      </section>

      {data === null ? (
        <StateBanner
          kind="error"
          title={translate('design.errorTitle')}
          body={translate('design.errorBody')}
        />
      ) : (
        <>
          <HomeRiskBanner overview={data.overview} activeAlerts={data.activeAlerts} />

          <section aria-labelledby="stats" className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="stats" className="text-2xl font-semibold">
                {translate('homePage.statsTitle')}
              </h2>
              {data.stats.onlyDemo && <DemoBadge />}
            </div>
            {data.stats.total === 0 ? (
              <EmptyState title={translate('homePage.statsEmpty')} />
            ) : (
              <dl className="grid grid-cols-3 gap-3">
                {(
                  [
                    ['statsTotal', data.stats.total],
                    ['statsResolved', data.stats.resolved],
                    ['statsWeek', data.stats.lastWeek],
                  ] as const
                ).map(([label, value]) => (
                  <Card key={label} className="flex flex-col-reverse p-4 text-center">
                    <dt className="text-muted text-sm">{translate(`homePage.${label}`)}</dt>
                    <dd className="font-heading text-primary text-3xl font-bold">{value}</dd>
                  </Card>
                ))}
              </dl>
            )}
            {data.stats.onlyDemo && (
              <p className="text-muted text-sm">{translate('homePage.demoNotice')}</p>
            )}
          </section>

          <section aria-labelledby="recent" className="space-y-4">
            <h2 id="recent" className="text-2xl font-semibold">
              {translate('homePage.recentTitle')}
            </h2>
            {data.recent.length === 0 ? (
              <EmptyState title={translate('homePage.recentEmpty')} />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {data.recent.map((report) => (
                  <li key={report.trackingCode}>
                    <Link
                      href={`/signalements/${report.trackingCode}`}
                      className="rounded-card border-line bg-surface-raised shadow-soft hover:border-primary flex h-full gap-3 border p-4"
                    >
                      <span className="bg-water/10 text-water rounded-pill grid size-11 shrink-0 place-items-center">
                        <ReportTypeIcon type={report.type} className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1 space-y-1">
                        <span className="font-heading block font-semibold">
                          {translate(`reportType.${report.type}`)}
                        </span>
                        <span className="text-muted block text-sm">
                          {report.neighborhood?.name ?? translate('map.unidentified')} ·{' '}
                          {dateFormatter.format(new Date(report.createdAt))}
                        </span>
                        <span className="flex flex-wrap gap-2">
                          <StatusBadge status={report.status} />
                          {report.isDemo && <DemoBadge />}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <section aria-labelledby="how" className="space-y-4">
        <h2 id="how" className="text-2xl font-semibold">
          {translate('home.howItWorksTitle')}
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {steps.map(({ key, icon: Icon }) => (
            <li key={key}>
              <Card className="h-full">
                <Icon aria-hidden="true" className="text-water mb-3 size-7" />
                <p>{translate(key)}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>
    </PageShell>
  );
}
