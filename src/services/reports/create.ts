import { getPrisma } from '@/lib/db';
import { boundingBox, distanceMeters } from '@/lib/geo/distance';
import { applyCorrection } from '@/lib/geo/resolve';
import { PhotoRejectedError, processPhoto } from '@/lib/photos/process';
import { photoStorage } from '@/lib/photos/storage';
import { Prisma } from '@/generated/prisma/client';
import { resolvePosition } from '@/services/geo/neighborhoods';
import { ServiceError } from '@/services/errors';
import { MIN_FILL_DURATION_MS, type CreateReportInput } from '@/validators/report';
import { generateTrackingCode } from './tracking-code';

/** Doublon probable : même type, à moins de 50 m, dans les 2 dernières heures (D-028). */
export const DUPLICATE_RADIUS_METERS = 50;
export const DUPLICATE_WINDOW_MS = 2 * 3_600_000;

export type CreatedReport = { trackingCode: string; created: boolean };

export async function findNearbyDuplicates(input: Pick<CreateReportInput, 'type' | 'lat' | 'lng'>) {
  const box = boundingBox(input, DUPLICATE_RADIUS_METERS);
  const rows = await getPrisma().report.findMany({
    where: {
      type: input.type,
      status: { notIn: ['RESOLVED', 'REJECTED'] },
      createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
      lat: { gte: box.minLat, lte: box.maxLat },
      lng: { gte: box.minLng, lte: box.maxLng },
    },
    select: { trackingCode: true, lat: true, lng: true },
    take: 10,
  });
  return rows
    .filter(
      (row) =>
        distanceMeters(input, { lat: Number(row.lat), lng: Number(row.lng) }) <=
        DUPLICATE_RADIUS_METERS,
    )
    .map((row) => row.trackingCode);
}

export async function createReport(
  input: CreateReportInput,
  photo: Buffer | null,
  /** Compte de l'habitant connecté ; absent pour un signalement sans compte (D-005). */
  authorId: string | null = null,
): Promise<CreatedReport> {
  const prisma = getPrisma();

  // Idempotence (D-027) : un envoi rejoué depuis la file hors-ligne renvoie le même signalement.
  if (input.clientId) {
    const existing = await prisma.report.findUnique({
      where: { clientId: input.clientId },
      select: { trackingCode: true },
    });
    if (existing) return { trackingCode: existing.trackingCode, created: false };
  }

  if (input.fillDurationMs !== undefined && input.fillDurationMs < MIN_FILL_DURATION_MS) {
    throw new ServiceError('VALIDATION_ERROR', 'Envoi trop rapide, merci de réessayer.');
  }

  if (!input.confirmNotDuplicate) {
    const duplicates = await findNearbyDuplicates(input);
    if (duplicates.length > 0) {
      throw new ServiceError('CONFLICT', 'Un signalement semblable existe déjà tout près.', {
        duplicates,
      });
    }
  }

  // La photo est traitée avant toute écriture : une photo refusée n'enregistre rien.
  let processed: Awaited<ReturnType<typeof processPhoto>> | null = null;
  if (photo) {
    try {
      processed = await processPhoto(photo);
    } catch (error) {
      if (error instanceof PhotoRejectedError) {
        throw new ServiceError('VALIDATION_ERROR', error.message, { photo: [error.message] });
      }
      throw error;
    }
  }

  const resolution = await resolvePosition(input);
  const { neighborhoodId, attachment } = applyCorrection(resolution, input.neighborhoodId);
  const storageKey = processed ? await photoStorage.save(processed.data) : null;

  // Collision de numéro de suivi très improbable : quelques essais suffisent.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const trackingCode = generateTrackingCode();
    try {
      await prisma.report.create({
        data: {
          trackingCode,
          clientId: input.clientId ?? null,
          authorId,
          type: input.type,
          severity: input.severity,
          description: input.description ?? null,
          lat: input.lat,
          lng: input.lng,
          neighborhoodId,
          attachment,
          source: 'WEB',
          statusHistory: { create: { fromStatus: null, toStatus: 'NEW' } },
          ...(processed && storageKey
            ? {
                photos: {
                  create: {
                    storageKey,
                    mimeType: processed.mimeType,
                    sizeBytes: processed.data.length,
                    width: processed.width,
                    height: processed.height,
                  },
                },
              }
            : {}),
        },
      });
      return { trackingCode, created: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = JSON.stringify(error.meta ?? {});
        // Envoi concurrent avec le même clientId : on renvoie le signalement déjà créé.
        if (input.clientId && target.includes('clientId')) {
          const existing = await prisma.report.findUniqueOrThrow({
            where: { clientId: input.clientId },
            select: { trackingCode: true },
          });
          return { trackingCode: existing.trackingCode, created: false };
        }
        continue;
      }
      throw error;
    }
  }
  throw new ServiceError('INTERNAL_ERROR', 'Impossible d’attribuer un numéro de suivi.');
}
