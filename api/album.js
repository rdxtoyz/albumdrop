import { album } from "../shared/handlers.js";
export default async function handler(req, res) {
  const response = await album(
    new Request("https://local/api/album", {
      method: req.method,
      headers: { "content-type": "application/json" },
      ...(req.method === "POST" ? { body: JSON.stringify(req.body) } : {}),
    }),
  );
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.send(await response.text());
}
