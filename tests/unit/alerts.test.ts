import { describe, expect, it } from 'vitest';
import { deliveryLocale, subscriptionMatches } from '@/lib/alerts/matching';
import { fromDakarInput, toDakarInput } from '@/lib/utils/dakar-time';
import { canIssueAlert, canManageRules, canViewAlert } from '@/permissions/policies';
import { alertScopeWhere } from '@/permissions/scope';
import type { AuthUser } from '@/permissions/types';
import { alertIssues, createAlertSchema } from '@/validators/alerts';
import { createSubscriptionSchema } from '@/validators/subscriptions';

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

const n1 = { id: 'n1', communeId: 'c1' };
const n2 = { id: 'n2', communeId: 'c1' };
const other = { id: 'n9', communeId: 'c9' };

describe('habilitations des alertes (D-049, EXG-30)', () => {
  it('officielle : agent de la commune et administrateur seulement', () => {
    expect(canIssueAlert(agent, 'OFFICIAL', [n1, n2])).toBe(true);
    expect(canIssueAlert(admin, 'OFFICIAL', [other])).toBe(true);
    expect(canIssueAlert(delegate, 'OFFICIAL', [n1])).toBe(false);
    expect(canIssueAlert(citizen, 'OFFICIAL', [n1])).toBe(false);
    expect(canIssueAlert(agent, 'OFFICIAL', [n1, other])).toBe(false);
  });

  it('indicative : délégué de ses quartiers, agent, administrateur', () => {
    expect(canIssueAlert(delegate, 'INDICATIVE', [n1])).toBe(true);
    expect(canIssueAlert(delegate, 'INDICATIVE', [n1, n2])).toBe(false);
    expect(canIssueAlert(agent, 'INDICATIVE', [n2])).toBe(true);
    expect(canIssueAlert(citizen, 'INDICATIVE', [n1])).toBe(false);
  });

  it('aucune alerte sans quartier visé', () => {
    expect(canIssueAlert(admin, 'INDICATIVE', [])).toBe(false);
  });

  it('lecture au back-office : au moins un quartier dans la portée', () => {
    expect(canViewAlert(delegate, [n1, n2])).toBe(true);
    expect(canViewAlert(delegate, [n2])).toBe(false);
    expect(canViewAlert(citizen, [n1])).toBe(false);
    expect(alertScopeWhere(citizen)).toEqual({ id: { in: [] } });
    expect(alertScopeWhere(admin)).toEqual({});
  });

  it('grille de règles : administrateur seulement', () => {
    expect(canManageRules(admin)).toBe(true);
    expect(canManageRules(agent)).toBe(false);
  });
});

describe('contenu des alertes (CDC §4.6)', () => {
  const now = new Date('2026-11-05T10:00:00Z');
  const valid = {
    type: 'INDICATIVE' as const,
    level: 'HIGH' as const,
    issuerName: 'Délégué de quartier',
    title: 'Fortes pluies attendues',
    messageFr: 'Évitez les zones basses cette nuit.',
    neighborhoodIds: ['n1'],
    // Fin de validité relative à l'horloge réelle : le schéma refuse une date déjà passée.
    validUntil: new Date(Date.now() + 24 * 3_600_000).toISOString(),
  };

  it('une alerte indicative ne reprend pas le vocabulaire officiel', () => {
    expect(alertIssues({ type: 'INDICATIVE', issuerName: 'Mairie de Thiaroye' }, now)).toHaveLength(
      1,
    );
    expect(alertIssues({ type: 'INDICATIVE', title: 'Alerte officielle' }, now)).toHaveLength(1);
    expect(alertIssues({ type: 'OFFICIAL', issuerName: 'Mairie de Thiaroye' }, now)).toEqual([]);
  });

  it('validité : après le début, 7 jours au plus', () => {
    expect(
      alertIssues({ validFrom: now, validUntil: new Date('2026-11-05T09:00:00Z') }, now),
    ).toHaveLength(1);
    expect(
      alertIssues({ validFrom: now, validUntil: new Date('2026-11-13T10:00:00Z') }, now),
    ).toHaveLength(1);
  });

  it('wolof marqué relu sans message : refusé', () => {
    expect(alertIssues({ woReviewed: true }, now)).toHaveLength(1);
  });

  it('schéma de création : champs stricts', () => {
    expect(createAlertSchema.safeParse(valid).success).toBe(true);
    expect(createAlertSchema.safeParse({ ...valid, status: 'SENT' }).success).toBe(false);
    expect(createAlertSchema.safeParse({ ...valid, neighborhoodIds: [] }).success).toBe(false);
  });
});

