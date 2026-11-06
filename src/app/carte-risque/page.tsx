import { BellRing } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/components/layout/page-shell';
import { RiskMapExplorer } from '@/components/risk/risk-map-explorer';
import { DemoBadge, RiskBadge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { interpolate, translate } from '@/i18n';
import { badgeLevel, levelLabel } from '@/lib/risk/explain';
import { getRiskOverview } from '@/services/risk/read';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: translate('riskMap.title') };

export default async function RiskMapPage() {
  const overview = await getRiskOverview().catch(() => null);

  return (
    <PageShell className="max-w-6xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{translate('riskMap.title')}</h1>
        <p className="text-muted max-w-2xl">{translate('riskMap.lead')}</p>
      </div>

      {/* Le risque en mots avant la carte (DESIGN §2.4). */}
      {overview ? (
        <Card className="space-y-3" data-testid="risk-words">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-xl font-semibold">{translate('riskMap.inWords')}</h2>
            {overview.isDemo && <DemoBadge />}
          </div>
          <ul className="space-y-2">
            {([24, 48] as const).flatMap((horizon) =>
              overview.neighborhoods[horizon].map((risk) => (
                <li
                  key={`${horizon}-${risk.neighborhoodId}`}
                  className="flex flex-wrap items-center gap-2"
                >
                  <RiskBadge level={badgeLevel(risk.level)} />
                  <span>
                    {interpolate(
                      translate(horizon === 24 ? 'riskMap.sentence24' : 'riskMap.sentence48'),
                      {
                        level: levelLabel(risk.level).toLowerCase(),
                        neighborhood: risk.neighborhoodName,
                      },
                    )}
                  </span>
                </li>
              )),
            )}
          </ul>
          <Link href="/s-abonner" className={buttonVariants({ variant: 'outline' })}>
            <BellRing aria-hidden="true" />
            {translate('alertsPage.subscribeCta')}
          </Link>
        </Card>
      ) : (
        <EmptyState
          headingLevel={2}
          title={translate('alertsPage.riskEmpty')}
          body={translate('alertsPage.riskEmptyBody')}
        />
      )}

      <RiskMapExplorer />
      <Link
        href="/qualite-indice"
        className="text-primary min-h-touch inline-flex items-center underline"
      >
        {translate('riskMap.quality')}
      </Link>
    </PageShell>
  );
}
