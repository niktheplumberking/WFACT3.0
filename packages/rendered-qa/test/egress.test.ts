/**
 * Step 7 attack tests for the QA runner's egress (registry check attack.qa-egress): a built page is untrusted
 * input and must not make the job runner reach loopback services, the private network or the cloud metadata
 * endpoint. Real sockets and real headless Chromium; the only stand-in is an injected DNS resolver (so a
 * "public" name can be made to answer with a private address, the rebinding case) and, for the redirect test,
 * a policy that treats this machine's loopback as "public" so a local server can play the remote site.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { checkExternalLink } from "../src/egress.js";
import { serveDirectory } from "../src/server.js";
import { runRenderedQa } from "../src/rendered.js";
import { nonPublicReason } from "@wfact/verification/net";

async function listen(handler: Parameters<typeof createServer>[1]): Promise<{ server: Server; port: number; hits: string[] }> {
  const hits: string[] = [];
  const server = createServer((req, res) => {
    hits.push(`${req.method} ${req.url}`);
    handler!(req, res);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  return { server, port, hits };
}
const close = (s: Server) => new Promise<void>((r) => s.close(() => r()));

test("refuses every non-public address: loopback, private, CGNAT, link-local/metadata, IPv6 forms, encoded IPv4, local names", async () => {
  const urls = [
    "http://127.0.0.1/", "http://127.1.2.3:80/", "http://localhost/", "http://sub.localhost/", "http://0.0.0.0/",
    "http://10.0.0.5/", "http://172.16.4.4/", "http://172.31.255.255/", "http://192.168.1.1/", "http://100.64.0.1/",
    "http://169.254.169.254/latest/meta-data/", "http://metadata.google.internal/computeMetadata/v1/", "http://metadata/",
    "http://[::1]/", "http://[::]/", "http://[::ffff:127.0.0.1]/", "http://[::ffff:a9fe:a9fe]/", "http://[fd00::1]/", "http://[fe80::1]/", "http://[64:ff9b::7f00:1]/",
    "http://2130706433/", "http://0177.0.0.1/", "http://0x7f.1/", "http://printer.local/", "http://intranet/", "http://db.internal/",
    "ftp://ftp.example.org/", "file:///etc/passwd", "http://user:pass@example.org/", "http://example.org:8080/",
  ];
  let lookups = 0;
  for (const u of urls) {
    const r = await checkExternalLink(u, { lookup: async () => { lookups += 1; return [{ address: "93.184.216.34", family: 4 }]; } });
    assert.equal(r.outcome, "refused", `${u} was not refused: ${JSON.stringify(r)}`);
  }
  assert.equal(lookups, 0, "a URL refusable from its text alone never reaches DNS");
});

test("a public-looking name that RESOLVES to a private or metadata address is refused (DNS checked, every answer)", async () => {
  for (const answers of [[{ address: "10.1.2.3", family: 4 }], [{ address: "169.254.169.254", family: 4 }], [{ address: "93.184.216.34", family: 4 }, { address: "127.0.0.1", family: 4 }], [{ address: "::1", family: 6 }]]) {
    const r = await checkExternalLink("https://innocent-looking.example.com/", { lookup: async () => answers });
    assert.equal(r.outcome, "refused", JSON.stringify(answers));
    assert.match((r as { reason: string }).reason, /resolves to/);
  }
});

test("a public address is allowed; the connection goes to the CHECKED address and every redirect hop is re-checked", async () => {
  // A local server plays the remote site. The injected resolver answers 127.0.0.1 for its name, the injected
  // policy treats 127.0.0.1 as public and its port is allowed: test-only widenings, nothing else changes.
  const site = await listen((req, res) => {
    if (req.url === "/start") res.writeHead(302, { location: "/final" }).end();
    else if (req.url === "/to-metadata") res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" }).end();
    else if (req.url === "/to-rebind") res.writeHead(301, { location: "http://rebind.example.com/" }).end();
    else if (req.url === "/gone") res.writeHead(404).end();
    else res.writeHead(200, { "content-type": "text/plain" }).end("ok");
  });
  const opts = {
    lookup: async (host: string) => (host === "rebind.example.com" ? [{ address: "10.0.0.7", family: 4 }] : [{ address: "127.0.0.1", family: 4 }]),
    addressPolicy: (ip: string) => (ip === "127.0.0.1" ? null : nonPublicReason(ip)),
    allowPorts: [String(site.port)],
  };
  const base = `http://site.example.com:${site.port}`;
  try {
    const ok = await checkExternalLink(`${base}/start`, opts);
    assert.equal(ok.outcome, "ok", JSON.stringify(ok));
    assert.equal((ok as { finalUrl: string }).finalUrl, `${base}/final`);
    assert.deepEqual(site.hits, ["HEAD /start", "HEAD /final"], "connected to the pinned (checked) address, HEAD only, no body");
    const meta = await checkExternalLink(`${base}/to-metadata`, opts);
    assert.equal(meta.outcome, "refused");
    assert.match((meta as { reason: string }).reason, /redirect to http:\/\/169\.254\.169\.254/);
    const rebind = await checkExternalLink(`${base}/to-rebind`, opts);
    assert.equal(rebind.outcome, "refused");
    assert.match((rebind as { reason: string }).reason, /rebind\.example\.com resolves to 10\.0\.0\.7/);
    const gone = await checkExternalLink(`${base}/gone`, opts);
    assert.deepEqual([gone.outcome, (gone as { status: number }).status], ["http-error", 404]);
    // Without the test-only port allowance the same URL is refused before any connection.
    const before = site.hits.length;
    assert.equal((await checkExternalLink(`${base}/start`, { ...opts, allowPorts: [] })).outcome, "refused");
    assert.equal(site.hits.length, before);
  } finally {
    await close(site.server);
  }
});

test("bounded timeout: a host that accepts and never answers is reported unreachable, not waited on forever", async () => {
  const silent = await listen(() => { /* never respond */ });
  try {
    const started = Date.now();
    const r = await checkExternalLink(`http://slow.example.com:${silent.port}/`, {
      lookup: async () => [{ address: "127.0.0.1", family: 4 }],
      addressPolicy: (ip) => (ip === "127.0.0.1" ? null : nonPublicReason(ip)),
      allowPorts: [String(silent.port)],
      timeoutMs: 300,
    });
    assert.equal(r.outcome, "unreachable");
    assert.match((r as { reason: string }).reason, /timed out after 300 ms/);
    assert.ok(Date.now() - started < 5000);
  } finally {
    silent.server.closeAllConnections();
    await close(silent.server);
  }
});

