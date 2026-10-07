/**
 * Minimal static file server for rendered QA: the page is loaded over http://127.0.0.1 (not file://)
 * so relative links, assets and Lighthouse behave as they would on a host. Read-only, bound to the
 * loopback interface, refuses any path outside the site root.
 *
 * Text files are gzip-compressed when the browser asks for it, as every production host does (Step 4B
 * M4: serving a Next.js export's scripts uncompressed made Lighthouse charge ~3x their real transfer
 * time). Fonts and images are sent as they are; they are already compressed formats.
 *
 * Step 7 (egress): the browser uses this server as its ONLY proxy (egress.ts confinedBrowserArgs), so every
 * request a page makes arrives here. A request for this server's own origin is served from the site root;
 * anything else (another host, another loopback port, a CONNECT tunnel for https) is refused with 403 and
 * recorded in `blocked`, so rendered QA can report it. Nothing is ever forwarded.
 */
import { createServer, type Server } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

const COMPRESSIBLE = new Set([".html", ".css", ".js", ".mjs", ".json", ".svg", ".txt", ".xml"]);

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

export interface StaticServer {
  origin: string;
  /** Requests for anything but this origin, refused (Step 7). In arrival order, de-duplicated. */
  blocked: string[];
  close(): Promise<void>;
}

/**
 * The file under `root` a request path maps to, as this server serves it ("/" and "dir/" → index.html), or
 * null when the path escapes the root. Shared with the link checker so same-site links are checked against the
 * built files without fetching anything.
 */
export function siteFileFor(root: string, pathname: string): string | null {
  const base = path.resolve(root);
  let rel = pathname;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (rel.endsWith("/")) rel += "index.html";
  const abs = path.resolve(base, `.${rel.startsWith("/") ? rel : `/${rel}`}`);
  return abs === base || abs.startsWith(base + path.sep) ? abs : null;
}

export async function serveDirectory(root: string): Promise<StaticServer> {
  const base = path.resolve(root);
  const blocked: string[] = [];
  const block = (what: string) => {
    const w = what.slice(0, 200);
    if (!blocked.includes(w)) blocked.push(w);
  };
  let ownHost = "";
  const server: Server = createServer(async (req, res) => {
    try {
      const raw = req.url ?? "/";
      // Absolute-form (a proxied request) must name this origin; origin-form must carry this Host.
      const absoluteForm = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
      const url = new URL(raw, `http://${ownHost}`);
      const host = absoluteForm ? url.host : String(req.headers.host ?? "");
      if (host !== ownHost || (absoluteForm && url.protocol !== "http:")) {
        block(absoluteForm ? `${req.method ?? "GET"} ${url.href}` : `${req.method ?? "GET"} http://${host}${raw}`);
        res.writeHead(403, { "content-type": "text/plain", "x-wfact-egress": "blocked" }).end("blocked by rendered QA: only the built site is served");
        return;
      }
      const abs = siteFileFor(base, url.pathname);
      if (!abs) {
        res.writeHead(403).end();
        return;
      }
      const info = await stat(abs).catch(() => null);
      if (!info?.isFile()) {
        res.writeHead(404, { "content-type": "text/plain" }).end("not found");
        return;
      }
      const ext = path.extname(abs).toLowerCase();
      const body = await readFile(abs);
      const headers: Record<string, string> = { "content-type": TYPES[ext] ?? "application/octet-stream", vary: "accept-encoding" };
      if (COMPRESSIBLE.has(ext) && /\bgzip\b/.test(String(req.headers["accept-encoding"] ?? ""))) {
        res.writeHead(200, { ...headers, "content-encoding": "gzip" });
        res.end(req.method === "HEAD" ? undefined : gzipSync(body));
        return;
      }
      res.writeHead(200, headers);
      res.end(req.method === "HEAD" ? undefined : body);
    } catch {
      res.writeHead(500).end();
    }
  });
  // An https:// or ws(s):// request through the proxy arrives as a CONNECT tunnel: never opened.
  server.on("connect", (req, socket) => {
    block(`CONNECT ${req.url ?? "?"}`);
    socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("static server did not bind");
  ownHost = `127.0.0.1:${address.port}`;
  return {
    origin: `http://${ownHost}`,
    blocked,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}
