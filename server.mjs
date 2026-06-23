// Servidor estático mínimo (sem dependências) pra rodar o build do Vite no PM2,
// igual ao `node server.js` do meet-monitor. Serve ./dist na porta PORT (3200).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("./dist", import.meta.url));
const PORT = process.env.PORT || 3200;
const HOST = process.env.HOST || "0.0.0.0";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

function sendText(res, status, msg) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(msg);
}

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    let rel = normalize(urlPath).replace(/^(\.\.[/\\])+/, ""); // anti path-traversal
    if (rel === "/" || rel === "\\") rel = "/index.html";
    let filePath = join(DIST, rel);
    if (!filePath.startsWith(DIST)) return sendText(res, 403, "Forbidden");

    let info = await stat(filePath).catch(() => null);
    if (info?.isDirectory()) {
      filePath = join(filePath, "index.html");
      info = await stat(filePath).catch(() => null);
    }
    // Rota de SPA (sem extensão e inexistente) cai no index.html
    if (!info) {
      if (extname(rel)) return sendText(res, 404, "Not found");
      filePath = join(DIST, "index.html");
    }

    const ext = extname(filePath).toLowerCase();
    const type = TYPES[ext] || "application/octet-stream";
    const cache = filePath.includes(join(DIST, "assets"))
      ? "public, max-age=31536000, immutable"
      : "no-cache";
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": type, "Cache-Control": cache });
    res.end(data);
  } catch {
    sendText(res, 500, "Server error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`dividas no ar em http://${HOST}:${PORT}`);
});
