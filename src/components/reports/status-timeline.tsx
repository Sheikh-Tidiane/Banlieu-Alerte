import { StatusBadge } from '@/components/ui/badge';
import { translate } from '@/i18n';
import type { ReportStatus } from '@/validators/report';

const formatter = new Intl.DateTimeFormat('fr-SN', { dateStyle: 'medium', timeStyle: 'short' });

/** Historique public du traitement (EXG-07) : statut et date, sans auteur ni note interne. */
export function StatusTimeline({
  history,
}: {
  history: { status: ReportStatus; at: string; reopenedByResident?: boolean }[];
}) {
  return (
    <ol className="border-line relative space-y-4 border-l-2 pl-6">
      {history.map((step, index) => (
        <li key={`${step.status}-${step.at}`} className="relative">
          <span
            aria-hidden="true"
            className={`rounded-pill border-surface-raised absolute top-1.5 -left-[33px] size-4 border-2 ${
              index === history.length - 1 ? 'bg-primary' : 'bg-line'
            }`}
          />
          <StatusBadge status={step.status} />
          {step.reopenedByResident && (
            <p className="mt-1 text-sm font-medium">
              {translate('backoffice.report.feedbackREOPENED')}
            </p>
          )}
          <p className="text-muted mt-1 text-sm">
            <time dateTime={step.at}>{formatter.format(new Date(step.at))}</time>
          </p>
        </li>
      ))}
    </ol>
  );
}