describe('correspondance alerte ↔ abonnement (D-050, EXG-11)', () => {
  const alert = {
    level: 'HIGH' as const,
    neighborhoodIds: ['n1'],
    landmarks: [{ lat: 14.7488, lng: -17.3812, radiusMeters: 400 }],
  };

  it('par quartier, au niveau de seuil', () => {
    expect(
      subscriptionMatches({ minLevel: 'MODERATE', neighborhoodIds: ['n1'], point: null }, alert),
    ).toBe(true);
    expect(
      subscriptionMatches({ minLevel: 'CRITICAL', neighborhoodIds: ['n1'], point: null }, alert),
    ).toBe(false);
    expect(
      subscriptionMatches({ minLevel: 'LOW', neighborhoodIds: ['n2'], point: null }, alert),
    ).toBe(false);
  });

  it('par position et rayon', () => {
    // Environ 1,1 km au nord du repère.
    const point = { lat: 14.7588, lng: -17.3812 };
    expect(
      subscriptionMatches(
        { minLevel: 'LOW', neighborhoodIds: [], point: { ...point, radiusMeters: 1000 } },
        alert,
      ),
    ).toBe(true);
    expect(
      subscriptionMatches(
        { minLevel: 'LOW', neighborhoodIds: [], point: { ...point, radiusMeters: 500 } },
        alert,
      ),
    ).toBe(false);
  });

  it('wolof seulement s’il existe et a été relu', () => {
    expect(deliveryLocale('wo', { messageWo: 'Texte', woReviewed: true })).toBe('wo');
    expect(deliveryLocale('wo', { messageWo: 'Texte', woReviewed: false })).toBe('fr');
    expect(deliveryLocale('fr', { messageWo: 'Texte', woReviewed: true })).toBe('fr');
  });

  it('schéma d’abonnement : un canal au moins, rayon autorisé, zone couverte', () => {
    const common = {
      minLevel: 'MODERATE',
      locale: 'fr',
      channelInApp: true,
      channelWebPush: false,
    };
    expect(
      createSubscriptionSchema.safeParse({
        mode: 'neighborhoods',
        neighborhoodIds: ['n1'],
        ...common,
      }).success,
    ).toBe(true);
    expect(
      createSubscriptionSchema.safeParse({
        mode: 'neighborhoods',
        neighborhoodIds: ['n1'],
        ...common,
        channelInApp: false,
      }).success,
    ).toBe(false);
    expect(
      createSubscriptionSchema.safeParse({
        mode: 'position',
        lat: 14.75,
        lng: -17.38,
        radiusMeters: 750,
        ...common,
      }).success,
    ).toBe(false);
    expect(
      createSubscriptionSchema.safeParse({
        mode: 'position',
        lat: 48.85,
        lng: 2.35,
        radiusMeters: 1000,
        ...common,
      }).success,
    ).toBe(false);
  });
});

describe('heure de Dakar (UTC toute l’année)', () => {
  it('aller-retour sans dépendre du fuseau du navigateur', () => {
    expect(toDakarInput('2026-11-05T18:30:00.000Z')).toBe('2026-11-05T18:30');
    expect(fromDakarInput('2026-11-05T18:30')).toBe('2026-11-05T18:30:00.000Z');
  });
});
