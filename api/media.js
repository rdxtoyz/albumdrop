import { media } from "../shared/handlers.js";
import { Readable } from "node:stream";
export default async function handler(req, res) {
  const response = await media(
    new Request(
      `https://local/api/media?url=${encodeURIComponent(req.query.url || "")}&kind=${encodeURIComponent(req.query.kind || "photo")}`,
      { method: req.method },
    ),
  );
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  if (response.body) Readable.fromWeb(response.body).pipe(res);
  else res.end();
}
