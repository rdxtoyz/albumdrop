export async function loadAlbum(url, progress, fetchPage = fetch) {
  let cursor = null;
  let title;
  const items = [];
  const ids = new Set();
  const cursors = new Set();
  do {
    progress(`Finding items… ${items.length} found`);
    const response = await fetchPage("/api/album", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cursor ? { cursor } : { url }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "Could not open this album.");
    if (!Array.isArray(data.items) || (!data.items.length && data.next))
      throw new Error("Google returned an incomplete album. Please try again.");
    title ||= data.title;
    for (const item of data.items) {
      if (!item.id || ids.has(item.id))
        throw new Error(
          "Google returned duplicate album items. Please try again.",
        );
      ids.add(item.id);
      items.push(item);
    }
    cursor = data.next;
    if (cursor) {
      if (cursors.has(cursor.token))
        throw new Error(
          "Google returned a repeated album page. Please try again.",
        );
      cursors.add(cursor.token);
    }
  } while (cursor);
  return { title, items };
}
