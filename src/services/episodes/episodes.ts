import type { Prisma } from '@/generated/prisma/client';
import { interpolate, translate } from '@/i18n';
import { getPrisma } from '@/lib/db';
import { distanceMeters } from '@/lib/geo/distance';
import type { HourlyRain } from '@/lib/weather';
import type { AuthUser } from '@/permissions/types';
import { recordAudit } from '@/services/audit';
import { ServiceError } from '@/services/errors';
import { notify } from '@/services/notifications/user-notifications';

// Épisodes de pluie et étiquettes « inondé / non inondé » (CDC §5.7, D-053). Un épisode est
// déclaré par un agent ou un administrateur ; les étiquettes sont posées par case par une
// personne, « inconnu » par défaut. Signalements et réponses des abonnés ne sont que des indices.

const HOUR_MS = 3_600_000;

function requireEpisodeManager(user: AuthUser) {
  if (user.role !== 'AGENT' && user.role !== 'ADMIN') {
    throw new ServiceError('FORBIDDEN', 'Réservé aux agents et administrateurs.');
  }
}

/** Cases que l'utilisateur peut étiqueter (portée géographique, D-036). */
export function labelableCellsWhere(user: AuthUser): Prisma.RiskCellWhereInput {
  switch (user.role) {
    case 'ADMIN':
      return {};
    case 'AGENT':
      return {
        OR: [
          { neighborhoodId: null },
          ...(user.communeId ? [{ neighborhood: { communeId: user.communeId } }] : []),
        ],
      };
    case 'DELEGATE':
      return { neighborhoodId: { in: user.neighborhoodIds } };
    default:
      return { id: { in: [] } };
  }
}

/** Pluie observée sur l'épisode d'après le relevé réel le plus récent qui couvre la période. */
async function observedRain(startsAt: Date, endsAt: Date): Promise<number | null> {
  const snapshots = await getPrisma().weatherSnapshot.findMany({
    where: { isDemo: false, fetchedAt: { gte: endsAt } },
    orderBy: { fetchedAt: 'asc' },
    take: 5,
    select: { hourly: true },
  });
  for (const snapshot of snapshots) {
    const hourly = snapshot.hourly as HourlyRain;
    const index = new Map(
      hourly.times.map((t, i) => [
        Date.parse(t.endsWith('Z') ? t : `${t}Z`),
        hourly.precipitationMm[i],
      ]),
    );
    let total = 0;
    let complete = true;
    for (
      let t = Math.floor(startsAt.getTime() / HOUR_MS) * HOUR_MS;
      t < endsAt.getTime();
      t += HOUR_MS
    ) {
      const value = index.get(t);
      if (value === undefined || value === null) {
        complete = false;
        break;
      }
      total += Math.max(0, value);
    }
    if (complete) return Math.round(total * 10) / 10;
  }
  // Aucun relevé ne couvre la période : valeur absente, jamais inventée.
  return null;
}

export async function createEpisode(
  user: AuthUser,
  input: { name: string; startsAt: Date; endsAt: Date },
) {
  requireEpisodeManager(user);
  if (input.endsAt <= input.startsAt) {
    throw new ServiceError('VALIDATION_ERROR', 'La fin doit suivre le début.', {
      endsAt: ['La fin doit suivre le début.'],
    });
  }
  if (input.endsAt.getTime() - input.startsAt.getTime() > 7 * 24 * HOUR_MS) {
    throw new ServiceError('VALIDATION_ERROR', 'Un épisode dure au plus 7 jours.', {
      endsAt: ['Un épisode dure au plus 7 jours.'],
    });
  }
  const prisma = getPrisma();
  const rain = await observedRain(input.startsAt, input.endsAt);

  // Question « Votre rue a-t-elle été inondée ? » aux abonnés qui reçoivent dans l'application.
  const subscriptions = await prisma.subscription.findMany({
    where: { channelInApp: true, user: { status: 'ACTIVE' } },
    select: {
      userId: true,
      neighborhoods: { select: { neighborhoodId: true }, take: 1 },
    },
  });
  const byUser = new Map<string, string | null>();
  for (const s of subscriptions) {
    if (!byUser.has(s.userId)) byUser.set(s.userId, s.neighborhoods[0]?.neighborhoodId ?? null);
  }

  return prisma.$transaction(async (tx) => {
    const episode = await tx.rainEpisode.create({
      data: {
        name: input.name,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        observedRainMm: rain,
        createdById: user.id,
      },
      select: { id: true },
    });
    await tx.feedbackPrompt.createMany({
      data: [...byUser].map(([userId, neighborhoodId]) => ({
        episodeId: episode.id,
        userId,
        neighborhoodId,
      })),
      skipDuplicates: true,
    });
    await notify(
      [...byUser.keys()].map((userId) => ({
        userId,
        kind: 'EPISODE_FEEDBACK' as const,
        episodeId: episode.id,
        title: interpolate(translate('episodes.promptTitle'), { name: input.name }),
        link: '/mon-espace#followup',
      })),
      tx,
    );
    await recordAudit(
      {
        actorId: user.id,
        action: 'episode.created',
        entityType: 'episode',
        entityId: episode.id,
        metadata: { prompts: byUser.size, observedRain: rain },
      },
      tx,
    );
    return { id: episode.id, observedRainMm: rain, prompts: byUser.size };
  });
}

