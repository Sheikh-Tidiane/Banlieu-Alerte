import type { Metadata } from 'next';
import {
  ActivateVersionButton,
  NewRuleVersionForm,
  RefreshRiskButton,
} from '@/components/backoffice/risk-admin';
import { HorizonSection, WeatherStatus } from '@/components/risk/risk-overview';
import { Badge, DemoBadge, RiskBadge } from '@/components/ui/badge';
import { Card, CardTitle } from '@/components/ui/card';
import { EmptyState, StateBanner } from '@/components/ui/states';
import { translate } from '@/i18n';
import { badgeLevel } from '@/lib/risk/explain';
import { canManageRules, STAFF_ROLES } from '@/permissions/policies';
import { requirePageUser } from '@/permissions/require';
import { getRiskAdminData } from '@/services/risk/admin';
import { getRiskOverview } from '@/services/risk/read';
import { ruleParamsSchema } from '@/validators/risk';

export const metadata: Metadata = { title: translate('backoffice.riskAdmin.title') };

const dateFormatter = new Intl.DateTimeFormat('fr-SN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Africa/Dakar',
});

const TRIGGERS = ['cron', 'admin', 'script', 'test'] as const;

export default async function RiskAdminPage() {
  const user = await requirePageUser('/back-office/indice', STAFF_ROLES);
  const admin = canManageRules(user);
  const [data, overview] = await Promise.all([getRiskAdminData(), getRiskOverview()]);
  const active = data.versions.find((v) => v.isActive);
  const activeParams = active ? ruleParamsSchema.safeParse(active.params) : null;
  const trigger = TRIGGERS.find((t) => t === data.run?.trigger);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">{translate('backoffice.riskAdmin.title')}</h2>
        <p className="text-muted">{translate('backoffice.riskAdmin.intro')}</p>
      </div>
      {admin ? (
        <RefreshRiskButton />
      ) : (
        <StateBanner kind="info" title={translate('backoffice.riskAdmin.readOnly')} />
      )}

      {data.run && overview ? (
        <>
          <Card className="space-y-2">
            <CardTitle>{translate('backoffice.riskAdmin.lastRun')}</CardTitle>
            <p className="flex flex-wrap items-center gap-2 text-sm">
              {dateFormatter.format(data.run.createdAt)} ·{' '}
              {translate('backoffice.riskAdmin.trigger')} :{' '}
              {trigger ? translate(`backoffice.riskAdmin.triggers.${trigger}`) : data.run.trigger} ·{' '}
              {data.run.cellCount} {translate('alertsPage.cells')} · {data.run.draftsCreated}{' '}
              {translate('backoffice.riskAdmin.draftsCreated')}
              {data.run.isDemo && <DemoBadge />}
            </p>
            <WeatherStatus overview={overview} />
          </Card>
          <HorizonSection overview={overview} horizon={24} />

          <section aria-labelledby="cells" className="space-y-3">
            <h3 id="cells" className="font-heading text-xl font-semibold">
              {translate('backoffice.riskAdmin.cells')}
            </h3>
            <ul className="grid gap-2">
              {data.topCells.map((cell) => (
                <li key={cell.id}>
                  <details className="rounded-control border-line bg-surface-raised border p-3">
                    <summary className="min-h-touch flex cursor-pointer flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {translate('backoffice.riskAdmin.cell')} {cell.label}
                      </span>
                      <span className="text-muted text-sm">
                        {cell.neighborhood ?? translate('map.unidentified')}
                      </span>
                      <RiskBadge level={badgeLevel(cell.level)} />
                      <span className="text-sm font-semibold">{cell.score ?? '–'} / 100</span>
                    </summary>
                    <ul className="mt-2 space-y-0.5 text-sm">
                      {cell.factors.map((f) => (
                        <li key={f.key}>
                          {f.text} — {f.points} / {f.maxPoints}{' '}
                          {translate('backoffice.riskAdmin.points')}
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <EmptyState title={translate('backoffice.riskAdmin.noRun')} />
      )}

      <Card className="space-y-2">
        <CardTitle>{translate('backoffice.riskAdmin.weatherErrors')}</CardTitle>
        {data.weatherErrors.length === 0 ? (
          <p className="text-muted text-sm">{translate('backoffice.riskAdmin.noWeatherErrors')}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.weatherErrors.map((e) => (
              <li key={e.id}>
                {dateFormatter.format(e.createdAt)} — {e.message}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <section aria-labelledby="versions" className="space-y-3">
        <h3 id="versions" className="font-heading text-xl font-semibold">
          {translate('backoffice.riskAdmin.versions')}
        </h3>
        {admin && (
          <p className="text-muted text-sm">{translate('backoffice.riskAdmin.rollbackHint')}</p>
        )}
        <ul className="grid gap-3">
          {data.versions.map((version) => (
            <li key={version.id}>
              <Card className="space-y-2" data-testid="rule-version">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-heading font-semibold">
                    v{version.number} — {version.name}
                  </span>
                  {version.isActive && (
                    <Badge tone="safe">{translate('backoffice.riskAdmin.active')}</Badge>
                  )}
                </div>
                {version.notes && <p className="text-muted text-sm">{version.notes}</p>}
                <p className="text-muted text-xs">
                  {dateFormatter.format(version.createdAt)}
                  {version.createdBy && ` · ${version.createdBy.name}`} · {version._count.runs}{' '}
                  {translate('backoffice.riskAdmin.runs')}
                </p>
                {admin && !version.isActive && <ActivateVersionButton versionId={version.id} />}
              </Card>
            </li>
          ))}
        </ul>
        {admin && activeParams?.success && (
          <Card className="space-y-3">
            <CardTitle>{translate('backoffice.riskAdmin.newVersion')}</CardTitle>
            <NewRuleVersionForm base={activeParams.data} />
          </Card>
        )}
      </section>
    </div>
  );
}
