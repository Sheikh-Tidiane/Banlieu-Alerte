import { getPrisma } from '@/lib/db';
import type { RuleParams } from '@/lib/risk/types';
import { canManageRules } from '@/permissions/policies';
import type { AuthUser } from '@/permissions/types';
import { recordAudit } from '@/services/audit';
import { ServiceError } from '@/services/errors';
import { ruleParamsSchema } from '@/validators/risk';

// Versions de la grille de règles (EXG-42) : création, activation, retour en arrière.
// Une version n'est jamais modifiée après création : on en crée une nouvelle.

export type ActiveRules = { id: string; number: number; name: string; params: RuleParams };

export async function getActiveRules(): Promise<ActiveRules> {
  const version = await getPrisma().ruleVersion.findFirst({
    where: { isActive: true },
    select: { id: true, number: true, name: true, params: true },
  });
  if (!version) throw new ServiceError('CONFLICT', 'Aucune grille de règles active.');
  const params = ruleParamsSchema.safeParse(version.params);
  if (!params.success) throw new ServiceError('CONFLICT', 'Grille de règles active invalide.');
  return { ...version, params: params.data };
}

export async function listRuleVersions() {
  return getPrisma().ruleVersion.findMany({
    orderBy: { number: 'desc' },
    select: {
      id: true,
      number: true,
      name: true,
      notes: true,
      params: true,
      isActive: true,
      createdAt: true,
      activatedAt: true,
      createdBy: { select: { name: true } },
      _count: { select: { runs: true } },
    },
  });
}

function requireManager(user: AuthUser) {
  if (!canManageRules(user)) throw new ServiceError('FORBIDDEN', 'Réservé aux administrateurs.');
}

export async function createRuleVersion(
  user: AuthUser,
  input: { name: string; notes?: string; params: RuleParams; activate: boolean },
) {
  requireManager(user);
  return getPrisma().$transaction(async (tx) => {
    const last = await tx.ruleVersion.findFirst({
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const number = (last?.number ?? 0) + 1;
    if (input.activate) await tx.ruleVersion.updateMany({ data: { isActive: false } });
    const version = await tx.ruleVersion.create({
      data: {
        number,
        name: input.name,
        notes: input.notes ?? null,
        params: input.params,
        isActive: input.activate,
        activatedAt: input.activate ? new Date() : null,
        createdById: user.id,
      },
      select: { id: true, number: true, isActive: true },
    });
    await recordAudit(
      {
        actorId: user.id,
        action: 'risk.rules_created',
        entityType: 'rule_version',
        entityId: version.id,
        metadata: { number, activated: input.activate },
      },
      tx,
    );
    return version;
  });
}

/** Active une version (y compris une version précédente : retour en arrière). */
export async function activateRuleVersion(user: AuthUser, versionId: string) {
  requireManager(user);
  return getPrisma().$transaction(async (tx) => {
    const version = await tx.ruleVersion.findUnique({
      where: { id: versionId },
      select: { id: true, number: true, params: true },
    });
    if (!version) throw new ServiceError('NOT_FOUND', 'Version introuvable.');
    if (!ruleParamsSchema.safeParse(version.params).success) {
      throw new ServiceError('VALIDATION_ERROR', 'Cette version contient une grille invalide.');
    }
    const previous = await tx.ruleVersion.findFirst({
      where: { isActive: true },
      select: { number: true },
    });
    await tx.ruleVersion.updateMany({ data: { isActive: false } });
    await tx.ruleVersion.update({
      where: { id: versionId },
      data: { isActive: true, activatedAt: new Date() },
    });
    await recordAudit(
      {
        actorId: user.id,
        action: 'risk.rules_activated',
        entityType: 'rule_version',
        entityId: versionId,
        metadata: { number: version.number, previousNumber: previous?.number ?? null },
      },
      tx,
    );
    return { id: version.id, number: version.number };
  });
}
