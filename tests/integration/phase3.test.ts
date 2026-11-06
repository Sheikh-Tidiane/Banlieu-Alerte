import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSession, getUserFromToken } from '@/lib/auth/session';
import { hashToken } from '@/lib/auth/tokens';
import { getPrisma } from '@/lib/db';
import type { AuthUser } from '@/permissions/types';
import { deleteMyAccount, exportMyData } from '@/services/account/account';
import { login, register } from '@/services/auth/credentials';
import { getStaffReport, listStaffReports } from '@/services/backoffice/reports';
import {
  addInternalNote,
  assignReport,
  changeStatus,
  mergeReport,
} from '@/services/backoffice/processing';
import { ServiceError } from '@/services/errors';
import {
  acceptInvitation,
  createInvitation,
  createPasswordReset,
  findValidInvitation,
  revokeInvitation,
  setUserBlocked,
  consumePasswordReset,
} from '@/services/invitations/invitations';
import { createReport } from '@/services/reports/create';
import { confirmReport } from '@/services/reports/engagement';
import { findMergeTarget, getPublicReport } from '@/services/reports/read';
import { createReportSchema } from '@/validators/report';
import { staffListSchema } from '@/validators/backoffice';

// Nécessite la base migrée et le seed appliqué (npm run test:db).
const prisma = getPrisma();
const password = process.env.SEED_TEST_PASSWORD ?? '';
const createdCodes: string[] = [];
const createdEmails: string[] = [];

async function asUser(email: string): Promise<AuthUser> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
  const { token } = await createSession(user.id);
  return (await getUserFromToken(token))!;
}

let admin: AuthUser;
let agent: AuthUser;
let delegate: AuthUser;

const uniqueEmail = (prefix: string) => {
  const email = `${prefix}-${randomUUID().slice(0, 8)}@banlieue-alerte.test`;
  createdEmails.push(email);
  return email;
};

let offset = 0;
async function newReport(lat = 14.7488, lng = -17.3812) {
  offset += 0.0015;
  const { trackingCode } = await createReport(
    createReportSchema.parse({
      type: 'BLOCKED_DRAIN',
      severity: 'MEDIUM',
      lat: String(lat + offset),
      lng: String(lng),
      confirmNotDuplicate: 'true',
    }),
    null,
  );
  createdCodes.push(trackingCode);
  return trackingCode;
}

beforeAll(async () => {
  admin = await asUser('admin.demo@banlieue-alerte.test');
  agent = await asUser('agent.demo@banlieue-alerte.test');
  delegate = await asUser('delegue.demo@banlieue-alerte.test');
});

