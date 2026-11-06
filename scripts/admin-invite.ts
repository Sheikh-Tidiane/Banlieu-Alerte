/**
 * Premier administrateur (D-040) : crée une invitation administrateur et affiche le lien.
 * Aucun compte administrateur n'existe par défaut hors seed de démonstration.
 *
 * Usage : npm run admin:invite -- prenom.nom@exemple.sn
 */
import 'dotenv/config';
import { getPrisma } from '../src/lib/db';
import { createInvitation } from '../src/services/invitations/invitations';
import { invitationSchema } from '../src/validators/auth';

const parsed = invitationSchema.safeParse({ email: process.argv[2] ?? '', role: 'ADMIN' });
if (!parsed.success) {
  console.error(
    'Adresse e-mail manquante ou invalide. Usage : npm run admin:invite -- adresse@exemple.sn',
  );
  process.exit(1);
}

try {
  const invitation = await createInvitation(null, parsed.data);
  console.log(
    `Invitation administrateur créée (valable jusqu'au ${invitation.expiresAt.toLocaleString('fr-SN')}).`,
  );
  console.log('Lien à usage unique, affiché une seule fois :');
  console.log(invitation.link);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await getPrisma().$disconnect();
}
