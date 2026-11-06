import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { getPrisma } from '@/lib/db';
import { Prisma } from '@/generated/prisma/client';
import { recordAudit } from '@/services/audit';
import { ServiceError } from '@/services/errors';
import type { LoginInput, RegisterInput } from '@/validators/auth';

// Inscription et connexion par e-mail et mot de passe (D-034).

/** Empreinte factice : la vérification prend le même temps qu'un compte existe ou non. */
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword('mot-de-passe-factice'));

const INVALID_CREDENTIALS = 'Adresse e-mail ou mot de passe incorrect.';

/** Inscription libre : toujours un compte citoyen (EXG-33). */
export async function register(input: RegisterInput) {
  try {
    const user = await getPrisma().user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: await hashPassword(input.password),
        role: 'CITIZEN',
      },
      select: { id: true },
    });
    await recordAudit({
      actorId: user.id,
      action: 'auth.register',
      entityType: 'user',
      entityId: user.id,
    });
    return { userId: user.id, session: await createSession(user.id) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ServiceError('CONFLICT', 'Un compte existe déjà avec cette adresse e-mail.', {
        email: ['Un compte existe déjà avec cette adresse e-mail.'],
      });
    }
    throw error;
  }
}

export async function login(input: LoginInput) {
  const user = await getPrisma().user.findUnique({
    where: { email: input.email },
    select: { id: true, passwordHash: true, status: true, role: true },
  });
  const valid = await verifyPassword(input.password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !user.passwordHash || !valid || user.status === 'DELETED') {
    throw new ServiceError('UNAUTHENTICATED', INVALID_CREDENTIALS);
  }
  if (user.status === 'BLOCKED') {
    throw new ServiceError(
      'FORBIDDEN',
      'Ce compte est bloqué. Contactez la mairie ou votre délégué.',
    );
  }
  await recordAudit({
    actorId: user.id,
    action: 'auth.login',
    entityType: 'user',
    entityId: user.id,
  });
  return {
    userId: user.id,
    // Administrateur : le second facteur est demandé avant tout droit (EXG-41).
    secondFactorRequired: user.role === 'ADMIN',
    session: await createSession(user.id),
  };
}
