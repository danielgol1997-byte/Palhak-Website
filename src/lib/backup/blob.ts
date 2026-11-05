/** Optional off-provider mirror in a private Vercel Blob store.
 *  Active only when BLOB_READ_WRITE_TOKEN is configured. Never throws into the
 *  main backup flow: a failed mirror is reported, not fatal. */

export function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function uploadBackupToBlob(
  pathname: string,
  gz: Buffer
): Promise<{ url: string; pathname: string } | null> {
  if (!blobConfigured()) return null;
  const { put } = await import("@vercel/blob");
  const res = await put(pathname, gz, {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/gzip",
    cacheControlMaxAge: 0,
  });
  return { url: res.url, pathname: res.pathname };
}

export async function deleteBackupFromBlob(url: string): Promise<void> {
  if (!blobConfigured()) return;
  const { del } = await import("@vercel/blob");
  await del(url);
}

export async function downloadBackupFromBlob(url: string): Promise<Buffer | null> {
  if (!blobConfigured()) return null;
  const blob = await import("@vercel/blob");
  // @vercel/blob >= 2.x exposes get(); fall back to fetch for public stores.
  const anyBlob = blob as unknown as {
    get?: (u: string, o: { access: "private" }) => Promise<{ stream: ReadableStream } | null>;
  };
  if (typeof anyBlob.get === "function") {
    const r = await anyBlob.get(url, { access: "private" });
    if (!r) return null;
    const ab = await new Response(r.stream).arrayBuffer();
    return Buffer.from(ab);
  }
  const res = await fetch(url);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}
