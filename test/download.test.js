import { test } from "node:test";
import assert from "node:assert/strict";
import { ZipReader, Uint8ArrayReader, Uint8ArrayWriter } from "@zip.js/zip.js";
import { inspectFiles, planParts, writeParts } from "../src/download.js";
import { media } from "../shared/handlers.js";
const file = (size, name = "photo.jpg") => ({
  size,
  name,
  endpoint: "/fixture",
});
function directory() {
  const outputs = [];
  return {
    outputs,
    async getFileHandle(name) {
      const chunks = [];
      const item = { name, chunks, closed: false, aborted: false };
      outputs.push(item);
      return {
        async createWritable() {
          return {
            async write(chunk) {
              chunks.push(chunk.slice());
            },
            async close() {
              item.closed = true;
            },
            async abort() {
              item.aborted = true;
            },
          };
        },
      };
    },
  };
}
test("plans bounded ZIPs and enforces 2 GB total including exact boundaries", () => {
  assert.equal(planParts([file(500_000_000), file(500_000_000)]).length, 2);
  assert.equal(
    planParts(Array.from({ length: 4 }, () => file(500_000_000))).length,
    4,
  );
  assert.throws(() => planParts([file(2_000_000_001)]), /2 GB/);
  assert.throws(() => planParts([file(1_000_000_000)]), /individual/);
  assert.throws(() => planParts([file(0)]), /reliable/);
});
test("streams readable ZIPs and aborts incomplete downloads", async () => {
  const dir = directory();
  const payload = new TextEncoder().encode("a photograph");
  await writeParts(
    [[file(payload.length)]],
    dir,
    new AbortController().signal,
    () => {},
    async () => new Response(payload),
  );
  assert.equal(dir.outputs[0].closed, true);
  const bytes = new Uint8Array(Buffer.concat(dir.outputs[0].chunks));
  const reader = new ZipReader(new Uint8ArrayReader(bytes));
  const entries = await reader.getEntries();
  assert.equal(entries[0].filename, "photo.jpg");
  assert.equal(entries[0].uncompressedSize, payload.length);
  await reader.close();
  const broken = directory();
  await assert.rejects(
    writeParts(
      [[file(100)]],
      broken,
      new AbortController().signal,
      () => {},
      async () => new Response(payload),
    ),
    /incomplete/,
  );
  assert.equal(broken.outputs[0].aborted, true);
});

test("downloads photos and videos together with their original bytes", async () => {
  const original = globalThis.fetch;
  const payloads = {
    photo: new Uint8Array([1, 2, 3]),
    video: new Uint8Array([4, 5, 6, 7]),
  };
  try {
    globalThis.fetch = async (url, options = {}) => {
      if (String(url).startsWith("/api/media?"))
        return media(new Request(`https://site${url}`, options));
      const path = new URL(url).pathname;
      const kind = path.endsWith("=m22") ? "video" : "photo";
      assert.equal(path, `/pw/${kind}=${kind === "video" ? "m22" : "d"}`);
      return new Response(options.method === "HEAD" ? null : payloads[kind], {
        headers: {
          "content-type": kind === "video" ? "video/mp4" : "image/jpeg",
          "content-length": String(payloads[kind].length),
        },
      });
    };
    const items = ["photo", "video"].map((kind) => ({
      kind,
      url: `https://lh3.googleusercontent.com/pw/${kind}`,
    }));
    const signal = new AbortController().signal;
    const files = await inspectFiles(items, signal, () => {});
    assert.deepEqual(
      files.map((file) => file.name),
      ["photo-000001.jpg", "video-000002.mp4"],
    );
    const dir = directory();
    await writeParts(planParts(files), dir, signal, () => {});
    const reader = new ZipReader(
      new Uint8ArrayReader(
        new Uint8Array(Buffer.concat(dir.outputs[0].chunks)),
      ),
    );
    const entries = await reader.getEntries();
    assert.deepEqual(
      entries.map((entry) => entry.filename),
      files.map((f) => f.name),
    );
    assert.deepEqual(
      await entries[0].getData(new Uint8ArrayWriter()),
      payloads.photo,
    );
    assert.deepEqual(
      await entries[1].getData(new Uint8ArrayWriter()),
      payloads.video,
    );
    await reader.close();
  } finally {
    globalThis.fetch = original;
  }
});
test("cancel aborts the active archive", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    writeParts([[file(5)]], directory(), controller.signal, () => {}),
    { name: "AbortError" },
  );
});
test(
  "streams nearly 2 GB into bounded ZIPs without retaining payloads",
  { skip: process.env.LARGE_ZIP_TEST !== "1" },
  async () => {
    const sizes = [];
    let current = 0;
    let peak = 0;
    const dir = {
      async getFileHandle() {
        return {
          async createWritable() {
            return {
              async write(chunk) {
                current += chunk.length;
                peak = Math.max(peak, process.memoryUsage().arrayBuffers);
              },
              async close() {
                sizes.push(current);
                current = 0;
              },
              async abort() {},
            };
          },
        };
      },
    };
    const files = Array.from({ length: 4 }, (_, i) =>
      file(499_999_000, `photo-${i}.jpg`),
    );
    await writeParts(
      planParts(files),
      dir,
      new AbortController().signal,
      () => {},
      async () => {
        let remaining = 499_999_000;
        return new Response(
          new ReadableStream({
            pull(controller) {
              if (!remaining) {
                controller.close();
                return;
              }
              const size = Math.min(remaining, 65536);
              remaining -= size;
              controller.enqueue(new Uint8Array(size));
            },
          }),
        );
      },
    );
    assert.equal(sizes.length, 2);
    assert.ok(sizes.every((size) => size <= 1_000_000_000));
    assert.ok(peak < 256_000_000, `Peak array buffer allocation ${peak}`);
    console.log(
      `Streamed ${files.reduce((s, f) => s + f.size, 0)} payload bytes; ZIP sizes ${sizes}; peak array buffers ${peak}`,
    );
  },
);

test("writes an archive with over 2000 entries in order", async () => {
  const dir = directory();
  const files = Array.from({ length: 2101 }, (_, i) => ({
    size: 3,
    name: `photo-${i}.jpg`,
    endpoint: `/photo/${i}`,
  }));
  await writeParts(
    planParts(files),
    dir,
    new AbortController().signal,
    () => {},
    async () => new Response(new Uint8Array([1, 2, 3])),
  );
  const bytes = new Uint8Array(Buffer.concat(dir.outputs[0].chunks));
  const reader = new ZipReader(new Uint8ArrayReader(bytes));
  const entries = await reader.getEntries();
  assert.equal(entries.length, 2101);
  assert.equal(entries[2100].filename, "photo-2100.jpg");
  await reader.close();
});
