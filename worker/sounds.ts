export async function getSound(
  bucket: R2Bucket,
  name: string,
): Promise<Response> {
  const sound = await bucket.get(name);
  return sound
    ? new Response(sound.body)
    : new Response("Not found", { status: 404 });
}
