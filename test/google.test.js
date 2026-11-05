import { test } from "node:test";
import assert from "node:assert/strict";
import { albumUrl, mediaUrl, getAlbum, getMedia } from "../shared/google.js";

test("only accepts Google Photos share links and Google photo media", () => {
  assert.equal(
    albumUrl("https://photos.app.goo.gl/abc").hostname,
    "photos.app.goo.gl",
  );
  assert.throws(() =>
    albumUrl("https://photos.google.com.evil.test/share/abc"),
  );
  assert.throws(() => albumUrl("http://photos.google.com/share/abc"));
  assert.throws(() => albumUrl("https://photos.google.com/settings"));
  assert.throws(() =>
    mediaUrl("https://lh3.googleusercontent.com.evil.test/pw/abc"),
  );
  assert.throws(() => mediaUrl("https://lh3.googleusercontent.com/a/abc"));
});
test("extracts public album entries and rejects redirects outside Google", async () => {
  const oldFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response(
        `<meta property="og:title" content="Trip &amp; friends"><script>AF_initDataCallback({key: 'ds:1', hash: '2', data:[null,[["id",["https://lh3.googleusercontent.com/pw/abc",100,200]]]], sideChannel: {}});</script>`,
      );
    const album = await getAlbum("https://photos.app.goo.gl/abc");
    assert.equal(album.title, "Trip & friends");
    assert.deepEqual(album.items, [
      {
        id: "id",
        kind: "photo",
        url: "https://lh3.googleusercontent.com/pw/abc",
        width: 100,
        height: 200,
      },
    ]);
    globalThis.fetch = async () =>
      new Response(null, {
        status: 302,
        headers: { location: "https://example.com/" },
      });
    await assert.rejects(getAlbum("https://photos.app.goo.gl/abc"));
    await assert.rejects(getMedia("https://lh3.googleusercontent.com/pw/abc"));
  } finally {
    globalThis.fetch = oldFetch;
  }
});
