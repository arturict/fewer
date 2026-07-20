import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, isAbsolute, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requestedPort = Number.parseInt(process.env.PORT || "4173", 10);
const port = Number.isFinite(requestedPort) && requestedPort > 0 ? requestedPort : 4173;

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
]);

export const SECURITY_HEADERS = Object.freeze({
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
});

const PUBLIC_FILES = new Set([
  "icon.svg",
  "index.html",
  "manifest.webmanifest",
  "src/app.js",
  "src/domain.js",
  "src/storage.js",
  "styles.css",
]);

export function resolveRequestPath(rawUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(rawUrl || "/", "http://localhost").pathname);
  } catch {
    return null;
  }
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  if (isAbsolute(relative) || relative.includes("\0")) return null;
  const publicName = relative.replaceAll("\\", "/");
  if (!PUBLIC_FILES.has(publicName)) return null;
  const candidate = resolve(root, normalize(relative));
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) return null;
  return candidate;
}

export function createFewerServer() {
  return createServer((request, response) => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      response.setHeader(name, value);
    }

    if (!["GET", "HEAD"].includes(request.method || "")) {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end("Method not allowed");
      return;
    }

    const filePath = resolveRequestPath(request.url);
    if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": MIME_TYPES.get(extname(filePath)) || "application/octet-stream",
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(filePath).pipe(response);
  });
}

function main() {
  const server = createFewerServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`Fewer is running at http://127.0.0.1:${port}`);
  });

  function stop() {
    server.close(() => process.exit(0));
  }
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) main();
