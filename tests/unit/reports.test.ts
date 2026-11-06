import sharp from 'sharp';
import { beforeEach, describe, expect, it } from 'vitest';
import { PhotoRejectedError, processPhoto, PHOTO_MAX_BYTES } from '@/lib/photos/process';
import { PHOTO_KEY_PATTERN } from '@/lib/photos/storage';
import { checkRateLimit, RATE_LIMITS, resetRateLimits } from '@/lib/security/rate-limit';
import { toPublicDetail, toPublicSummary } from '@/services/reports/public';
import { generateTrackingCode, isTrackingCode } from '@/services/reports/tracking-code';
import { createReportSchema, listReportsSchema } from '@/validators/report';

describe('numéro de suivi (D-030)', () => {
  it('suit le format BA-XXXX-XXXX sans caractères ambigus', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateTrackingCode();
      expect(isTrackingCode(code)).toBe(true);
      expect(code.slice(3)).not.toMatch(/[01ILO]/);
    }
  });

  it('accepte les codes de démonstration et refuse le reste', () => {
    expect(isTrackingCode('BA-DEMO-0001')).toBe(true);
    expect(isTrackingCode('../../etc/passwd')).toBe(false);
    expect(isTrackingCode('BA-0000-0000')).toBe(false);
  });
});

describe('sérialisation publique (EXG-06, EXG-39)', () => {
  const source = {
    id: 'interne',
    trackingCode: 'BA-ABCD-EFGH',
    type: 'FLOODING' as const,
    severity: 'HIGH' as const,
    status: 'NEW' as const,
    lat: 14.748812,
    lng: -17.381249,
    neighborhood: { id: 'n1', name: 'Quartier' },
    confirmationCount: 2,
    createdAt: new Date('2026-11-04T10:00:00Z'),
    isDemo: false,
    authorId: 'auteur',
    clientId: 'appareil',
    description: 'Eau stagnante',
    isApproximate: false,
    resolvedAt: null,
    photos: [{ storageKey: 'abc.jpg', width: 10, height: 10 }],
    statusHistory: [
      { toStatus: 'NEW' as const, createdAt: new Date(), changedById: 'agent', note: 'interne' },
    ],
    comments: [{ body: 'note interne', isInternal: true }],
  };

  it('arrondit la position à 3 décimales', () => {
    const summary = toPublicSummary(source);
    expect(summary.lat).toBe(14.749);
    expect(summary.lng).toBe(-17.381);
  });

  it("n'expose ni identifiants internes, ni auteur, ni notes", () => {
    const json = JSON.stringify(toPublicDetail(source));
    for (const secret of [
      'interne',
      'auteur',
      'appareil',
      'agent',
      'note interne',
      'changedById',
    ]) {
      expect(json).not.toContain(secret);
    }
    expect(json).not.toContain('14.748812');
  });
});

describe('validation des signalements', () => {
  const base = { type: 'FLOODING', severity: 'HIGH', lat: '14.75', lng: '-17.38' };

  it('accepte un signalement minimal', () => {
    expect(createReportSchema.safeParse(base).success).toBe(true);
  });

  it('refuse une position hors de la zone couverte', () => {
    expect(createReportSchema.safeParse({ ...base, lat: '48.85', lng: '2.35' }).success).toBe(
      false,
    );
  });

  it('refuse le champ piège rempli et un type inconnu', () => {
    expect(createReportSchema.safeParse({ ...base, website: 'http://spam' }).success).toBe(false);
    expect(createReportSchema.safeParse({ ...base, type: 'UFO' }).success).toBe(false);
  });

  it('lit les filtres de la carte', () => {
    const parsed = listReportsSchema.parse({
      bbox: '-17.4,14.7,-17.3,14.8',
      type: 'FLOODING,ROAD_CUT',
    });
    expect(parsed.bbox).toEqual({ minLng: -17.4, minLat: 14.7, maxLng: -17.3, maxLat: 14.8 });
    expect(parsed.type).toEqual(['FLOODING', 'ROAD_CUT']);
    expect(listReportsSchema.safeParse({ status: 'HACKED' }).success).toBe(false);
  });
});

describe('limitation de débit (D-028)', () => {
  beforeEach(() => resetRateLimits());

  it('bloque au-delà de la limite puis libère après la fenêtre', () => {
    const { limit, windowMs } = RATE_LIMITS.createReport;
    for (let i = 0; i < limit; i += 1)
      expect(checkRateLimit('createReport', 'ip', 1000).allowed).toBe(true);
    expect(checkRateLimit('createReport', 'ip', 1000).allowed).toBe(false);
    expect(checkRateLimit('createReport', 'autre-ip', 1000).allowed).toBe(true);
    expect(checkRateLimit('createReport', 'ip', 1000 + windowMs).allowed).toBe(true);
  });
});

describe('photos (EXG-13)', () => {
  async function jpegWithGps() {
    return sharp({ create: { width: 2400, height: 1200, channels: 3, background: '#0B6FA4' } })
      .jpeg()
      .withExif({
        IFD0: { Make: 'TelephoneTest', Model: 'Modele-Secret' },
        IFD3: {
          GPSLatitudeRef: 'N',
          GPSLatitude: '14/1 44/1 55/1',
          GPSLongitudeRef: 'W',
          GPSLongitude: '17/1 22/1 51/1',
        },
      })
      .toBuffer();
  }

  it('l’image de test contient bien des EXIF GPS', async () => {
    const input = await jpegWithGps();
    expect((await sharp(input).metadata()).exif).toBeDefined();
    expect(input.toString('latin1')).toContain('Modele-Secret');
  });

  it('supprime toutes les métadonnées et redimensionne', async () => {
    const output = await processPhoto(await jpegWithGps());
    const metadata = await sharp(output.data).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.format).toBe('jpeg');
    expect(output.data.toString('latin1')).not.toContain('Modele-Secret');
    expect(Math.max(output.width, output.height)).toBeLessThanOrEqual(1600);
  });

  it('refuse un faux fichier image et un fichier trop gros', async () => {
    await expect(processPhoto(Buffer.from('<?php echo 1; ?>'))).rejects.toBeInstanceOf(
      PhotoRejectedError,
    );
    await expect(processPhoto(Buffer.alloc(PHOTO_MAX_BYTES + 1))).rejects.toBeInstanceOf(
      PhotoRejectedError,
    );
  });

  it('accepte une clé de stockage valide et refuse un chemin', () => {
    expect(PHOTO_KEY_PATTERN.test('0123456789abcdef0123456789abcdef.jpg')).toBe(true);
    expect(PHOTO_KEY_PATTERN.test('../.env')).toBe(false);
  });
});
