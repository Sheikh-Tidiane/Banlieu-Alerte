import type { Metadata } from 'next';
import Link from 'next/link';
import { AbuseActions } from '@/components/backoffice/abuse-actions';
import { Badge, DemoBadge, StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/states';
import { translate } from '@/i18n';
import { canBlockUsers, STAFF_ROLES } from '@/permissions/policies';
import { requirePageUser } from '@/permissions/require';
import { listOpenAbuse } from '@/services/backoffice/moderation';

export const metadata: Metadata = { title: translate('backoffice.moderation.title') };

const dateFormatter = new Intl.DateTimeFormat('fr-SN', { dateStyle: 'medium', timeStyle: 'short' });

export default async function ModerationPage() {
  const user = await requirePageUser('/back-office/moderation', STAFF_ROLES);
  const flags = await listOpenAbuse(user);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">{translate('backoffice.moderation.title')}</h2>
        <p className="text-muted">{translate('backoffice.moderation.lead')}</p>
      </div>
      {flags.length === 0 ? (
        <EmptyState title={translate('backoffice.moderation.empty')} />
      ) : (
        <ul className="space-y-3">
          {flags.map((flag) => {
            const code = flag.report?.trackingCode ?? flag.comment?.report.trackingCode ?? '';
            return (
              <li
                key={flag.id}
                className="rounded-card border-line bg-surface-raised space-y-3 border p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={flag.comment ? 'water' : 'accent'}>
                    {translate(
                      flag.comment
                        ? 'backoffice.moderation.onComment'
                        : 'backoffice.moderation.onReport',
                    )}
                  </Badge>
                  <Link
                    href={`/back-office/signalements/${code}`}
                    className="text-primary font-semibold underline-offset-2 hover:underline"
                  >
                    {code}
                  </Link>
                  {flag.report && <StatusBadge status={flag.report.status} />}
                  {flag.report?.isDemo && <DemoBadge />}
                  <span className="text-muted text-sm">{dateFormatter.format(flag.createdAt)}</span>
                </div>
                {flag.comment && (
                  <blockquote className="border-line border-l-4 pl-3 whitespace-pre-line">
                    {flag.comment.body}
                  </blockquote>
                )}
                {flag.report?.description && (
                  <blockquote className="border-line border-l-4 pl-3 whitespace-pre-line">
                    {flag.report.description}
                  </blockquote>
                )}
                <p className="text-sm">
                  <span className="font-semibold">
                    {translate('backoffice.moderation.reason')} :
                  </span>{' '}
                  {flag.reason}
                </p>
                <AbuseActions
                  flagId={flag.id}
                  commentId={flag.comment?.status === 'PUBLISHED' ? flag.comment.id : null}
                  reportCode={flag.report ? flag.report.trackingCode : null}
                  canReject={Boolean(flag.report && flag.report.status !== 'REJECTED')}
                  canBlock={canBlockUsers(user) && Boolean(flag.comment?.hasAuthor)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