test("the site server refuses every request for another origin (absolute-form proxy requests, wrong Host, CONNECT) and records it", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "egress-site-"));
  writeFileSync(path.join(dir, "index.html"), "<!doctype html><title>x</title><p>hi</p>");
  const srv = await serveDirectory(dir);
  const { request } = await import("node:http");
  const port = Number(new URL(srv.origin).port);
  const raw = (pathOrUrl: string, headers: Record<string, string> = {}, method = "GET") =>
    new Promise<number>((resolve, reject) => {
      const req = request({ host: "127.0.0.1", port, path: pathOrUrl, method, headers }, (res) => { res.resume(); resolve(res.statusCode ?? 0); });
      req.on("connect", (res) => resolve(res.statusCode ?? 0));
      req.on("error", reject);
      req.end();
    });
  try {
    assert.equal(await raw("/index.html"), 200);
    assert.equal(await raw("http://169.254.169.254/latest/meta-data/"), 403);
    assert.equal(await raw(`http://127.0.0.1:${port + 1}/`), 403, "another loopback port is another origin");
    assert.equal(await raw("/index.html", { host: "evil.example.com" }), 403);
    assert.equal(await raw("internal.example.com:443", {}, "CONNECT"), 403);
    assert.ok(srv.blocked.some((b) => b.includes("169.254.169.254")));
    assert.ok(srv.blocked.some((b) => b.startsWith("CONNECT internal.example.com:443")));
  } finally {
    await srv.close();
  }
});

test("in Chromium: a page that points the browser at metadata, a private host and another loopback port reaches none of them, and render.links says so", async () => {
  const canary = await listen((_req, res) => res.writeHead(200, { "content-type": "image/svg+xml" }).end("<svg xmlns='http://www.w3.org/2000/svg'/>"));
  const dir = mkdtempSync(path.join(tmpdir(), "egress-page-"));
  writeFileSync(
    path.join(dir, "index.html"),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>SYNTHETIC egress attack</title></head>
<body><main><h1>Egress attack page (synthetic)</h1>
<img src="http://127.0.0.1:${canary.port}/loopback-canary.svg" alt="loopback canary" width="10" height="10">
<iframe src="http://169.254.169.254/latest/meta-data/" title="metadata" width="10" height="10"></iframe>
<img src="http://10.0.0.1/private.png" alt="private" width="10" height="10">
<link rel="stylesheet" href="https://fonts.example.com/font.css">
<script>fetch("http://127.0.0.1:${canary.port}/fetch-canary").catch(() => {});</script>
</main></body></html>`,
  );
  try {
    const r = await runRenderedQa(dir, { outDir: mkdtempSync(path.join(tmpdir(), "egress-out-")), lighthouse: false });
    assert.deepEqual(canary.hits, [], `the page reached a loopback service: ${canary.hits.join(", ")}`);
    const links = r.results.find((x) => x.checkId === "render.links")!;
    assert.equal(links.passed, false);
    const d = links.details.join("\n");
    assert.match(d, /blocked: GET http:\/\/127\.0\.0\.1:\d+\/loopback-canary\.svg/);
    assert.match(d, /blocked: GET http:\/\/169\.254\.169\.254\/latest\/meta-data\//);
    assert.match(d, /blocked: GET http:\/\/10\.0\.0\.1\/private\.png/);
    assert.match(d, /blocked: CONNECT fonts\.example\.com:443/);

    // Control: the same page in an UNCONFINED browser does reach the loopback canary, so the attack is real
    // and the confinement above is what stopped it.
    const { chromium } = await import("playwright");
    const srv = await serveDirectory(dir);
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.goto(`${srv.origin}/`, { waitUntil: "commit" });
      for (let i = 0; i < 50 && canary.hits.length === 0; i += 1) await page.waitForTimeout(100);
      assert.ok(canary.hits.length > 0, "control: an unconfined browser should have reached the canary");
    } finally {
      await browser.close();
      await srv.close();
    }
  } finally {
    await close(canary.server);
  }
});
