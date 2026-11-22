// Small helpers to create notifications.
// "db" can be prisma itself or a transaction (tx), so a notification is saved
// together with the change it describes.

export function notify(db, userId, message, link = null) {
  if (!userId) return null;
  return db.notification.create({ data: { userId, message, link } });
}

export async function notifyRole(db, role, message, link = null) {
  const users = await db.user.findMany({ where: { role, active: true }, select: { id: true } });
  if (users.length === 0) return;
  await db.notification.createMany({
    data: users.map((u) => ({ userId: u.id, message, link })),
  });
}