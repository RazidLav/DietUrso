import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = normalize(join(process.cwd(), process.argv[2] ?? "dist"));
const port = Number(process.env.PORT ?? 4173);
const contentTypes = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon", ".jpg": "image/jpeg", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml",
  ".ttf": "font/ttf", ".webp": "image/webp",
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  const requested = normalize(join(root, pathname));
  const safeRequested = requested.startsWith(root) ? requested : root;
  const file = existsSync(safeRequested) && statSync(safeRequested).isFile() ? safeRequested : join(root, "index.html");
  response.writeHead(200, {
    "Content-Type": contentTypes[extname(file)] ?? "application/octet-stream",
    "Cache-Control": file.endsWith("index.html") ? "no-store" : "public, max-age=3600",
  });
  createReadStream(file).pipe(response);
}).listen(port, "127.0.0.1", () => console.log(`UrsoFit preview: http://127.0.0.1:${port}`));
