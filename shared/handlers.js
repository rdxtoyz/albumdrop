import { getAlbum, getAlbumPage, getMedia } from "./google.js";
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
export async function album(request) {
  try {
    if (request.method !== "POST")
      return json({ error: "Method not allowed." }, 405);
    const body = await request.json();
    if (body.cursor) return json(await getAlbumPage(body.cursor));
    if (typeof body.url !== "string" || body.url.length > 2048)
      throw new Error("Enter a valid Google Photos album link.");
    return json(await getAlbum(body.url));
  } catch (error) {
    return json(
      { error: error.message || "Could not load album." },
      error.status || 400,
    );
  }
}
export async function media(request) {
  try {
    if (!["GET", "HEAD"].includes(request.method))
      return json({ error: "Method not allowed." }, 405);
    const url = new URL(request.url).searchParams.get("url");
    if (!url || url.length > 2048) throw new Error("Invalid media URL.");
    const result = await getMedia(
      url,
      request.method,
      new URL(request.url).searchParams.get("kind") || "photo",
    );
    if (!result.ok)
      return json({ error: "Could not download this item." }, 502);
    const length = result.headers.get("content-length");
    return new Response(request.method === "HEAD" ? null : result.body, {
      headers: {
        "Content-Type":
          result.headers.get("content-type") || "application/octet-stream",
        "Cache-Control": "no-store",
        ...(length ? { "Content-Length": length } : {}),
      },
    });
  } catch {
    return json({ error: "Could not download this item." }, 400);
  }
}
