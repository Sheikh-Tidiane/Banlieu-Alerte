import 'dotenv/config';
import { expect, type Page } from '@playwright/test';
import { hotp, base32Decode, totpStep } from '../../src/lib/auth/totp';
import { createPrismaClient } from '../../src/lib/db';

// Second facteur de l'administrateur de démonstration dans les tests (EXG-41) : le code est
// calculé à partir du secret de test de .env. Un code ne sert qu'une fois par période ; avec
// des tests en parallèle, on choisit la première période libre de la fenêtre, sinon on attend.

const prisma = createPrismaClient();
const SECRET = process.env.SEED_TEST_TOTP_SECRET ?? '';

async function nextCode(email: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { totpLastStep: true },
  });
  const current = totpStep(new Date());
  const step = Math.max(current - 1, (user.totpLastStep ?? -1) + 1);
  if (step > current + 1) {
    // Toutes les périodes de la fenêtre sont prises : attendre la suivante.
    await new Promise((r) => setTimeout(r, 30_000));
    return nextCode(email);
  }
  return hotp(base32Decode(SECRET), step);
}

/** Termine la connexion d'un administrateur si la page du second facteur s'affiche. */
export async function completeSecondFactor(page: Page, email: string) {
  if (!/\/connexion\/second-facteur/.test(page.url())) return;
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.getByLabel('Code à 6 chiffres').fill(await nextCode(email));
    await page.getByRole('button', { name: 'Valider' }).click();
    const done = await page
      .waitForURL((url) => !url.pathname.startsWith('/connexion/second-facteur'), {
        timeout: 5_000,
      })
      .then(() => true)
      .catch(() => false);
    if (done) return;
  }
  await expect(page).not.toHaveURL(/second-facteur/);
}

export async function disconnectSecondFactorHelper() {
  await prisma.$disconnect();
}
