import { getPrisma } from '@/lib/db';
import { fingerprint } from '@/lib/security/hash';
import { Prisma } from '@/generated/prisma/client';
import { ServiceError } from '@/services/errors';
import { isTrackingCode } from './tracking-code';

async function findReportId(trackingCode: string): Promise<string> {
  const report = isTrackingCode(trackingCode)
    ? await getPrisma().report.findUnique({
        where: { trackingCode },
        select: { id: true, status: true },
      })
    : null;
  if (!report || report.status === 'REJECTED') {
    throw new ServiceError('NOT_FOUND', 'Signalement introuvable.');
  }
  return report.id;
}

/**
 * « Je vois aussi ce problème » : un seul vote par appareil (D-028). L'identifiant de
 * l'appareil n'est jamais stocké : seule son empreinte salée l'est.
 */
export async function confirmReport(trackingCode: string, deviceId: string) {
  const prisma = getPrisma();
  const reportId = await findReportId(trackingCode);
  const voterKey = fingerprint(deviceId, 'vote');

  try {
    const report = await prisma.$transaction(async (tx) => {
      await tx.reportVote.create({ data: { reportId, voterKey } });
      return tx.report.update({
        where: { id: reportId },
        data: { confirmationCount: { increment: 1 } },
        select: { confirmationCount: true },
      });
    });
    return {
      confirmed: true,
      alreadyConfirmed: false,
      confirmationCount: report.confirmationCount,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const report = await prisma.report.findUniqueOrThrow({
        where: { id: reportId },
        select: { confirmationCount: true },
      });
      return {
        confirmed: false,
        alreadyConfirmed: true,
        confirmationCount: report.confirmationCount,
      };
    }
    throw error;
  }
}

/** Signaler un abus : visible des modérateurs en Phase 3. */
export async function flagReport(trackingCode: string, reason: string) {
  const reportId = await findReportId(trackingCode);
  await getPrisma().abuseFlag.create({ data: { reportId, reason } });
  return { flagged: true };
}
