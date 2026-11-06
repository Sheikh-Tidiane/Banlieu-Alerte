import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { translate } from '@/i18n';
import { requirePageUser } from '@/permissions/require';
import { listAudit } from '@/services/audit';

export const metadata: Metadata = { title: translate('backoffice.audit.title') };

type Props = { searchParams: Promise<{ page?: string }> };

const dateFormatter = new Intl.DateTimeFormat('fr-SN', { dateStyle: 'short', timeStyle: 'medium' });

export default async function AuditPage({ searchParams }: Props) {
  await requirePageUser('/back-office/journal', ['ADMIN']);
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const { rows, pageCount } = await listAudit(page);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">{translate('backoffice.audit.title')}</h2>
        <p className="text-muted">{translate('backoffice.audit.lead')}</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState title={translate('backoffice.audit.empty')} />
      ) : (
        <div className="rounded-card border-line bg-surface-raised overflow-x-auto border">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-surface text-muted">
              <tr>
                {(['when', 'actor', 'action', 'entity', 'details'] as const).map((column) => (
                  <th key={column} scope="col" className="px-3 py-3 font-semibold">
                    {translate(`backoffice.audit.${column}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-line border-t align-top">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {dateFormatter.format(row.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    {row.actor
                      ? `${row.actor.name} (${translate(`roles.${row.actor.role}`)})`
                      : translate('backoffice.report.system')}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{row.action}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {row.entityType}
                    {row.entityId ? ` · ${row.entityId.slice(-8)}` : ''}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs break-all">
                    {row.metadata ? JSON.stringify(row.metadata) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pageCount > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-center gap-3">
          {page > 1 && (
            <Link
              href={`/back-office/journal?page=${page - 1}`}
              className={buttonVariants({ variant: 'outline' })}
            >
              ←
            </Link>
          )}
          <span className="text-sm">
            {page} / {pageCount}
          </span>
          {page < pageCount && (
            <Link
              href={`/back-office/journal?page=${page + 1}`}
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
