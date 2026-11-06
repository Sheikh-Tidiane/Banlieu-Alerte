import { Info, Landmark, MessageCircle } from 'lucide-react';
import { DemoBadge, RiskBadge } from '@/components/ui/badge';
import { interpolate, translate } from '@/i18n';
import { badgeLevel } from '@/lib/risk/explain';
import { cn } from '@/lib/utils/cn';
import type { PublicAlert } from '@/services/alerts/read';

const dateTime = new Intl.DateTimeFormat('fr-SN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Africa/Dakar',
});

/**
 * Alerte publique (EXG-30). Officielle : bandeau plein, émetteur et pictogramme officiel.
 * Indicative : contour en pointillés, aucun pictogramme officiel, mention « indicatif ».
 */
export function AlertCard({
  alert,
  appUrl,
  shareable = false,
}: {
  alert: PublicAlert;
  appUrl?: string;
  /** Partage WhatsApp : alertes officielles en cours seulement (CDC §4.4). */
  shareable?: boolean;
}) {
  const official = alert.type === 'OFFICIAL';
  const until = dateTime.format(new Date(alert.validUntil));
  const share =
    official && shareable && !alert.cancelled
      ? `https://wa.me/?text=${encodeURIComponent(
          `${interpolate(translate('alert.shareText'), { title: alert.title, until })}${appUrl ? ` ${appUrl}/alertes` : ''}`,
        )}`
      : null;

  return (
    <article
      data-alert-type={alert.type}
      aria-labelledby={`alert-${alert.id}`}
      className={cn(
        'rounded-card bg-surface-raised overflow-hidden',
        official ? 'border-danger shadow-soft border-2' : 'border-water border-2 border-dashed',
      )}
    >
      {official ? (
        <p className="bg-danger flex items-center gap-2 px-4 py-2 font-semibold text-white">
          <Landmark aria-hidden="true" className="size-5" />
          {translate('alert.official')}
        </p>
      ) : (
        <p className="bg-water/10 text-ink flex items-center gap-2 px-4 py-2 font-semibold">
          <Info aria-hidden="true" className="text-water size-5" />
          {translate('alert.indicative')}
        </p>
      )}
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <RiskBadge level={badgeLevel(alert.level)} />
          {alert.isDemo && <DemoBadge />}
          {alert.cancelled && (
            <span className="text-muted text-sm font-medium">{translate('alert.lifted')}</span>
          )}
        </div>
        <h3 id={`alert-${alert.id}`} className="font-heading text-lg font-semibold">
          {alert.title}
        </h3>
        <p>{alert.messageFr}</p>
        {alert.messageWo && (
          <p lang="wo" className="text-muted">
            <span className="font-medium">{translate('alert.messageWo')} : </span>
            {alert.messageWo}
          </p>
        )}
        {alert.advice && (
          <div className="rounded-control bg-surface p-3">
            <p className="font-semibold">{translate('alert.advice')}</p>
            <p className="text-sm">{alert.advice}</p>
          </div>
        )}
        {!official && (
          <p className="border-water/40 text-ink rounded-control border bg-transparent p-2 text-sm font-medium">
            {translate('alert.indicativeNotice')}
          </p>
        )}
        <dl className="text-muted grid gap-1 text-sm sm:grid-cols-2">
          <div>
            <dt className="inline font-medium">{translate('alert.issuedBy')} : </dt>
            <dd className="inline">{alert.issuerName}</dd>
          </div>
          <div>
            <dt className="inline font-medium">{translate('alert.zone')} : </dt>
            <dd className="inline">{alert.neighborhoods.join(', ')}</dd>
          </div>
          <div>
            <dt className="inline font-medium">{translate('alert.validFrom')} </dt>
            <dd className="inline">{dateTime.format(new Date(alert.validFrom))}</dd>
          </div>
          <div>
            <dt className="inline font-medium">{translate('alert.validUntil')} </dt>
            <dd className="inline">{until}</dd>
          </div>
        </dl>
        {share && (
          <a
            href={share}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-touch text-primary inline-flex items-center gap-2 font-medium underline"
          >
            <MessageCircle aria-hidden="true" className="size-5" />
            {translate('alert.shareWhatsApp')}
          </a>
        )}
      </div>
    </article>
  );
}
