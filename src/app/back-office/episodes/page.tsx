import type { Metadata } from 'next';
import Link from 'next/link';
import { CreateEpisodeForm } from '@/components/episodes/episode-forms';
import { Badge, DemoBadge } from '@/components/ui/badge';
import { Card, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { translate } from '@/i18n';
import { dakarInputInHours } from '@/lib/utils/dakar-time';
import { STAFF_ROLES } from '@/permissions/policies';
import { requirePageUser } from '@/permissions/require';
import { listEpisodes } from '@/services/episodes/episodes';

export const metadata: Metadata = { title: translate('episodes.title') };

const dateFormatter = new Intl.DateTimeFormat('fr-SN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Africa/Dakar',
});
const mm = new Intl.NumberFormat('fr-SN', { maximumFractionDigits: 1 });

export default async function EpisodesPage() {
  const user = await requirePageUser('/back-office/episodes', STAFF_ROLES);
  const episodes = await listEpisodes();
  const canCreate = user.role === 'AGENT' || user.role === 'ADMIN';

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">{translate('episodes.title')}</h2>
        <p className="text-muted max-w-3xl">{translate('episodes.intro')}</p>
      </div>
      {canCreate && (
        <Card className="max-w-2xl space-y-3">
          <CardTitle>{translate('episodes.create')}</CardTitle>
          <p className="text-muted text-sm">{translate('episodes.createHint')}</p>
          <CreateEpisodeForm
            defaults={{ startsAt: dakarInputInHours(-24), endsAt: dakarInputInHours(0) }}
          />
        </Card>
      )}
      {episodes.length === 0 ? (
        <EmptyState title={translate('episodes.empty')} />
      ) : (
        <ul className="grid gap-3">
          {episodes.map((episode) => (
            <li key={episode.id}>
              <Link
                href={`/back-office/episodes/${episode.id}`}
                className="rounded-card border-line bg-surface-raised hover:border-primary block space-y-1 border p-4"
                data-testid="episode"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone={episode.status === 'VALIDATED' ? 'safe' : 'accent'}>
                    {translate(`episodes.status.${episode.status}`)}
                  </Badge>
                  {episode.isDemo && <DemoBadge />}
                </span>
                <span className="font-heading block font-semibold">{episode.name}</span>
                <span className="text-muted block text-sm">
                  {dateFormatter.format(episode.startsAt)} → {dateFormatter.format(episode.endsAt)}{' '}
                  ·{' '}
                  {episode.observedRainMm === null
                    ? translate('episodes.observedRainMissing')
                    : `${translate('episodes.observedRain')} : ${mm.format(Number(episode.observedRainMm))} mm`}{' '}
                  · {episode._count.labels} {translate('episodes.labels')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
