export async function isRegistered(
  db: D1Database,
  roomId: string,
): Promise<boolean> {
  const room = await db
    .prepare("SELECT 1 FROM rooms WHERE id = ?")
    .bind(roomId)
    .first();
  return room !== null;
}
