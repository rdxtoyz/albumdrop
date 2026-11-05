import { defineConfig } from "vite";
import { album, media } from "./shared/handlers.js";
export default defineConfig({
  build: {
    rollupOptions: { input: { main: "index.html", notFound: "404.html" } },
  },
  plugins: [
    {
      name: "local-api",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url.startsWith("/api/")) return next();
          let body = "";
          for await (const chunk of req) body += chunk;
          const request = new Request(`http://localhost${req.url}`, {
            method: req.method,
            ...(body ? { body } : {}),
          });
          const response = req.url.startsWith("/api/album")
            ? await album(request)
            : await media(request);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          if (response.body) {
            const { Readable } = await import("node:stream");
            Readable.fromWeb(response.body).pipe(res);
          } else res.end();
        });
      },
    },
  ],
});
