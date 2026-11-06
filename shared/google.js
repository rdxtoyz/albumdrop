const ALBUM_HOSTS = new Set(["photos.app.goo.gl", "photos.google.com"]);

export function albumUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid Google Photos album link.");
  }
  if (
    url.protocol !== "https:" ||
    !ALBUM_HOSTS.has(url.hostname) ||
    url.username ||
    url.password ||
    url.port ||
    (url.hostname === "photos.google.com" &&
      !url.pathname.startsWith("/share/"))
  )
    throw new Error("Use a public Google Photos shared album link.");
  return url;
}

export function mediaUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid media URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "lh3.googleusercontent.com" ||
    !url.pathname.startsWith("/pw/") ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash
  )
    throw new Error("Invalid media URL.");
  return url;
}

async function safeFetch(url, allowed, options = {}) {
  for (let i = 0; i < 4; i++) {
    allowed(url.href);
    const response = await fetch(url, {
      ...options,
      redirect: "manual",
      signal: AbortSignal.timeout(120000),
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location) throw new Error("Invalid redirect.");
    url = new URL(location, url);
  }
  throw new Error("Too many redirects.");
}

export async function getAlbum(value) {
  const response = await safeFetch(albumUrl(value), albumUrl, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!response.ok) {
    const error = new Error(
      "This album is unavailable. It may be private, deleted, or the link may have expired.",
    );
    error.status =
      response.status === 404
        ? 404
        : [401, 403].includes(response.status)
          ? 403
          : 502;
    throw error;
  }
  const html = await response.text();
  const match = html.match(
    /AF_initDataCallback\(\{key:\s*'ds:1',\s*hash:\s*'[^']+',\s*data:([\s\S]*?),\s*sideChannel:\s*\{\}\}\);/,
  );
  if (!match)
    throw new Error(
      "Could not read this album. Make sure link sharing is enabled.",
    );
  let data;
  try {
    data = JSON.parse(match[1]);
  } catch {
    throw new Error("Google Photos returned an unsupported album format.");
  }
  const items = parseItems(data[1]);
  if (!items.length)
    throw new Error(
      "No downloadable photos or videos were found. Check that the album is public and contains media.",
    );
  const title =
    html.match(/<meta property="og:title" content="([^"]*)"/i)?.[1] ||
    "Shared album";
  return {
    title: title
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"),
    items,
    next: continuation(data),
  };
}

// Google Photos' web client exposes this undocumented continuation RPC.
// Reject malformed pages so an incomplete album is never presented as complete.
function parseItems(entries) {
  if (!Array.isArray(entries))
    throw new Error("Google returned an invalid album page.");
  return entries.map((item) => {
    if (
      !Array.isArray(item) ||
      typeof item[0] !== "string" ||
      !Array.isArray(item[1])
    )
      throw new Error("Google returned an unsupported album item.");
    const url = item[1][0];
    mediaUrl(url);
    return {
      id: item[0],
      url,
      width: item[1][1],
      height: item[1][2],
      // Some entries include an extra numeric field before the media metadata.
      kind: item[9]?.["76647426"] || item[10]?.["76647426"] ? "video" : "photo",
    };
  });
}
function continuation(data) {
  if (!data[2]) return null;
  const id = data[3]?.[0],
    key = data[3]?.[19],
    token = data[2];
  if (
    ![id, key, token].every(
      (v) => typeof v === "string" && /^[A-Za-z0-9_-]{1,2048}$/.test(v),
    )
  )
    throw new Error(
      "Google returned an invalid continuation. Please try again.",
    );
  return { id, key, token };
}
export async function getAlbumPage(cursor) {
  if (
    !cursor ||
    ![cursor.id, cursor.key, cursor.token].every(
      (v) => typeof v === "string" && /^[A-Za-z0-9_-]{1,2048}$/.test(v),
    )
  )
    throw new Error("Invalid album continuation.");
  const { id, key, token } = cursor;
  const endpoint = new URL(
    "https://photos.google.com/_/PhotosUi/data/batchexecute",
  );
  endpoint.search = new URLSearchParams({
    rpcids: "snAcKc",
    "source-path": `/share/${id}`,
    rt: "c",
  });
  const body = new URLSearchParams({
    "f.req": JSON.stringify([
      [["snAcKc", JSON.stringify([id, token, null, key]), null, "generic"]],
    ]),
  });
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "x-same-domain": "1",
    },
    body,
    redirect: "manual",
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(
      "Google could not load the next album page. Please try again.",
    );
  const text = await response.text();
  for (const line of text.split("\n")) {
    try {
      const frame = JSON.parse(line);
      const entry =
        Array.isArray(frame) &&
        frame.find(
          (row) =>
            Array.isArray(row) && row[0] === "wrb.fr" && row[1] === "snAcKc",
        );
      if (entry && typeof entry[2] === "string") {
        const data = JSON.parse(entry[2]);
        return { items: parseItems(data[1]), next: continuation(data) };
      }
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  }
  throw new Error(
    "Google returned an unreadable album page. Please try again.",
  );
}

function videoRedirect(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !/^rr[0-9]+---sn-[a-z0-9-]+\.googlevideo\.com$/.test(url.hostname) ||
    url.pathname !== "/videoplayback"
  )
    throw new Error("Invalid video redirect.");
}
export async function getMedia(value, method = "GET", kind = "photo") {
  if (!["photo", "video"].includes(kind))
    throw new Error("Invalid media type.");
  for (const option of kind === "video" ? ["m22", "m18"] : ["d"]) {
    const url = mediaUrl(value);
    url.pathname += `=${option}`;
    const result = await safeFetch(
      url,
      (u) => {
        const target = new URL(u);
        if (target.hostname === "lh3.googleusercontent.com")
          mediaUrl(u.replace(/=(?:d|m18|m22)$/, ""));
        else if (kind === "video") videoRedirect(u);
        else throw new Error("Invalid media redirect.");
      },
      { method },
    );
    if (result.ok || result.status !== 404 || option !== "m22") return result;
  }
}
