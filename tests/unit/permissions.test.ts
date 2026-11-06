import { describe, expect, it } from 'vitest';
import { safeNextPath } from '@/components/auth/auth-form';
import { isSameOrigin } from '@/lib/auth/csrf';
import { generateToken, hashToken } from '@/lib/auth/tokens';
import {
  allowedTransitions,
  canAssign,
  canBlockUsers,
  canChangeStatus,
  canInvite,
  canMerge,
  isReportInScope,
  STATUS_TRANSITIONS,
} from '@/permissions/policies';
import { reportScopeWhere } from '@/permissions/scope';
import type { AuthUser, ScopedReport } from '@/permissions/types';
import { sanitizeMetadata } from '@/services/audit';
import { registerSchema } from '@/validators/auth';

const base = { name: 'Test', email: null, locale: 'fr' };
const admin: AuthUser = { ...base, id: 'a', role: 'ADMIN', communeId: null, neighborhoodIds: [] };
const agent: AuthUser = { ...base, id: 'g', role: 'AGENT', communeId: 'c1', neighborhoodIds: [] };
const delegate: AuthUser = {
  ...base,
  id: 'd',
  role: 'DELEGATE',
  communeId: null,
  neighborhoodIds: ['n1'],
};
const citizen: AuthUser = {
  ...base,
  id: 'u',
  role: 'CITIZEN',
  communeId: null,
  neighborhoodIds: [],
};

const inN1: ScopedReport = {
  status: 'NEW',
  neighborhoodId: 'n1',
  neighborhood: { communeId: 'c1' },
};
const inN2: ScopedReport = {
  status: 'NEW',
  neighborhoodId: 'n2',
  neighborhood: { communeId: 'c2' },
};
const unidentified: ScopedReport = { status: 'NEW', neighborhoodId: null, neighborhood: null };

describe('portée géographique (EXG-05)', () => {
  it('délégué : seulement ses quartiers', () => {
    expect(isReportInScope(delegate, inN1)).toBe(true);
    expect(isReportInScope(delegate, inN2)).toBe(false);
    expect(isReportInScope(delegate, unidentified)).toBe(false);
  });

  it('agent : sa commune et les signalements sans quartier', () => {
    expect(isReportInScope(agent, inN1)).toBe(true);
    expect(isReportInScope(agent, inN2)).toBe(false);
    expect(isReportInScope(agent, unidentified)).toBe(true);
  });

  it('administrateur : tout ; citoyen : rien au back-office', () => {
    expect([inN1, inN2, unidentified].every((r) => isReportInScope(admin, r))).toBe(true);
    expect(isReportInScope(citizen, inN1)).toBe(false);
    expect(reportScopeWhere(citizen)).toEqual({ id: { in: [] } });
    expect(reportScopeWhere(delegate)).toEqual({ neighborhoodId: { in: ['n1'] } });
  });
});

describe('transitions de statut (EXG-07, D-037)', () => {
  it('le délégué vérifie ou rejette, sans traiter', () => {
    expect(allowedTransitions(delegate, inN1).sort()).toEqual(['REJECTED', 'VERIFIED']);
    expect(canChangeStatus(delegate, { ...inN1, status: 'VERIFIED' }, 'ASSIGNED')).toBe(false);
    expect(canChangeStatus(delegate, inN2, 'VERIFIED')).toBe(false);
  });

  it("l'agent suit le graphe, réouverture comprise", () => {
    expect(canChangeStatus(agent, { ...inN1, status: 'VERIFIED' }, 'ASSIGNED')).toBe(true);
    expect(canChangeStatus(agent, { ...inN1, status: 'RESOLVED' }, 'IN_PROGRESS')).toBe(true);
    expect(canChangeStatus(agent, inN1, 'RESOLVED')).toBe(false);
  });

  it('aucun statut ne mène à lui-même', () => {
    for (const [from, targets] of Object.entries(STATUS_TRANSITIONS)) {
      expect(targets).not.toContain(from);
    }
  });

  it('un citoyen ne peut rien changer', () => {
    expect(allowedTransitions(citizen, inN1)).toEqual([]);
  });
});

describe('autres droits', () => {
  it('assignation et fusion réservées aux agents et administrateurs', () => {
    expect(canAssign(agent, inN1)).toBe(true);
    expect(canAssign(delegate, inN1)).toBe(false);
    expect(canAssign(agent, { ...inN1, status: 'RESOLVED' })).toBe(false);
    expect(canMerge(agent, inN1, unidentified)).toBe(true);
    expect(canMerge(agent, inN1, inN2)).toBe(false);
  });

  it('invitations et blocage réservés à l’administrateur', () => {
    expect(canInvite(admin)).toBe(true);
    expect([agent, delegate, citizen].some(canInvite)).toBe(false);
    expect(canBlockUsers(agent)).toBe(false);
  });
});

describe('inscription libre (EXG-33)', () => {
  it('refuse tout champ de rôle', () => {
    const attempt = {
      name: 'Pirate',
      email: 'p@test.sn',
      password: 'motdepasse-long',
      role: 'ADMIN',
    };
    expect(registerSchema.safeParse(attempt).success).toBe(false);
    const withoutRole = { name: attempt.name, email: attempt.email, password: attempt.password };
    expect(registerSchema.safeParse(withoutRole).success).toBe(true);
  });

  it('exige 10 caractères de mot de passe', () => {
    expect(
      registerSchema.safeParse({ name: 'Awa', email: 'a@test.sn', password: 'court' }).success,
    ).toBe(false);
  });
});

describe('sessions et jetons', () => {
  it('jeton aléatoire, empreinte non réversible', () => {
    const token = generateToken();
    expect(token).toHaveLength(43);
    expect(generateToken()).not.toBe(token);
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toContain(token);
  });

  it('CSRF : même origine acceptée, autre origine ou absence refusées (D-035)', () => {
    const request = (origin?: string) =>
      new Request('http://localhost:3000/api/x', {
        method: 'POST',
        headers: { host: 'localhost:3000', ...(origin ? { origin } : {}) },
      });
    expect(isSameOrigin(request('http://localhost:3000'))).toBe(true);
    expect(isSameOrigin(request('https://site-malveillant.example'))).toBe(false);
    expect(isSameOrigin(request())).toBe(false);
  });

  it('redirection après connexion : chemins internes seulement', () => {
    expect(safeNextPath('/back-office')).toBe('/back-office');
    expect(safeNextPath('//evil.example')).toBe('/mon-espace');
    expect(safeNextPath('https://evil.example')).toBe('/mon-espace');
    expect(safeNextPath(undefined)).toBe('/mon-espace');
  });
});

describe('journal d’audit sans donnée personnelle (EXG-18)', () => {
  it('retire les clés sensibles', () => {
    expect(
      sanitizeMetadata({
        email: 'a@b.sn',
        tokenHash: 'x',
        password: 'y',
        name: 'Awa',
        from: 'NEW',
        to: 'VERIFIED',
      }),
    ).toEqual({ from: 'NEW', to: 'VERIFIED' });
  });
});
