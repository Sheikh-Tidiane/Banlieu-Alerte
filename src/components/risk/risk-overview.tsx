import { CloudRain } from 'lucide-react';
import { DemoBadge, RiskBadge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { StateBanner } from '@/components/ui/states';
import { interpolate, translate } from '@/i18n';
import { badgeLevel, factorLabel, levelLabel } from '@/lib/risk/explain';
import type { Horizon } from '@/lib/risk/types';
import type { PublicRisk, RiskOverview } from '@/services/risk/read';

export const dateTime = new Intl.DateTimeFormat('fr-SN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Africa/Dakar',
});
const hour = new Intl.DateTimeFormat('fr-SN', {
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Africa/Dakar',
});
const mm = new Intl.NumberFormat('fr-SN', { maximumFractionDigits: 1 });

/** Source et date des données météo, avec l'état de panne ou de démonstration (EXG-09). */
export function WeatherStatus({ overview }: { overview: RiskOverview }) {
  const { weather } = overview;
  return (
    <div className="space-y-3">
      {weather.fetchedAt === null ? (
        <StateBanner kind="error" title={translate('alertsPage.weatherMissing')} />
      ) : (
        weather.stale && (
          <StateBanner
            kind="error"
            title={`${translate('alertsPage.weatherStale')} (${dateTime.format(new Date(weather.fetchedAt))})`}
            body={translate('alertsPage.weatherStaleBody')}
          />
        )
      )}
      {weather.isDemo && <StateBanner kind="info" title={translate('alertsPage.weatherDemo')} />}
      <p className="text-muted text-sm" data-testid="risk-data-date">
        {translate('alertsPage.weatherSource')} : {weather.source ?? translate('alertsPage.noData')}
        {weather.fetchedAt &&
          `, ${translate('alertsPage.weatherFetchedAt')} ${dateTime.format(new Date(weather.fetchedAt))}`}
        {' · '}
        {translate('alertsPage.computedAt')} {dateTime.format(new Date(overview.computedAt))} (
        {translate('alertsPage.ruleVersion')} v{overview.ruleVersion.number})
      </p>
    </div>
  );
}

/** Pluie prévue par tranches de 6 h. */
export function RainOutlook({ outlook }: { outlook: RiskOverview['outlook'] }) {
  return (
    <ol className="grid grid-cols-4 gap-2 sm:grid-cols-8">
      {outlook.map((slot) => (
        <li
          key={slot.start}
          className="rounded-control border-line bg-surface border p-2 text-center"
        >
          <span className="text-muted block text-xs">{hour.format(new Date(slot.start))}</span>
          <CloudRain aria-hidden="true" className="text-water mx-auto my-1 size-5" />
          <span className="block font-semibold">
            {slot.mm === null
              ? translate('alertsPage.noData')
              : `${mm.format(slot.mm)} ${translate('alertsPage.mm')}`}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Indice d'un quartier : niveau en mots, score indicatif, trois facteurs, données absentes. */
export function NeighborhoodRiskCard({ risk }: { risk: PublicRisk }) {
  const missing = risk.missing.filter((key) => key !== 'history' || risk.missing.length > 1);
  return (
    <Card className="space-y-3" data-testid="neighborhood-risk">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-heading text-lg font-semibold">{risk.neighborhoodName}</h4>
        <div className="flex flex-wrap gap-2">
          <RiskBadge level={badgeLevel(risk.level)} />
          {risk.isDemo && <DemoBadge />}
        </div>
      </div>
      {risk.score !== null && (
        <p className="text-sm">
          <span className="font-semibold">
            {translate('alertsPage.score')} {risk.score} {translate('alertsPage.outOf')}
          </span>{' '}
          <span className="text-muted">({translate('alertsPage.indicativeScore')})</span>
        </p>
      )}
      {risk.cappedWithoutRain && (
        <p className="text-muted text-sm">{translate('alertsPage.cappedWithoutRain')}</p>
      )}
      <div>
        <p className="text-sm font-semibold">{translate('alertsPage.mainFactors')}</p>
        {risk.topFactors.length === 0 ? (
          <p className="text-muted text-sm">{translate('alertsPage.noFactor')}</p>
        ) : (
          <ul className="list-disc space-y-0.5 pl-5 text-sm">
            {risk.topFactors.map((factor) => (
              <li key={factor.key}>{factor.text}</li>
            ))}
          </ul>
        )}
      </div>
      {missing.length > 0 && (
        <p className="text-muted text-sm">
          {translate('alertsPage.missingData')} :{' '}
          {missing.map((key) => factorLabel(key)).join(', ')}
        </p>
      )}
      <p className="text-muted text-xs">
        {risk.cellCount} {translate('alertsPage.cells')}
      </p>
    </Card>
  );
}

const HORIZON_TITLE = { 24: 'alertsPage.horizon24', 48: 'alertsPage.horizon48' } as const;

export function HorizonSection({
  overview,
  horizon,
}: {
  overview: RiskOverview;
  horizon: Horizon;
}) {
  const items = overview.neighborhoods[horizon];
  const top = items[0];
  return (
    <section aria-labelledby={`horizon-${horizon}`} className="space-y-3">
      <h3 id={`horizon-${horizon}`} className="font-heading text-xl font-semibold">
        {translate(HORIZON_TITLE[horizon])}
      </h3>
      {/* Le risque en mots avant le détail (DESIGN §2.4). */}
      {top && (
        <p className="font-medium">
          {interpolate(
            translate(horizon === 24 ? 'alertsPage.summary24' : 'alertsPage.summary48'),
            { level: levelLabel(top.level).toLowerCase() },
          )}
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((risk) => (
          <NeighborhoodRiskCard key={risk.neighborhoodId} risk={risk} />
        ))}
      </div>
    </section>
  );
}