afterAll(async () => {
  await prisma.report.deleteMany({ where: { trackingCode: { in: createdCodes } } });
  const users = await prisma.user.findMany({
    where: { OR: [{ email: { in: createdEmails } }, { status: 'DELETED', isDemo: false }] },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  await prisma.neighborhood.updateMany({
    where: { delegateId: { in: ids } },
    data: { delegateId: null },
  });
  await prisma.invitation.deleteMany({
    where: { OR: [{ email: { in: createdEmails } }, { acceptedById: { in: ids } }] },
  });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  // Le délégué de démonstration redevient responsable de Thiaroye Gare.
  await prisma.neighborhood.updateMany({
    where: { name: 'Thiaroye Gare', isDemo: true },
    data: { delegateId: delegate.id },
  });
  await prisma.$disconnect();
});

describe('comptes et sessions (EXG-40, D-034)', () => {
  it('connexion réussie avec les 4 comptes de test', async () => {
    for (const email of ['habitant', 'delegue', 'agent', 'admin'].map(
      (p) => `${p}.demo@banlieue-alerte.test`,
    )) {
      const { session } = await login({ email, password });
      expect((await getUserFromToken(session.token))?.email).toBe(email);
    }
  });

  it('inscription libre : toujours citoyen ; adresse déjà prise refusée', async () => {
    const email = uniqueEmail('habitant');
    const { session } = await register({ name: 'Awa Test', email, password: 'mot-de-passe-test' });
    expect((await getUserFromToken(session.token))?.role).toBe('CITIZEN');
    await expect(
      register({ name: 'Autre', email, password: 'mot-de-passe-test' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('même message pour un e-mail inconnu et un mauvais mot de passe', async () => {
    const unknown = await login({ email: 'inconnu@banlieue-alerte.test', password }).catch(
      (e: ServiceError) => e,
    );
    const wrong = await login({
      email: 'agent.demo@banlieue-alerte.test',
      password: 'faux-mot-de-passe',
    }).catch((e: ServiceError) => e);
    expect(unknown).toBeInstanceOf(ServiceError);
    expect((unknown as ServiceError).message).toBe((wrong as ServiceError).message);
  });

  it('seule l’empreinte du jeton est stockée ; session expirée refusée', async () => {
    const { token } = await createSession(agent.id);
    const stored = await prisma.session.findUniqueOrThrow({
      where: { tokenHash: hashToken(token) },
    });
    expect(stored.tokenHash).not.toBe(token);
    await prisma.session.update({
      where: { id: stored.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await getUserFromToken(token)).toBeNull();
  });

  it('compte bloqué : connexion refusée et sessions fermées', async () => {
    const email = uniqueEmail('bloque');
    const { session } = await register({
      name: 'Compte Bloqué',
      email,
      password: 'mot-de-passe-test',
    });
    const user = (await getUserFromToken(session.token))!;
    await setUserBlocked(admin, user.id, true);
    expect(await getUserFromToken(session.token)).toBeNull();
    await expect(login({ email, password: 'mot-de-passe-test' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('invitations (EXG-33)', () => {
  it('cycle complet : création, jeton haché, acceptation, usage unique, journal', async () => {
    const neighborhood = await prisma.neighborhood.findFirstOrThrow({
      where: { name: 'Diamaguène' },
    });
    const email = uniqueEmail('delegue');
    const invitation = await createInvitation(admin, {
      email,
      role: 'DELEGATE',
      neighborhoodId: neighborhood.id,
    });
    const token = invitation.link.split('/').pop()!;
    const stored = await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
    expect(stored.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(stored)).not.toContain(token);

    const { session } = await acceptInvitation(token, 'Délégué Diamaguène', 'mot-de-passe-test');
    const user = (await getUserFromToken(session.token))!;
    expect(user.role).toBe('DELEGATE');
    expect(user.neighborhoodIds).toEqual([neighborhood.id]);
    await expect(acceptInvitation(token, 'Encore', 'mot-de-passe-test')).rejects.toBeInstanceOf(
      ServiceError,
    );

    const actions = (await prisma.auditLog.findMany({ where: { entityId: invitation.id } })).map(
      (a) => a.action,
    );
    expect(actions).toEqual(expect.arrayContaining(['invitation.created', 'invitation.accepted']));
    await prisma.neighborhood.update({
      where: { id: neighborhood.id },
      data: { delegateId: null },
    });
  });

  it('invitation expirée ou révoquée refusée', async () => {
    const commune = await prisma.commune.findFirstOrThrow();
    const expired = await createInvitation(admin, {
      email: uniqueEmail('agent'),
      role: 'AGENT',
      communeId: commune.id,
    });
    await prisma.invitation.update({
      where: { id: expired.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await findValidInvitation(expired.link.split('/').pop()!)).toBeNull();

    const revoked = await createInvitation(admin, {
      email: uniqueEmail('agent'),
      role: 'AGENT',
      communeId: commune.id,
    });
    await revokeInvitation(admin, revoked.id);
    await expect(
      acceptInvitation(revoked.link.split('/').pop()!, 'X', 'mot-de-passe-test'),
    ).rejects.toBeInstanceOf(ServiceError);
  });

  it('seul un administrateur invite', async () => {
    await expect(
      createInvitation(agent, { email: uniqueEmail('x'), role: 'ADMIN' }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('lien de réinitialisation : usage unique, anciennes sessions fermées', async () => {
    const email = uniqueEmail('reset');
    const { session } = await register({
      name: 'Mot de passe oublié',
      email,
      password: 'ancien-mot-de-passe',
    });
    const user = (await getUserFromToken(session.token))!;
    const { link } = await createPasswordReset(admin, user.id);
    const token = link.split('/').pop()!;
    await consumePasswordReset(token, 'nouveau-mot-de-passe');
    expect(await getUserFromToken(session.token)).toBeNull();
    await expect(login({ email, password: 'nouveau-mot-de-passe' })).resolves.toBeTruthy();
    await expect(consumePasswordReset(token, 'encore-un-autre')).rejects.toBeInstanceOf(
      ServiceError,
    );
  });
});

describe('traitement des signalements (EXG-05, EXG-07)', () => {
  it('parcours : vérification (délégué) → assignation et résolution (agent), historique complet', async () => {
    const code = await newReport();
    await changeStatus(delegate, code, 'VERIFIED');
    const assigned = await assignReport(agent, code, agent.id);
    expect(assigned.status).toBe('ASSIGNED');
    await changeStatus(agent, code, 'IN_PROGRESS');
    await changeStatus(agent, code, 'RESOLVED');

    const report = await prisma.report.findUniqueOrThrow({
      where: { trackingCode: code },
      include: { statusHistory: { orderBy: { createdAt: 'asc' } } },
    });
    expect(report.status).toBe('RESOLVED');
    expect(report.resolvedAt).not.toBeNull();
    expect(report.statusHistory.map((h) => h.toStatus)).toEqual([
      'NEW',
      'VERIFIED',
      'ASSIGNED',
      'IN_PROGRESS',
      'RESOLVED',
    ]);
    const publicReport = await getPublicReport(code);
    expect(publicReport?.status).toBe('RESOLVED');
    expect(JSON.stringify(publicReport)).not.toContain(agent.id);
  });

  it('refus hors portée et transitions interdites', async () => {
    const outside = await newReport(14.7598, -17.3899); // Diamaguène : hors du quartier du délégué
    await expect(changeStatus(delegate, outside, 'VERIFIED')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(changeStatus(agent, outside, 'RESOLVED')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(changeStatus(agent, outside, 'REJECTED')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    await expect(assignReport(delegate, outside, agent.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    const list = await listStaffReports(delegate, staffListSchema.parse({ q: outside }));
    expect(list.total).toBe(0);
    await expect(getStaffReport(delegate, outside)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('notes internes : visibles au back-office, jamais publiées', async () => {
    const code = await newReport();
    await addInternalNote(agent, code, 'Note interne confidentielle');
    const staff = await getStaffReport(agent, code);
    expect(
      staff.comments.some((c) => c.isInternal && c.body === 'Note interne confidentielle'),
    ).toBe(true);
    expect(JSON.stringify(await getPublicReport(code))).not.toContain('confidentielle');
  });

  it('fusion d’un doublon : confirmations reportées, renvoi vers le principal', async () => {
    const primary = await newReport();
    const duplicate = await newReport();
    await confirmReport(duplicate, randomUUID());
    const before = (await prisma.report.findUniqueOrThrow({ where: { trackingCode: primary } }))
      .confirmationCount;
    await mergeReport(agent, duplicate, primary);
    const after = await prisma.report.findUniqueOrThrow({ where: { trackingCode: primary } });
    expect(after.confirmationCount).toBe(before + 2); // le vote déplacé + le doublon lui-même
    expect(await findMergeTarget(duplicate)).toBe(primary);
    expect(await getPublicReport(duplicate)).toBeNull();
    await expect(mergeReport(agent, duplicate, primary)).rejects.toBeInstanceOf(ServiceError);
  });
});

describe('espace citoyen (D-039)', () => {
  it('export puis suppression : signalements conservés sans auteur, connexion impossible', async () => {
    const email = uniqueEmail('supprime');
    const { session } = await register({
      name: 'À supprimer',
      email,
      password: 'mot-de-passe-test',
    });
    const user = (await getUserFromToken(session.token))!;
    const { trackingCode } = await createReport(
      createReportSchema.parse({
        type: 'OTHER',
        severity: 'LOW',
        lat: '14.9',
        lng: '-17.2',
        confirmNotDuplicate: 'true',
      }),
      null,
      user.id,
    );
    createdCodes.push(trackingCode);

    const exported = await exportMyData(user);
    expect(exported.account.email).toBe(email);
    expect(exported.reports.map((r) => r.trackingCode)).toContain(trackingCode);

    await deleteMyAccount(user);
    const report = await prisma.report.findUniqueOrThrow({ where: { trackingCode } });
    expect(report.authorId).toBeNull();
    const deleted = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(deleted).toMatchObject({
      email: null,
      passwordHash: null,
      status: 'DELETED',
      name: 'Compte supprimé',
    });
    expect(await getUserFromToken(session.token)).toBeNull();
    await expect(login({ email, password: 'mot-de-passe-test' })).rejects.toBeInstanceOf(
      ServiceError,
    );
  });

  it('un compte sensible ne se supprime pas lui-même', async () => {
    await expect(deleteMyAccount(agent)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('journal d’audit (EXG-18)', () => {
  it('aucune donnée personnelle ni secret dans les métadonnées', async () => {
    const logs = await prisma.auditLog.findMany({
      select: { metadata: true },
      take: 500,
      orderBy: { createdAt: 'desc' },
    });
    expect(logs.length).toBeGreaterThan(0);
    const json = JSON.stringify(logs);
    expect(json).not.toMatch(/@banlieue-alerte\.test|password|tokenHash|"email"/);
    if (password) expect(json).not.toContain(password);
  });
});
