import { ZipWriter } from "@zip.js/zip.js";
export const PART_LIMIT = 1_000_000_000;
export const TOTAL_LIMIT = 2_000_000_000;
const overhead = 512;
const types = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
};
export function planParts(
  files,
  partLimit = PART_LIMIT,
  totalLimit = TOTAL_LIMIT,
) {
  let total = 0;
  const parts = [];
  let part = [];
  let bytes = 22;
  for (const file of files) {
    if (!Number.isSafeInteger(file.size) || file.size <= 0)
      throw new Error(
        "Google did not provide a reliable file size. Download this album from Google Photos.",
      );
    total += file.size;
    if (total > totalLimit)
      throw new Error(
        "This album exceeds the 2 GB total limit. Choose a smaller album.",
      );
    const cost = file.size + overhead;
    if (cost + 22 > partLimit)
      throw new Error(
        "An individual file is too large for a 1 GB ZIP. Download that file from Google Photos.",
      );
    if (bytes + cost > partLimit) {
      parts.push(part);
      part = [];
      bytes = 22;
    }
    part.push(file);
    bytes += cost;
  }
  if (part.length) parts.push(part);
  return parts;
}
export async function inspectFiles(items, signal, progress) {
  const files = new Array(items.length);
  const internal = new AbortController();
  const combined = AbortSignal.any([signal, internal.signal]);
  let next = 0;
  let completed = 0;
  async function worker() {
    while (next < items.length) {
      combined.throwIfAborted();
      const i = next++;
      const endpoint = `/api/media?url=${encodeURIComponent(items[i].url)}&kind=${items[i].kind || "photo"}`;
      const response = await fetch(endpoint, {
        method: "HEAD",
        signal: AbortSignal.any([combined, AbortSignal.timeout(30000)]),
      });
      if (!response.ok)
        throw new Error(
          items[i].kind === "video"
            ? "Google could not provide a video to this server. Open the album in Google Photos to download it."
            : "A file is unavailable. Try loading the album again.",
        );
      const type = response.headers.get("content-type")?.split(";")[0];
      const ext = types[type];
      if (!ext || (items[i].kind === "video" && type !== "video/mp4"))
        throw new Error(
          "This album contains an unsupported file type. Download it from Google Photos.",
        );
      files[i] = {
        endpoint,
        size: Number(response.headers.get("content-length")),
        name: `photo-${String(i + 1).padStart(6, "0")}.${ext}`,
      };
      progress(`Checking files… ${++completed} of ${items.length}`);
    }
  }
  try {
    await Promise.all(
      Array.from({ length: Math.min(6, items.length) }, worker),
    );
  } catch (error) {
    internal.abort();
    throw error;
  }
  return files;
}
export async function writeParts(
  parts,
  directory,
  signal,
  progress,
  fetchFile = fetch,
  partLimit = PART_LIMIT,
) {
  let finished = 0;
  const count = parts.flat().length;
  for (let index = 0; index < parts.length; index++) {
    const name = `albumdrop-${String(index + 1).padStart(2, "0")}.zip`;
    let output;
    try {
      const handle = await directory.getFileHandle(name, { create: true });
      output = await handle.createWritable();
      let written = 0;
      const sink = new WritableStream({
        async write(chunk) {
          signal.throwIfAborted();
          written += chunk.byteLength;
          if (written > partLimit)
            throw new Error("ZIP exceeded its size limit.");
          await output.write(chunk);
        },
        close: () => output.close(),
        abort: (reason) => output.abort(reason),
      });
      const zip = new ZipWriter(sink, {
        level: 0,
        bufferedWrite: false,
        useWebWorkers: false,
      });
      for (const file of parts[index]) {
        signal.throwIfAborted();
        const response = await fetchFile(file.endpoint, { signal });
        if (!response.ok || !response.body)
          throw new Error("A download failed. Reload the album and try again.");
        let received = 0;
        const stream = response.body.pipeThrough(
          new TransformStream({
            transform(chunk, controller) {
              received += chunk.byteLength;
              if (received > file.size)
                throw new Error(
                  "A file changed size. Reload the album and try again.",
                );
              progress(
                `ZIP ${index + 1}/${parts.length} · File ${finished + 1}/${count} · ${Math.round((received / file.size) * 100)}%`,
              );
              controller.enqueue(chunk);
            },
          }),
        );
        await zip.add(file.name, stream);
        if (received !== file.size)
          throw new Error("An incomplete file was received. Please try again.");
        finished++;
      }
      await zip.close();
    } catch (error) {
      if (output) await output.abort().catch(() => {});
      throw error;
    }
  }
}
