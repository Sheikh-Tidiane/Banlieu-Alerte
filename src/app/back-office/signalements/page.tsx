import type { Metadata } from 'next';
import Link from 'next/link';
import { ReportTypeIcon } from '@/components/reports/report-type-icon';
import { LateBadge } from '@/components/backoffice/late-badge';
import { DemoBadge, StatusBadge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { translate } from '@/i18n';
import { STAFF_ROLES } from '@/permissions/policies';
import { requirePageUser } from '@/permissions/require';
import { listStaffReports } from '@/services/backoffice/reports';
import { staffListSchema } from '@/validators/backoffice';
import { REPORT_STATUSES, REPORT_TYPES } from '@/validators/report';

export const metadata: Metadata = { title: translate('backoffice.reports.title') };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const dateFormatter = new Intl.DateTimeFormat('fr-SN', { dateStyle: 'short', timeStyle: 'short' });
const selectClass =
  'min-h-touch rounded-control border-line bg-surface-raised w-full border-2 px-3 text-base font-normal';

export default async function StaffReportsPage({ searchParams }: Props) {
  const user = await requirePageUser('/back-office/signalements', STAFF_ROLES);
  const raw = await searchParams;
  const filters = staffListSchema.parse(raw);
  const { rows, total, pageCount } = await listStaffReports(user, filters);

  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === 'string' && value && key !== 'page') params.set(key, value);
    }
    params.set('page', String(page));
    return `/back-office/signalements?${params.toString()}` as '/back-office/signalements';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-semibold">{translate('backoffice.reports.title')}</h2>
        <p className="text-muted text-sm" aria-live="polite">
          {total} {translate('backoffice.reports.count')}
        </p>
      </div>

      <form
        method="get"
        className="rounded-card border-line bg-surface-raised grid gap-4 border p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <label className="space-y-1 text-sm font-semibold">
          <span className="block">{translate('backoffice.reports.search')}</span>
          <input
            name="q"
            defaultValue={filters.q ?? ''}
            placeholder="BA-…"
            className={selectClass}
          />
        </label>
        <label className="space-y-1 text-sm font-semibold">
          <span className="block">{translate('map.status')}</span>
          <select name="status" defaultValue={filters.status.join(',')} className={selectClass}>
            <option value="">{translate('backoffice.reports.all')}</option>
            {REPORT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {translate(`reportStatus.${status}`)}
              </option>
            ))}
            <option value="VERIFIED,ASSIGNED,IN_PROGRESS">
              {translate('backoffice.dashboard.inProgress')}
            </option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold">
          <span className="block">{translate('map.type')}</span>
          <select name="type" defaultValue={filters.type.join(',')} className={selectClass}>
            <option value="">{translate('backoffice.reports.all')}</option>
            {REPORT_TYPES.map((type) => (
              <option key={type} value={type}>
                {translate(`reportType.${type}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold">
          <span className="block">{translate('backoffice.reports.columns.assignee')}</span>
          <select name="assigned" defaultValue={filters.assigned ?? ''} className={selectClass}>
            <option value="">{translate('backoffice.reports.all')}</option>
            <option value="me">{translate('backoffice.reports.assignedToMe')}</option>
            <option value="none">{translate('backoffice.report.assignNone')}</option>
          </select>
        </label>
        <div className="flex flex-col justify-end gap-2">
          <label className="min-h-touch flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              name="unidentified"
              value="1"
              defaultChecked={filters.unidentified}
              className="size-5"
            />
            {translate('backoffice.reports.unidentified')}
          </label>
          <Button type="submit" variant="outline">
            {translate('backoffice.reports.filters')}
          </Button>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState title={translate('backoffice.reports.empty')} />
      ) : (
        <div className="rounded-card border-line bg-surface-raised overflow-x-auto border">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="bg-surface text-muted">
              <tr>
                {(
                  [
                    'code',
                    'type',
                    'neighborhood',
                    'severity',
                    'status',
                    'assignee',
                    'created',
                    'confirmations',
                  ] as const
                ).map((column) => (
                  <th key={column} scope="col" className="px-3 py-3 font-semibold">
                    {translate(`backoffice.reports.columns.${column}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((report) => (
                <tr key={report.id} className="border-line hover:bg-surface border-t">
                  <td className="px-3 py-2">
                    <Link
                      href={`/back-office/signalements/${report.trackingCode}`}
                      className="text-primary min-h-touch inline-flex items-center font-semibold underline-offset-2 hover:underline"
                    >
                      {report.trackingCode}
                    </Link>
                    {report.isDemo && <DemoBadge className="ml-1 scale-90" />}
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <ReportTypeIcon type={report.type} className="text-water size-4" />
                      {translate(`reportType.${report.type}`)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {report.neighborhood?.name ?? translate('map.unidentified')}
                  </td>
                  <td className="px-3 py-2">{translate(`severity.${report.severity}`)}</td>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap gap-1">
                      <StatusBadge status={report.status} />
                      <LateBadge level={report.escalationLevel} />
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {report.assignee?.name ?? translate('backoffice.reports.none')}
                  </td>
                  <td className="text-muted px-3 py-2 whitespace-nowrap">
                    {dateFormatter.format(report.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-center">{report.confirmationCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-center gap-3">
          {filters.page > 1 && (
            <Link
              href={pageHref(filters.page - 1)}
              className={buttonVariants({ variant: 'outline' })}
            >
              ←
            </Link>
          )}
          <span className="text-sm">
            {filters.page} / {pageCount}
          </span>
          {filters.page < pageCount && (
            <Link
              href={pageHref(filters.page + 1)}
              className={buttonVariants({ variant: 'outline' })}
            >
              →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
