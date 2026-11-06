/**
 * Réinitialisation du second facteur d'un administrateur (téléphone perdu, plus de codes de
 * secours). Ses sessions sont fermées ; il se réenrôlera à sa prochaine connexion.
 *
 * Usage : npm run admin:reset-mfa -- prenom.nom@exemple.sn
 */
import 'dotenv/config';
import { getPrisma } from '../src/lib/db';
import { resetSecondFactor } from '../src/services/auth/mfa';

const email = process.argv[2] ?? '';
const prisma = getPrisma();
try {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (!user || user.role !== 'ADMIN') throw new Error('Aucun administrateur avec cette adresse.');
  await resetSecondFactor(user.id, null);
  console.log('Second facteur réinitialisé : réenrôlement à la prochaine connexion.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
