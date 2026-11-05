import { test } from "node:test";
import assert from "node:assert/strict";
import { album, media } from "../shared/handlers.js";
const request = (url) =>
  new Request("https://site/api/album", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
test("invalid links, missing albums and denied access are handled", async () => {
  assert.equal((await album(request("https://example.com"))).status, 400);
  assert.equal(
    (await album(new Request("https://site/api/album"))).status,
    405,
  );
  assert.equal(
    (await media(new Request("https://site/api/media", { method: "POST" })))
      .status,
    405,
  );
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("", { status: 404 });
    assert.equal(
      (await album(request("https://photos.app.goo.gl/missing"))).status,
      404,
    );
    globalThis.fetch = async () => new Response("", { status: 403 });
    assert.equal(
      (await album(request("https://photos.app.goo.gl/private"))).status,
      403,
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("HEAD returns media metadata without a response body", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => {
      assert.equal(options.method, "HEAD");
      return new Response(null, {
        headers: { "content-type": "image/jpeg", "content-length": "1000" },
      });
    };
    const response = await media(
      new Request(
        "https://site/api/media?url=" +
          encodeURIComponent("https://lh3.googleusercontent.com/pw/abc"),
        { method: "HEAD" },
      ),
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-length"), "1000");
    assert.equal(response.body, null);
  } finally {
    globalThis.fetch = original;
  }
});

test("Vercel media adapter preserves video selection", async () => {
  const { default: handler } = await import("../api/media.js");
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.match(String(url), /=m22$/);
      assert.equal(options.method, "HEAD");
      return new Response(null, {
        headers: { "content-type": "video/mp4", "content-length": "123" },
      });
    };
    let status;
    const headers = {};
    let ended = false;
    await handler(
      {
        method: "HEAD",
        query: {
          url: "https://lh3.googleusercontent.com/pw/abc",
          kind: "video",
        },
      },
      {
        status(value) {
          status = value;
        },
        setHeader(name, value) {
          headers[name] = value;
        },
        end() {
          ended = true;
        },
      },
    );
    assert.equal(status, 200);
    assert.equal(headers["content-type"], "video/mp4");
    assert.ok(ended);
  } finally {
    globalThis.fetch = original;
  }
});
