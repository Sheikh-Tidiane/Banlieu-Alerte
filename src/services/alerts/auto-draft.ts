import { interpolate, translate } from '@/i18n';
import { getPrisma } from '@/lib/db';
import { factorLabel, levelLabel } from '@/lib/risk/explain';
import { compareLevels } from '@/lib/risk/score';
import type { RiskLevelCode, RiskResult } from '@/lib/risk/types';
import { recordAudit } from '@/services/audit';

// Brouillons automatiques (choix de l'équipe) : un quartier à « Élevé » ou plus à 24 h crée
// une alerte INDICATIVE en attente d'approbation. Rien n'est envoyé (EXG-29).

export const AUTO_DRAFT_MIN_LEVEL: RiskLevelCode = 'HIGH';
const DRAFT_VALIDITY_HOURS = 24;

/** Statuts qui bloquent un nouveau brouillon pour le même quartier. */
const OPEN_STATUSES = ['PENDING_APPROVAL', 'APPROVED', 'SCHEDULED'] as const;

export async function createRiskDrafts(
  predictions: { id: string; neighborhoodId: string; result: RiskResult }[],
  options: { isDemo: boolean; now: Date },
): Promise<number> {
  const prisma = getPrisma();
  let created = 0;

  for (const prediction of predictions) {
    const level = prediction.result.level;
    if (!level || compareLevels(level, AUTO_DRAFT_MIN_LEVEL) < 0) continue;

    // Pas de doublon tant qu'une alerte du quartier est en attente, programmée ou active.
    const existing = await prisma.alert.findFirst({
      where: {
        neighborhoods: { some: { neighborhoodId: prediction.neighborhoodId } },
        OR: [
          { status: { in: [...OPEN_STATUSES] } },
          { status: 'SENT', validUntil: { gt: options.now } },
        ],
      },
      select: { id: true },
    });
    if (existing) continue;

    const neighborhood = await prisma.neighborhood.findUnique({
      where: { id: prediction.neighborhoodId },
      select: { name: true, isDemo: true },
    });
    if (!neighborhood) continue;

    const levelText = levelLabel(level).toLowerCase();
    const factors = prediction.result.topFactors.map((key) => factorLabel(key).toLowerCase());
    const alert = await prisma.$transaction(async (tx) => {
      const draft = await tx.alert.create({
        data: {
          type: 'INDICATIVE',
          status: 'PENDING_APPROVAL',
          origin: 'RISK_INDEX',
          level,
          issuerName: translate('alertTemplate.issuer'),
          title: interpolate(translate('alertTemplate.title'), {
            level: levelText,
            neighborhood: neighborhood.name,
          }),
          messageFr: interpolate(translate('alertTemplate.message'), {
            level: levelText,
            neighborhood: neighborhood.name,
            factors: factors.join(', '),
          }),
          advice: translate('alertTemplate.advice'),
          validFrom: options.now,
          validUntil: new Date(options.now.getTime() + DRAFT_VALIDITY_HOURS * 3_600_000),
          riskPredictionId: prediction.id,
          isDemo: options.isDemo || neighborhood.isDemo,
          neighborhoods: { create: { neighborhoodId: prediction.neighborhoodId } },
        },
        select: { id: true },
      });
      await recordAudit(
        {
          actorId: null,
          action: 'alert.draft_created',
          entityType: 'alert',
          entityId: draft.id,
          metadata: { level, origin: 'RISK_INDEX' },
        },
        tx,
      );
      return draft;
    });
    if (alert) created += 1;
  }
  return created;
}
