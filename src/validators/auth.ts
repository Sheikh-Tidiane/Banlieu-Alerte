import { z } from 'zod';

export const PASSWORD_MIN = 10;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ message: 'Adresse e-mail invalide.' }));

export const password = z
  .string()
  .min(PASSWORD_MIN, `${PASSWORD_MIN} caractères minimum.`)
  .max(200, '200 caractères maximum.');

export const personName = z
  .string()
  .trim()
  .min(2, 'Indiquez votre nom (2 caractères minimum).')
  .max(120, '120 caractères maximum.');

/**
 * Inscription libre : citoyen uniquement (EXG-33). `strict()` refuse tout champ inconnu,
 * en particulier une tentative de choisir son rôle.
 */
export const registerSchema = z.strictObject({ name: personName, email, password });

export const loginSchema = z.strictObject({
  email,
  password: z.string().min(1, 'Indiquez votre mot de passe.').max(200),
});

/** Acceptation d'une invitation ou d'une réinitialisation : nouveau mot de passe. */
export const setPasswordSchema = z.strictObject({ name: personName.optional(), password });

export const profileSchema = z.strictObject({
  name: personName.optional(),
  locale: z.enum(['fr', 'wo']).optional(),
  notifyStatusChanges: z.boolean().optional(),
});

export type RegisterInput = z.output<typeof registerSchema>;
export type LoginInput = z.output<typeof loginSchema>;

export const INVITABLE_ROLES = ['DELEGATE', 'AGENT', 'ADMIN'] as const;

/** Invitation d'un compte sensible : la portée est obligatoire pour un délégué ou un agent. */
export const invitationSchema = z
  .strictObject({
    email,
    role: z.enum(INVITABLE_ROLES, { message: 'Rôle invalide.' }),
    communeId: z.string().max(40).optional(),
    neighborhoodId: z.string().max(40).optional(),
  })
  .refine((v) => v.role !== 'AGENT' || Boolean(v.communeId), {
    message: 'Choisissez la commune de l’agent.',
    path: ['communeId'],
  })
  .refine((v) => v.role !== 'DELEGATE' || Boolean(v.neighborhoodId), {
    message: 'Choisissez le quartier du délégué.',
    path: ['neighborhoodId'],
  });

export type InvitationInput = z.output<typeof invitationSchema>;

export const userIdSchema = z.strictObject({ userId: z.string().min(1).max(40) });
export const blockSchema = z.strictObject({ blocked: z.boolean() });
