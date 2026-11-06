import { getPrisma } from '@/lib/db';
import { DEFAULT_ESCALATION_RULES } from '@/lib/escalation/rules';
import { DEFAULT_RULE_NAME, DEFAULT_RULE_PARAMS } from '@/lib/risk/rules';

/**
 * Réglages par défaut d'une installation neuve (sans données de démonstration) : grille v1
 * de l'indice (D-046) et délais d'escalade (D-056). Rien n'est modifié s'ils existent déjà.
 */
export async function ensureDefaultSettings() {
  const prisma = getPrisma();
  let created = 0;
  if ((await prisma.ruleVersion.count()) === 0) {
    await prisma.ruleVersion.create({
      data: {
        number: 1,
        name: DEFAULT_RULE_NAME,
        notes:
          'Hypothèse de départ (D-046), à valider avec des délégués ou un expert (ANACIM, service technique).',
        params: DEFAULT_RULE_PARAMS,
        isActive: true,
        activatedAt: new Date(),
      },
    });
    created += 1;
  }
  if ((await prisma.escalationRule.count()) === 0) {
    await prisma.escalationRule.createMany({ data: DEFAULT_ESCALATION_RULES });
    created += 1;
  }
  return { created };
}
