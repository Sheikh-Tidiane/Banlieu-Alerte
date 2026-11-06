import { BellRing, Map as MapIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertCard } from '@/components/alerts/alert-card';
import { EmergencyButton } from '@/components/emergency/emergency-button';
import { PageShell } from '@/components/layout/page-shell';
import { HorizonSection, RainOutlook, WeatherStatus } from '@/components/risk/risk-overview';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, StateBanner } from '@/components/ui/states';
import { translate } from '@/i18n';
import { listActiveAlerts, listPastAlerts } from '@/services/alerts/read';
import { getRiskOverview } from '@/services/risk/read';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: translate('alertsPage.title') };

async function loadData() {
  try {
    const [active, past, overview] = await Promise.all([
      listActiveAlerts(),
      listPastAlerts(),
      getRiskOverview(),
    ]);
    return { active, past, overview };
  } catch {
    return null;
  }
}

export default async function AlertsPage() {
  const data = await loadData();
  const appUrl = process.env.APP_URL;

  return (
    <PageShell className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-primary text-3xl font-bold sm:text-4xl">
          {translate('alertsPage.title')}
        </h1>
        <p className="text-muted max-w-2xl text-lg">{translate('alertsPage.intro')}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <EmergencyButton size="lg" />
          <Link href="/s-abonner" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
            <BellRing aria-hidden="true" />
            {translate('alertsPage.subscribeCta')}
          </Link>
        </div>
      </section>

      {data === null ? (
        <StateBanner
          kind="error"
          title={translate('design.errorTitle')}
          body={translate('design.errorBody')}
        />
      ) : (
        <>
          <section aria-labelledby="active-alerts" className="space-y-4">
            <h2 id="active-alerts" className="text-2xl font-semibold">
              {translate('alertsPage.activeTitle')}
            </h2>
            {data.active.length === 0 ? (
              <EmptyState
                title={translate('alertsPage.activeEmpty')}
                body={translate('alertsPage.activeEmptyBody')}
              />
            ) : (
              <div className="grid gap-4">
                {data.active.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} appUrl={appUrl} shareable />
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="risk" className="space-y-5">
            <h2 id="risk" className="text-2xl font-semibold">
              {translate('alertsPage.riskTitle')}
            </h2>
            {data.overview === null ? (
              <EmptyState
                title={translate('alertsPage.riskEmpty')}
                body={translate('alertsPage.riskEmptyBody')}
              />
            ) : (
              <>
                <WeatherStatus overview={data.overview} />
                <HorizonSection overview={data.overview} horizon={24} />
                <HorizonSection overview={data.overview} horizon={48} />
                {data.overview.outlook.length > 0 && (
                  <section aria-labelledby="rain" className="space-y-3">
                    <h3 id="rain" className="font-heading text-xl font-semibold">
                      {translate('alertsPage.weatherTitle')}
                    </h3>
                    <RainOutlook outlook={data.overview.outlook} />
                  </section>
                )}
              </>
            )}
            <Card>
              <h3 className="font-heading font-semibold">{translate('alertsPage.method')}</h3>
              <p className="text-muted mt-1 text-sm">{translate('alertsPage.methodBody')}</p>
            </Card>
            <div className="flex flex-wrap gap-3">
              <Link href="/carte-risque" className={buttonVariants()}>
                <MapIcon aria-hidden="true" />
                {translate('riskMap.seeMap')}
              </Link>
              <Link href="/carte" className={buttonVariants({ variant: 'outline' })}>
                <MapIcon aria-hidden="true" />
                {translate('alertsPage.seeMap')}
              </Link>
            </div>
          </section>

          <section aria-labelledby="past-alerts" className="space-y-4">
            <h2 id="past-alerts" className="text-2xl font-semibold">
              {translate('alertsPage.historyTitle')}
            </h2>
            {data.past.length === 0 ? (
              <EmptyState title={translate('alertsPage.historyEmpty')} />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {data.past.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </PageShell>
  );
}
