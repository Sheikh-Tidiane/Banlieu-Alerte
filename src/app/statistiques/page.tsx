import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/page-shell';
import { DemoBadge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState, StateBanner } from '@/components/ui/states';
import { interpolate, translate } from '@/i18n';
import { getPublicStatistics } from '@/services/stats/public';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: translate('stats.title') };

const monthFormatter = new Intl.DateTimeFormat('fr-SN', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function duration(hours: number) {
  return hours < 48
    ? `${hours} ${translate('stats.hours')}`
    : `${Math.round((hours / 24) * 10) / 10} ${translate('stats.days')}`;
}

export default async function StatisticsPage() {
  const stats = await getPublicStatistics().catch(() => null);

  return (
    <PageShell className="max-w-4xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{translate('stats.title')}</h1>
        <p className="text-muted">{translate('stats.lead')}</p>
      </div>
      {stats === null ? (
        <StateBanner
          kind="error"
          title={translate('design.errorTitle')}
          body={translate('design.errorBody')}
        />
      ) : stats.rows.length === 0 ? (
        <EmptyState headingLevel={2} title={translate('stats.empty')} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">
              {stats.total} {translate('stats.totalLabel')}
            </p>
            {stats.onlyDemo && <DemoBadge />}
          </div>
          {stats.onlyDemo && <StateBanner kind="info" title={translate('stats.onlyDemo')} />}
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[34rem] text-left text-sm" data-testid="stats-table">
              <thead>
                <tr className="border-line border-b">
                  <th scope="col" className="px-3 py-2">
                    {translate('stats.month')}
                  </th>
                  <th scope="col" className="px-3 py-2">
                    {translate('stats.neighborhood')}
                  </th>
                  <th scope="col" className="px-3 py-2">
                    {translate('stats.total')}
                  </th>
                  <th scope="col" className="px-3 py-2">
                    {translate('stats.resolutionRate')}
                  </th>
                  <th scope="col" className="px-3 py-2">
                    {translate('stats.averageTime')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.rows.map((row) => (
                  <tr key={`${row.month}-${row.neighborhood}`} className="border-line border-b">
                    <td className="px-3 py-2">
                      {monthFormatter.format(new Date(`${row.month}-01T00:00:00Z`))}
                    </td>
                    <td className="px-3 py-2">
                      {row.neighborhood ?? translate('map.unidentified')}
                      {row.onlyDemo && <DemoBadge className="ml-1 scale-90" />}
                    </td>
                    <td className="px-3 py-2 font-semibold">{row.total}</td>
                    <td className="px-3 py-2">
                      {row.resolutionRate === null ? (
                        <span className="text-muted">{translate('stats.insufficient')}</span>
                      ) : (
                        `${Math.round(row.resolutionRate * 100)} %`
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.averageResolutionHours === null ? (
                        <span className="text-muted">{translate('stats.insufficient')}</span>
                      ) : (
                        duration(row.averageResolutionHours)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="text-muted text-sm">
            {interpolate(translate('stats.insufficientHint'), { min: stats.minReportsPerRow })}
          </p>
        </>
      )}
    </PageShell>
  );
}
