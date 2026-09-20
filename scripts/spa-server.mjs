import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, relative, resolve, sep } from "node:path";

const PORT = Number(process.env.PORT) || 3000;
const ROOT = resolve(process.cwd(), "build/client");
const INDEX = join(ROOT, "index.html");

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const SHARED_HEADERS = {
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

const resolveSafePath = (urlPath) => {
  const decoded = decodeURIComponent(urlPath);
  const resolved = resolve(ROOT, `.${decoded}`);
  const rel = relative(ROOT, resolved);
  if (rel.startsWith("..") || rel.includes(`..${sep}`)) return null;
  return resolved;
};

const sendFile = (res, filePath, status = 200) => {
  const type = MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream";
  res.writeHead(status, {
    "Content-Type": type,
    ...SHARED_HEADERS,
  });
  createReadStream(filePath).pipe(res);
};

const sendNotFound = (res) => {
  res.writeHead(404, {
    "Content-Type": "text/plain; charset=utf-8",
    ...SHARED_HEADERS,
  });
  res.end("Not found");
};

if (!existsSync(INDEX)) {
  console.error(`SPA client build not found at ${INDEX}`);
  process.exit(1);
}

const server = createServer((req, res) => {
  const urlPath = new URL(req.url ?? "/", "http://localhost").pathname;
  const requested = resolveSafePath(urlPath === "/" ? "/index.html" : urlPath);

  if (!requested) {
    sendNotFound(res);
    return;
  }

  if (existsSync(requested) && statSync(requested).isFile()) {
    sendFile(res, requested);
    return;
  }

  if (extname(urlPath)) {
    sendNotFound(res);
    return;
  }

  sendFile(res, INDEX);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`SPA server listening on http://0.0.0.0:${PORT}`);
});
