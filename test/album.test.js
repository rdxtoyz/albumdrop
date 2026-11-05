import { test } from "node:test";
import assert from "node:assert/strict";
import { loadAlbum } from "../src/album.js";
import { getAlbumPage, getMedia } from "../shared/google.js";

test("loads more than 2000 entries in order, following every continuation", async () => {
  let page = 0;
  const album = await loadAlbum(
    "https://photos.app.goo.gl/album",
    () => {},
    async (_url, options) => {
      const body = JSON.parse(options.body);
      if (page) assert.equal(body.cursor.token, `cursor${page}`);
      const start = page++ * 300;
      return Response.json({
        title: "Album",
        items: Array.from({ length: Math.min(300, 2101 - start) }, (_, i) => ({
          id: `id${start + i}`,
        })),
        next: page < 8 ? { token: `cursor${page}` } : null,
      });
    },
  );
  assert.equal(album.items.length, 2101);
  assert.equal(album.items[2100].id, "id2100");
  assert.equal(page, 8);
});
test("fails instead of returning a partial album for repeated pages, duplicates and request failures", async () => {
  let n = 0;
  await assert.rejects(
    loadAlbum(
      "url",
      () => {},
      async () =>
        Response.json({ items: [{ id: `id${n++}` }], next: { token: "same" } }),
    ),
    /repeated/,
  );
  await assert.rejects(
    loadAlbum(
      "url",
      () => {},
      async () =>
        Response.json({ items: [{ id: "same" }, { id: "same" }], next: null }),
    ),
    /duplicate/,
  );
  await assert.rejects(
    loadAlbum(
      "url",
      () => {},
      async () =>
        Response.json({ error: "Failed to load next page" }, { status: 502 }),
    ),
    /Failed/,
  );
});
test("parses continuation RPC and rejects invalid or untrusted redirects", async () => {
  const oldFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(new URL(url).hostname, "photos.google.com");
      const args = JSON.parse(new URLSearchParams(options.body).get("f.req"));
      assert.deepEqual(JSON.parse(args[0][0][1]), [
        "album",
        "token",
        null,
        "key",
      ]);
      const data = [
        null,
        [
          [
            "id",
            ["https://lh3.googleusercontent.com/pw/abc", 100, 200],
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            { 76647426: [1] },
          ],
        ],
        null,
      ];
      return new Response(
        ")]}'\n\n" +
          JSON.stringify([["wrb.fr", "snAcKc", JSON.stringify(data)]]),
      );
    };
    const result = await getAlbumPage({
      id: "album",
      key: "key",
      token: "token",
    });
    assert.equal(result.items[0].kind, "video");
    assert.equal(result.next, null);
    await assert.rejects(
      getAlbumPage({ id: "https://evil.test", key: "key", token: "token" }),
      /Invalid/,
    );
    globalThis.fetch = async () =>
      new Response(null, {
        status: 302,
        headers: { location: "https://evil.test/videoplayback" },
      });
    await assert.rejects(
      getMedia("https://lh3.googleusercontent.com/pw/abc", "HEAD", "video"),
      /redirect/,
    );
  } finally {
    globalThis.fetch = oldFetch;
  }
});
