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

test("identifies photos and videos when media metadata shifts position", async () => {
  const oldFetch = globalThis.fetch;
  try {
    const entry = (id, metadata, shifted = false) => [
      id,
      [`https://lh3.googleusercontent.com/pw/${id}`, 100, 200],
      ...Array(7).fill(null),
      ...(shifted ? [0] : []),
      metadata,
    ];
    const data = [
      null,
      [
        entry("photo", { 15: [1] }),
        entry("video", { 76647426: [1] }),
        entry("shifted-video", { 76647426: [1] }, true),
        entry("shifted-photo", { 15: [1] }, true),
      ],
    ];
    globalThis.fetch = async () =>
      new Response(
        `AF_initDataCallback({key: 'ds:1', hash: '2', data:${JSON.stringify(data)}, sideChannel: {}});`,
      );
    const result = await getAlbum("https://photos.app.goo.gl/abc");
    assert.deepEqual(
      result.items.map(({ kind }) => kind),
      ["photo", "video", "video", "photo"],
    );
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("falls back to a lower video quality when the first is unavailable", async () => {
  const oldFetch = globalThis.fetch;
  const requested = [];
  try {
    globalThis.fetch = async (url, options) => {
      requested.push([new URL(url).pathname, options.method]);
      return new Response(null, { status: requested.length === 1 ? 404 : 200 });
    };
    const result = await getMedia(
      "https://lh3.googleusercontent.com/pw/video",
      "HEAD",
      "video",
    );
    assert.equal(result.status, 200);
    assert.deepEqual(requested, [
      ["/pw/video=m22", "HEAD"],
      ["/pw/video=m18", "HEAD"],
    ]);
  } finally {
    globalThis.fetch = oldFetch;
  }
});
