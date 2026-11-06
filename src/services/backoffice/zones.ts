import { getPrisma } from '@/lib/db';
import { Prisma } from '@/generated/prisma/client';
import { canManageZones } from '@/permissions/policies';
import type { AuthUser } from '@/permissions/types';
import { recordAudit } from '@/services/audit';
import { ServiceError } from '@/services/errors';
import type {
  AliasInput,
  CommuneInput,
  LandmarkInput,
  NeighborhoodInput,
} from '@/validators/zones';

// Zones et quartiers (CDC §4.3 et §4.5) : l'équipe saisit les vrais quartiers du pilote,
// leurs repères et alias, sans toucher au code.

function assertZoneAdmin(user: AuthUser) {
  if (!canManageZones(user))
    throw new ServiceError('FORBIDDEN', 'Action réservée à l’administrateur.');
}

/** Listes courtes pour les formulaires (communes, quartiers). */
export async function listZoneOptions() {
  const prisma = getPrisma();
  const [communes, neighborhoods] = await Promise.all([
    prisma.commune.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.neighborhood.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  return { communes, neighborhoods };
}

export async function listZones(user: AuthUser) {
  assertZoneAdmin(user);
  const prisma = getPrisma();
  const [communes, delegates] = await Promise.all([
    prisma.commune.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        department: true,
        isDemo: true,
        neighborhoods: {
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            isPilot: true,
            boundaryStatus: true,
            isDemo: true,
            delegate: { select: { id: true, name: true } },
            landmarks: {
              select: {
                id: true,
                name: true,
                kind: true,
                lat: true,
                lng: true,
                radiusMeters: true,
                source: true,
              },
              orderBy: { name: 'asc' },
            },
            aliases: { select: { id: true, alias: true, locale: true }, orderBy: { alias: 'asc' } },
            _count: { select: { reports: true } },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: 'DELEGATE', status: 'ACTIVE' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  return {
    delegates,
    communes: communes.map((commune) => ({
      ...commune,
      neighborhoods: commune.neighborhoods.map((n) => ({
        ...n,
        landmarks: n.landmarks.map((l) => ({ ...l, lat: Number(l.lat), lng: Number(l.lng) })),
      })),
    })),
  };
}

function uniqueConflict(error: unknown, message: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ServiceError('CONFLICT', message, { name: [message] });
  }
  throw error;
}

export async function createCommune(user: AuthUser, input: CommuneInput) {
  assertZoneAdmin(user);
  try {
    const commune = await getPrisma().commune.create({ data: input, select: { id: true } });
    await recordAudit({
      actorId: user.id,
      action: 'zone.created',
      entityType: 'commune',
      entityId: commune.id,
    });
    return commune;
  } catch (error) {
    uniqueConflict(error, 'Cette commune existe déjà.');
  }
}

export async function createNeighborhood(user: AuthUser, input: NeighborhoodInput) {
  assertZoneAdmin(user);
  try {
    const neighborhood = await getPrisma().neighborhood.create({
      data: {
        name: input.name,
        communeId: input.communeId,
        isPilot: input.isPilot ?? false,
        boundaryStatus: input.boundaryStatus ?? 'APPROXIMATE',
        delegateId: input.delegateId ?? null,
      },
      select: { id: true },
    });
    await recordAudit({
      actorId: user.id,
      action: 'zone.created',
      entityType: 'neighborhood',
      entityId: neighborhood.id,
    });
    return neighborhood;
  } catch (error) {
    uniqueConflict(error, 'Ce quartier existe déjà dans cette commune.');
  }
}

export async function updateNeighborhood(
  user: AuthUser,
  id: string,
  input: Partial<NeighborhoodInput>,
) {
  assertZoneAdmin(user);
  try {
    await getPrisma().neighborhood.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.isPilot !== undefined ? { isPilot: input.isPilot } : {}),
        ...(input.boundaryStatus !== undefined ? { boundaryStatus: input.boundaryStatus } : {}),
        ...(input.delegateId !== undefined ? { delegateId: input.delegateId } : {}),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new ServiceError('NOT_FOUND', 'Quartier introuvable.');
    }
    uniqueConflict(error, 'Ce quartier existe déjà dans cette commune.');
  }
  await recordAudit({
    actorId: user.id,
    action: 'zone.updated',
    entityType: 'neighborhood',
    entityId: id,
    metadata: {
      isPilot: input.isPilot ?? null,
      boundaryStatus: input.boundaryStatus ?? null,
      delegateId: input.delegateId ?? null,
    },
  });
  return { id };
}

export async function addLandmark(user: AuthUser, neighborhoodId: string, input: LandmarkInput) {
  assertZoneAdmin(user);
  const landmark = await getPrisma().neighborhoodLandmark.create({
    data: { neighborhoodId, ...input },
    select: { id: true },
  });
  await recordAudit({
    actorId: user.id,
    action: 'zone.created',
    entityType: 'landmark',
    entityId: landmark.id,
  });
  return landmark;
}

export async function addAlias(user: AuthUser, neighborhoodId: string, input: AliasInput) {
  assertZoneAdmin(user);
  try {
    const alias = await getPrisma().neighborhoodAlias.create({
      data: { neighborhoodId, ...input },
      select: { id: true },
    });
    await recordAudit({
      actorId: user.id,
      action: 'zone.created',
      entityType: 'alias',
      entityId: alias.id,
    });
    return alias;
  } catch (error) {
    uniqueConflict(error, 'Cet alias existe déjà pour ce quartier.');
  }
}

export async function deleteZoneItem(user: AuthUser, kind: 'landmark' | 'alias', id: string) {
  assertZoneAdmin(user);
  const prisma = getPrisma();
  const result =
    kind === 'landmark'
      ? await prisma.neighborhoodLandmark.deleteMany({ where: { id } })
      : await prisma.neighborhoodAlias.deleteMany({ where: { id } });
  if (result.count === 0) throw new ServiceError('NOT_FOUND', 'Élément introuvable.');
  await recordAudit({ actorId: user.id, action: 'zone.deleted', entityType: kind, entityId: id });
  return { deleted: true };
}
