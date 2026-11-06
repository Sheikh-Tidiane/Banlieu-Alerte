import { ArrowRight, CloudRain } from 'lucide-react';
import Link from 'next/link';
import { DemoBadge, RiskBadge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { interpolate, translate } from '@/i18n';
import { badgeLevel, levelLabel } from '@/lib/risk/explain';
import type { RiskOverview } from '@/services/risk/read';
import { dateTime } from './risk-overview';

const mm = new Intl.NumberFormat('fr-SN', { maximumFractionDigits: 1 });

/** Bandeau d'accueil : le risque en mots, la pluie sur 24 h, les alertes en cours (CDC §4.1). */
export function HomeRiskBanner({
  overview,
  activeAlerts,
}: {
  overview: RiskOverview | null;
  activeAlerts: number;
}) {
  const top = overview?.neighborhoods[24][0] ?? null;
  const rain24 = overview?.outlook.slice(0, 4).every((slot) => slot.mm !== null)
    ? overview.outlook.slice(0, 4).reduce((sum, slot) => sum + (slot.mm ?? 0), 0)
    : null;

  return (
    <Card className="space-y-3" data-testid="home-risk">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-heading text-xl font-semibold">{translate('homeRisk.title')}</h2>
        {overview && <RiskBadge level={badgeLevel(top?.level ?? null)} />}
        {overview?.isDemo && <DemoBadge />}
      </div>
      {overview && top ? (
        <>
          <p className="text-lg font-medium">
            {interpolate(translate('homeRisk.sentence'), {
              level: levelLabel(top.level).toLowerCase(),
            })}
          </p>
          <p className="flex items-center gap-2">
            <CloudRain aria-hidden="true" className="text-water size-5" />
            {translate('homeRisk.rain24')} :{' '}
            {rain24 === null
              ? translate('alertsPage.noData')
              : `${mm.format(rain24)} ${translate('alertsPage.mm')}`}
          </p>
          <p className="text-muted text-sm">
            {overview.weather.stale
              ? translate('alertsPage.weatherStale')
              : translate('alertsPage.weatherSource')}{' '}
            : {overview.weather.source ?? translate('alertsPage.noData')}
            {overview.weather.fetchedAt &&
              `, ${translate('alertsPage.weatherFetchedAt')} ${dateTime.format(new Date(overview.weather.fetchedAt))}`}
          </p>
        </>
      ) : (
        <p className="text-muted">{translate('homeRisk.empty')}</p>
      )}
      {activeAlerts > 0 && (
        <p className="font-semibold">
          {interpolate(translate('homeRisk.activeAlerts'), { count: activeAlerts })}
        </p>
      )}
      <Link
        href="/alertes"
        className="min-h-touch text-primary inline-flex items-center gap-2 font-medium underline"
      >
        {translate('homeRisk.seeDetails')}
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </Card>
  );
}
