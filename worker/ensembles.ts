export async function getEnsemble(
  db: D1Database,
  id: string,
): Promise<Response> {
  const ensemble = await db
    .prepare("SELECT name FROM ensembles WHERE id = ?")
    .bind(id)
    .first();
  return ensemble
    ? Response.json(ensemble)
    : new Response("Not found", { status: 404 });
}

export async function registerPiece(
  db: D1Database,
  ensembleId: string,
  pieceId: string,
): Promise<Response> {
  const { meta } = await db
    .prepare(
      "INSERT INTO rooms (id, ensemble_id) SELECT ?, id FROM ensembles WHERE id = ?",
    )
    .bind(pieceId, ensembleId)
    .run();
  return meta.changes
    ? new Response(null, { status: 204 })
    : new Response("Not found", { status: 404 });
}
