import { describe, expect, it } from 'vitest';
import { boundingBox, distanceMeters, isInServiceArea, roundCoordinate } from '@/lib/geo/distance';
import { applyCorrection, resolveNeighborhood, type Landmark } from '@/lib/geo/resolve';

// Positions de référence fictives : deux quartiers voisins (A à l'ouest, B à l'est).
const landmarks: Landmark[] = [
  {
    neighborhoodId: 'A',
    neighborhoodName: 'Quartier A',
    lat: 14.75,
    lng: -17.38,
    radiusMeters: 400,
  },
  {
    neighborhoodId: 'B',
    neighborhoodName: 'Quartier B',
    lat: 14.75,
    lng: -17.37,
    radiusMeters: 400,
  },
];

describe('distances', () => {
  it('calcule environ 1 076 m pour 0,01° de longitude à 14,75° N', () => {
    const d = distanceMeters({ lat: 14.75, lng: -17.38 }, { lat: 14.75, lng: -17.37 });
    expect(d).toBeGreaterThan(1060);
    expect(d).toBeLessThan(1090);
  });

  it('la boîte englobante contient le cercle', () => {
    const box = boundingBox({ lat: 14.75, lng: -17.38 }, 500);
    const east = { lat: 14.75, lng: box.maxLng };
    expect(distanceMeters({ lat: 14.75, lng: -17.38 }, east)).toBeCloseTo(500, -1);
  });

  it('arrondit les positions publiques à 3 décimales', () => {
    expect(roundCoordinate(14.748812)).toBe(14.749);
    expect(roundCoordinate(-17.381249)).toBe(-17.381);
  });

  it('reconnaît la zone de service', () => {
    expect(isInServiceArea({ lat: 14.75, lng: -17.38 })).toBe(true);
    expect(isInServiceArea({ lat: 48.85, lng: 2.35 })).toBe(false);
  });
});

describe('rattachement au quartier (EXG-03)', () => {
  it('centre d’un repère : rattachement automatique', () => {
    const r = resolveNeighborhood({ lat: 14.75, lng: -17.38 }, landmarks);
    expect(r.status).toBe('automatic');
    expect(r.best?.neighborhoodId).toBe('A');
  });

  it('frontière entre deux quartiers : ambigu, les deux sont proposés', () => {
    const r = resolveNeighborhood({ lat: 14.75, lng: -17.3751 }, landmarks);
    expect(r.status).toBe('ambiguous');
    expect(r.candidates.map((c) => c.neighborhoodId).sort()).toEqual(['A', 'B']);
  });

  it('hors zone : quartier non identifié, sans erreur', () => {
    const r = resolveNeighborhood({ lat: 14.8, lng: -17.3 }, landmarks);
    expect(r).toEqual({ status: 'unidentified', best: null, candidates: [] });
    expect(applyCorrection(r, 'A')).toEqual({ neighborhoodId: null, attachment: 'UNIDENTIFIED' });
  });

  it('la correction de l’habitant est conservée si le quartier est candidat', () => {
    const r = resolveNeighborhood({ lat: 14.75, lng: -17.3751 }, landmarks);
    const other = r.best?.neighborhoodId === 'A' ? 'B' : 'A';
    expect(applyCorrection(r, other)).toEqual({ neighborhoodId: other, attachment: 'CORRECTED' });
  });

  it('une correction vers un quartier non candidat est ignorée', () => {
    const r = resolveNeighborhood({ lat: 14.75, lng: -17.38 }, landmarks);
    expect(applyCorrection(r, 'Z')).toEqual({ neighborhoodId: 'A', attachment: 'AUTOMATIC' });
  });
});
