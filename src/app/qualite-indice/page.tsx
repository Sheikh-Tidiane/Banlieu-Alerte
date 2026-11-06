import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/page-shell';
import { Card } from '@/components/ui/card';
import { EmptyState, StateBanner } from '@/components/ui/states';
import { interpolate, translate } from '@/i18n';
import { MODELS, type Interval } from '@/lib/risk/evaluation';
import { getIndexQuality } from '@/services/risk/quality';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: translate('quality.title') };

const percent = (value: number) => `${Math.round(value * 100)} %`;

function IntervalCell({ interval }: { interval: Interval | null }) {
  if (!interval) return <td className="px-3 py-2">–</td>;
  return (
    <td className="px-3 py-2">
      <span className="font-semibold">{percent(interval.value)}</span>
      <span className="text-muted block text-xs">
        {percent(interval.low)} – {percent(interval.high)} ({translate('quality.interval')})
      </span>
    </td>
  );
}

export default async function QualityPage() {
  const quality = await getIndexQuality().catch(() => null);

  return (
    <PageShell className="max-w-4xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{translate('quality.title')}</h1>
        <p className="text-muted">{translate('quality.lead')}</p>
      </div>
      {quality === null ? (
        <StateBanner
          kind="error"
          title={translate('design.errorTitle')}
          body={translate('design.errorBody')}
        />
      ) : !quality.reached || !quality.results ? (
        <>
          {/* État vide explicite (EXG-12) : aucune métrique avant le seuil fixé à l'avance. */}
          <EmptyState
            headingLevel={2}
            title={translate('quality.emptyTitle')}
            body={interpolate(translate('quality.emptyBody'), { ...quality.threshold })}
          />
          <Card className="space-y-2" data-testid="quality-progress">
            <h2 className="font-heading font-semibold">{translate('quality.progress')}</h2>
            <ul className="space-y-1 text-sm">
              <li>
                {quality.counts.episodes}{' '}
                {interpolate(translate('quality.episodes'), { target: quality.threshold.episodes })}
              </li>
              <li>
                {quality.counts.labels}{' '}
                {interpolate(translate('quality.labels'), { target: quality.threshold.labels })}
              </li>
              <li>
                {quality.counts.flooded}{' '}
                {interpolate(translate('quality.flooded'), { target: quality.threshold.flooded })}
              </li>
            </ul>
          </Card>
        </>
      ) : (
        <Card className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-line border-b">
                  <th className="px-3 py-2" scope="col">
                    {translate('quality.model')}
                  </th>
                  <th className="px-3 py-2" scope="col">
                    {translate('quality.precision')}
                  </th>
                  <th className="px-3 py-2" scope="col">
                    {translate('quality.recall')}
                  </th>
                  <th className="px-3 py-2" scope="col">
                    {translate('quality.falseAlarm')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {MODELS.map((model) => {
                  const m = quality.results!.models[model];
                  return (
                    <tr key={model} className="border-line border-b">
                      <th scope="row" className="px-3 py-2 font-medium">
                        {translate(`quality.${model}`)}
                      </th>
                      <IntervalCell interval={m.precision} />
                      <IntervalCell interval={m.recall} />
                      <IntervalCell interval={m.falseAlarmRatio} />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-muted text-sm">
            {translate('quality.samples')} : {quality.results.samples} ·{' '}
            {quality.results.withoutPrediction} {translate('quality.withoutPrediction')}
          </p>
        </Card>
      )}
      <p className="text-muted text-sm">{translate('quality.notProbability')}</p>
    </PageShell>
  );
}
