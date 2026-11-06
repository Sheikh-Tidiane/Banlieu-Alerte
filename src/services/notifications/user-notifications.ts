import type { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db';
import type { AuthUser } from '@/permissions/types';

// Notifications dans l'application (D-055) : avancement des signalements, question
// « résolu ? », escalade, question après un épisode. Aucun canal externe.

type NotificationClient = Pick<ReturnType<typeof getPrisma>, 'userNotification'>;

export type NewNotification = Omit<Prisma.UserNotificationUncheckedCreateInput, 'id' | 'createdAt'>;

export async function notify(
  entries: NewNotification | NewNotification[],
  client: NotificationClient = getPrisma(),
) {
  const data = Array.isArray(entries) ? entries : [entries];
  if (data.length === 0) return 0;
  const result = await client.userNotification.createMany({ data });
  return result.count;
}

export async function listMyUserNotifications(user: AuthUser, take = 30) {
  const rows = await getPrisma().userNotification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      kind: true,
      title: true,
      body: true,
      link: true,
      readAt: true,
      createdAt: true,
    },
  });
  return rows.map((row) => ({
    ...row,
    read: row.readAt !== null,
    createdAt: row.createdAt.toISOString(),
    readAt: undefined,
  }));
}

export async function countUnreadUserNotifications(user: AuthUser) {
  return getPrisma().userNotification.count({ where: { userId: user.id, readAt: null } });
}

export async function markUserNotificationsRead(user: AuthUser) {
  const result = await getPrisma().userNotification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: result.count };
}
