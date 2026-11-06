import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LabelingForm, ValidateEpisodeButton } from '@/components/episodes/episode-forms';
import { Badge, DemoBadge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { StateBanner } from '@/components/ui/states';
import { translate } from '@/i18n';
import { STAFF_ROLES } from '@/permissions/policies';
import { requirePageUser } from '@/permissions/require';
import { getEpisodeForLabeling } from '@/services/episodes/episodes';
import { ServiceError } from '@/services/errors';

export const metadata: Metadata = { title: translate('episodes.title') };

const dateFormatter = new Intl.DateTimeFormat('fr-SN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Africa/Dakar',
});
const mm = new Intl.NumberFormat('fr-SN', { maximumFractionDigits: 1 });

type Props = { params: Promise<{ id: string }> };

export default async function EpisodePage({ params }: Props) {
  const { id } = await params;
  const user = await requirePageUser(`/back-office/episodes/${id}`, STAFF_ROLES);
  let data: Awaited<ReturnType<typeof getEpisodeForLabeling>>;
  try {
    data = await getEpisodeForLabeling(user, id);
  } catch (error) {
    if (error instanceof ServiceError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
  const { episode, cells, feedback } = data;
  const readOnly = episode.status !== 'OPEN';
  const answers = Object.entries(feedback);

  return (
    <div className="space-y-6">
      <Link href="/back-office/episodes" className={buttonVariants({ variant: 'ghost' })}>
        <ArrowLeft aria-hidden="true" />
        {translate('episodes.back')}
      </Link>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={readOnly ? 'safe' : 'accent'}>
            {translate(`episodes.status.${episode.status}`)}
          </Badge>
          {episode.isDemo && <DemoBadge />}
        </div>
        <h2 className="text-2xl font-semibold">{episode.name}</h2>
        <p className="text-muted text-sm">
          {dateFormatter.format(episode.startsAt)} → {dateFormatter.format(episode.endsAt)} ·{' '}
          {episode.observedRainMm === null
            ? translate('episodes.observedRainMissing')
            : `${translate('episodes.observedRain')} : ${mm.format(Number(episode.observedRainMm))} mm`}
          {episode.validatedBy &&
            ` · ${translate('episodes.validatedBy')} ${episode.validatedBy.name}`}
        </p>
      </div>
      <StateBanner kind="info" title={translate('episodes.labelHint')} />

      <Card className="space-y-2">
        <CardTitle>{translate('episodes.feedbackTitle')}</CardTitle>
        {answers.length === 0 ? (
          <p className="text-muted text-sm">{translate('episodes.feedbackNone')}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {answers.map(([neighborhoodId, counts]) => {
              const name =
                cells.find((c) => c.neighborhood?.id === neighborhoodId)?.neighborhood?.name ??
                translate('episodes.unidentified');
              return (
                <li key={neighborhoodId || 'none'}>
                  <span className="font-medium">{name}</span> :{' '}
                  {Object.entries(counts)
                    .map(
                      ([answer, count]) =>
                        `${count} ${translate(`episodes.answer.${answer as 'FLOODED' | 'NOT_FLOODED' | 'DONT_KNOW'}`)}`,
                    )
                    .join(', ')}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <LabelingForm episodeId={episode.id} cells={cells} readOnly={readOnly} />
      {data.canValidate && <ValidateEpisodeButton episodeId={episode.id} />}
    </div>
  );
}
