/**
 * Minimal static file server for rendered QA: the page is loaded over http://127.0.0.1 (not file://)
 * so relative links, assets and Lighthouse behave as they would on a host. Read-only, bound to the
 * loopback interface, refuses any path outside the site root.
 *
 * Text files are gzip-compressed when the browser asks for it, as every production host does (Step 4B
 * M4: serving a Next.js export's scripts uncompressed made Lighthouse charge ~3x their real transfer
 * time). Fonts and images are sent as they are; they are already compressed formats.
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
  close(): Promise<void>;
}

export async function serveDirectory(root: string): Promise<StaticServer> {
  const base = path.resolve(root);
  const server: Server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      let rel = decodeURIComponent(url.pathname);
      if (rel.endsWith("/")) rel += "index.html";
      const abs = path.resolve(base, `.${rel}`);
      if (abs !== base && !abs.startsWith(base + path.sep)) {
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
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("static server did not bind");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