export async function listEpisodes() {
  return getPrisma().rainEpisode.findMany({
    orderBy: { startsAt: 'desc' },
    take: 50,
    select: {
      id: true,
      name: true,
      startsAt: true,
      endsAt: true,
      observedRainMm: true,
      status: true,
      isDemo: true,
      _count: { select: { labels: true } },
    },
  });
}

/** Fiche d'étiquetage : cases de la portée, étiquette actuelle et indices (signalements, réponses). */
export async function getEpisodeForLabeling(user: AuthUser, episodeId: string) {
  const prisma = getPrisma();
  const episode = await prisma.rainEpisode.findUnique({
    where: { id: episodeId },
    select: {
      id: true,
      name: true,
      startsAt: true,
      endsAt: true,
      observedRainMm: true,
      status: true,
      isDemo: true,
      validatedAt: true,
      validatedBy: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });
  if (!episode) throw new ServiceError('NOT_FOUND', 'Épisode introuvable.');

  const cells = await prisma.riskCell.findMany({
    where: labelableCellsWhere(user),
    orderBy: [{ neighborhoodId: 'asc' }, { row: 'desc' }, { col: 'asc' }],
    select: {
      id: true,
      row: true,
      col: true,
      centerLat: true,
      centerLng: true,
      sizeMeters: true,
      neighborhood: { select: { id: true, name: true } },
      labels: {
        where: { episodeId },
        select: { label: true, note: true, labeledBy: { select: { name: true } }, updatedAt: true },
      },
    },
  });

  // Indices : signalements d'inondation de la période, rattachés à la case la plus proche.
  const floods = await prisma.report.findMany({
    where: {
      type: 'FLOODING',
      status: { not: 'REJECTED' },
      createdAt: { gte: episode.startsAt, lte: new Date(episode.endsAt.getTime() + 24 * HOUR_MS) },
    },
    select: { lat: true, lng: true },
  });
  const floodCount = new Map<string, number>();
  for (const report of floods) {
    const point = { lat: Number(report.lat), lng: Number(report.lng) };
    let nearest: (typeof cells)[number] | null = null;
    let best = Infinity;
    for (const cell of cells) {
      const d = distanceMeters(point, { lat: Number(cell.centerLat), lng: Number(cell.centerLng) });
      if (d < best) {
        best = d;
        nearest = cell;
      }
    }
    if (nearest && best <= (nearest.sizeMeters * Math.SQRT2) / 2) {
      floodCount.set(nearest.id, (floodCount.get(nearest.id) ?? 0) + 1);
    }
  }

  // Réponses des abonnés, agrégées par quartier (jamais nominatives).
  const answers = await prisma.feedbackPrompt.groupBy({
    by: ['neighborhoodId', 'answer'],
    where: { episodeId, answer: { not: null } },
    _count: { _all: true },
  });
  const feedback = new Map<string, Record<string, number>>();
  for (const a of answers) {
    const key = a.neighborhoodId ?? '';
    const entry = feedback.get(key) ?? {};
    entry[a.answer!] = a._count._all;
    feedback.set(key, entry);
  }

  return {
    episode,
    cells: cells.map((cell) => ({
      id: cell.id,
      label: `${cell.row}:${cell.col}`,
      neighborhood: cell.neighborhood,
      current: cell.labels[0]?.label ?? 'UNKNOWN',
      labeledBy: cell.labels[0]?.labeledBy.name ?? null,
      floodReports: floodCount.get(cell.id) ?? 0,
    })),
    feedback: Object.fromEntries(feedback),
    canValidate: (user.role === 'AGENT' || user.role === 'ADMIN') && episode.status === 'OPEN',
  };
}

export async function setLabels(
  user: AuthUser,
  episodeId: string,
  labels: { cellId: string; label: 'FLOODED' | 'NOT_FLOODED' | 'UNKNOWN' }[],
) {
  const prisma = getPrisma();
  const episode = await prisma.rainEpisode.findUnique({
    where: { id: episodeId },
    select: { status: true, isDemo: true },
  });
  if (!episode) throw new ServiceError('NOT_FOUND', 'Épisode introuvable.');
  if (episode.status !== 'OPEN') {
    throw new ServiceError('CONFLICT', 'Épisode validé : les étiquettes ne sont plus modifiables.');
  }
  const allowed = await prisma.riskCell.findMany({
    where: { AND: [labelableCellsWhere(user), { id: { in: labels.map((l) => l.cellId) } }] },
    select: { id: true },
  });
  if (allowed.length !== new Set(labels.map((l) => l.cellId)).size) {
    throw new ServiceError('FORBIDDEN', 'Cases hors de votre périmètre.');
  }

  let changed = 0;
  await prisma.$transaction(async (tx) => {
    for (const { cellId, label } of labels) {
      const existing = await tx.episodeLabel.findUnique({
        where: { episodeId_cellId: { episodeId, cellId } },
        select: { id: true, label: true },
      });
      if ((existing?.label ?? 'UNKNOWN') === label) continue;
      const saved = existing
        ? await tx.episodeLabel.update({
            where: { id: existing.id },
            data: { label, labeledById: user.id },
            select: { id: true },
          })
        : await tx.episodeLabel.create({
            data: { episodeId, cellId, label, labeledById: user.id, isDemo: episode.isDemo },
            select: { id: true },
          });
      await tx.episodeLabelHistory.create({
        data: {
          labelId: saved.id,
          fromLabel: existing?.label ?? null,
          toLabel: label,
          changedById: user.id,
        },
      });
      changed += 1;
    }
    if (changed > 0) {
      await recordAudit(
        {
          actorId: user.id,
          action: 'episode.label_set',
          entityType: 'episode',
          entityId: episodeId,
          metadata: { changed },
        },
        tx,
      );
    }
  });
  return { changed };
}

export async function validateEpisode(user: AuthUser, episodeId: string) {
  requireEpisodeManager(user);
  const prisma = getPrisma();
  const known = await prisma.episodeLabel.count({
    where: { episodeId, label: { not: 'UNKNOWN' } },
  });
  if (known === 0) {
    throw new ServiceError(
      'CONFLICT',
      'Aucune étiquette « inondé » ou « non inondé » : rien à valider.',
    );
  }
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.rainEpisode.updateMany({
      where: { id: episodeId, status: 'OPEN' },
      data: { status: 'VALIDATED', validatedAt: new Date(), validatedById: user.id },
    });
    if (claimed.count !== 1)
      throw new ServiceError('CONFLICT', 'Épisode déjà validé ou introuvable.');
    await recordAudit(
      {
        actorId: user.id,
        action: 'episode.validated',
        entityType: 'episode',
        entityId: episodeId,
        metadata: { labels: known },
      },
      tx,
    );
  });
  return { validated: true, labels: known };
}

// --- Question aux abonnés ---------------------------------------------------------

export async function listMyFeedbackPrompts(user: AuthUser) {
  return getPrisma().feedbackPrompt.findMany({
    where: { userId: user.id, answer: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      episode: { select: { name: true, startsAt: true, endsAt: true } },
      neighborhood: { select: { name: true } },
    },
  });
}

export async function answerFeedbackPrompt(
  user: AuthUser,
  promptId: string,
  answer: 'FLOODED' | 'NOT_FLOODED' | 'DONT_KNOW',
) {
  const updated = await getPrisma().feedbackPrompt.updateMany({
    where: { id: promptId, userId: user.id, answer: null },
    data: { answer, answeredAt: new Date() },
  });
  if (updated.count !== 1)
    throw new ServiceError('NOT_FOUND', 'Question introuvable ou déjà traitée.');
  return { answered: true };
}
