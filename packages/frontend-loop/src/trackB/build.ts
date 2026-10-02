/**
 * Track B build (Step 4B M4): validated content in, a static Next.js export out, built with no network
 * and no secrets.
 *
 *   1. Copy the committed starter's source (never its node_modules) into a fresh temp folder and write
 *      content/site.json plus content/theme.json (colour tokens computed by buildTrackBPalette).
 *   2. Probe the isolation (network blocked, environment allow-listed). A failed probe stops the build.
 *   3. In isolation: `npm ci --offline --ignore-scripts` (the package cache is the only source; no
 *      install scripts run), then `npm run build` (route generation + `next build --webpack`).
 *   4. Read `out/` back: text files as text, fonts and images as base64 (listed in `binary`), and the
 *      exact source that was built (starter files, generated routes, content, lock file) for the artifact.
 *
 * The output is deterministic for the same content and starter: the build id is the content hash
 * (next.config.mjs) and chunk names are content hashes, so a re-build can be compared byte for byte.
 */
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { TRACK_B_STARTER_DIR } from "../paths.js";
import { buildTrackBPalette } from "./palette.js";
import { probeIsolation, runIsolated, type IsolationMethod, type IsolationProbe } from "./isolate.js";
import type { SiteContent } from "./content.js";

export const STARTER_VERSION = "track-b-starter/1.0.0";

/** Extensions read back as text; everything else in the export is binary (base64). */
const TEXT_EXT = new Set([".html", ".txt", ".js", ".css", ".json", ".svg", ".xml", ".webmanifest", ".map"]);
/** Starter paths that are never source: installed packages, build output, per-build generated files. */
const SKIP = new Set(["node_modules", ".next", "out", "content", "next-env.d.ts", "tsconfig.tsbuildinfo"]);

export class TrackBBuildError extends Error {
  constructor(
    message: string,
    readonly log: string,
  ) {
    super(message);
    this.name = "TrackBBuildError";
  }
}

export interface BuildRecord {
  starterVersion: string;
  isolation: IsolationProbe;
  installMs: number;
  buildMs: number;
  outputFiles: number;
  outputBytes: number;
  /** sha256 over every output file's path and bytes, in path order. Same content + starter = same hash. */
  outputHash: string;
}

export interface TrackBBuild {
  /** Every file of the static export, keyed by site-relative path. Binary files are base64. */
  files: Record<string, string>;
  /** Paths in `files` whose value is base64. */
  binary: string[];
  /** Page files in navigation order ("index.html", "services/index.html", ...). */
  pages: string[];
  /** The exact project that was built (starter files, generated routes, content, lock file), as text. */
  source: Record<string, string>;
  record: BuildRecord;
}

function walk(dir: string, base = dir, skipTop = false): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(base, abs).split(path.sep).join("/");
    if (skipTop && SKIP.has(rel)) continue;
    if (entry.isDirectory()) {
      // Route folders generated from an earlier local build carry a .generated marker; they are not starter source.
      if (skipTop && existsSync(path.join(abs, ".generated"))) continue;
      out.push(...walk(abs, base));
    } else if (entry.isFile()) out.push(rel);
  }
  return out.sort();
}

/** The starter's committed source files (relative paths), as the build will copy them. */
export function starterSourceFiles(starterDir = TRACK_B_STARTER_DIR): string[] {
  return walk(starterDir, starterDir, true).filter((f) => f !== "lib/type.generated.ts");
}

export const pageFile = (slug: string) => (slug === "index" ? "index.html" : `${slug}/index.html`);

export async function buildTrackBSite(content: SiteContent, opts: { starterDir?: string; keep?: boolean; method?: IsolationMethod } = {}): Promise<TrackBBuild> {
  const { palette, problems } = buildTrackBPalette(content.brand.colors);
  if (!palette) throw new TrackBBuildError(`brand colours are not usable: ${problems.join(" ")}`, "");
  const starterDir = opts.starterDir ?? TRACK_B_STARTER_DIR;
  // A stable folder per content + starter version: webpack's chunk split depends on the absolute path,
  // so a random temp name made two builds of the same content differ (found by the determinism test).
  // Two simultaneous builds of the same content would share this folder; each runner builds one site at a time.
  const key = createHash("sha256").update(STARTER_VERSION).update(JSON.stringify(content)).digest("hex").slice(0, 16);
  const work = path.join(tmpdir(), "wfact-track-b", key);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  try {
    for (const rel of starterSourceFiles(starterDir)) {
      mkdirSync(path.dirname(path.join(work, rel)), { recursive: true });
      cpSync(path.join(starterDir, rel), path.join(work, rel));
    }
    mkdirSync(path.join(work, "content"));
    writeFileSync(path.join(work, "content/site.json"), `${JSON.stringify(content, null, 2)}\n`);
    writeFileSync(path.join(work, "content/theme.json"), `${JSON.stringify(palette, null, 2)}\n`);

    const isolation = await probeIsolation(work, opts.method);
    if (isolation.network !== "blocked") throw new TrackBBuildError(`refusing to build: the isolated build could reach the network (${isolation.attempts.join("; ")})`, "");
    if (isolation.unexpectedEnv.length) throw new TrackBBuildError(`refusing to build: unexpected environment variables in the build: ${isolation.unexpectedEnv.join(", ")}`, "");

    const install = await runIsolated("npm", ["ci", "--offline", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: work, method: isolation.method, timeoutMs: 300_000 });
    if (install.code !== 0) throw new TrackBBuildError(`npm ci --offline failed (exit ${install.code}); a package is missing from the package cache`, install.output);
    const build = await runIsolated("npm", ["run", "build"], { cwd: work, method: isolation.method, timeoutMs: 600_000 });
    if (build.code !== 0) throw new TrackBBuildError(`next build failed (exit ${build.code})`, build.output);

    const outDir = path.join(work, "out");
    const files: Record<string, string> = {};
    const binary: string[] = [];
    const hash = createHash("sha256");
    let outputBytes = 0;
    for (const rel of walk(outDir)) {
      const bytes = readFileSync(path.join(outDir, rel));
      hash.update(rel).update("\0").update(bytes).update("\0");
      outputBytes += bytes.length;
      if (TEXT_EXT.has(path.extname(rel).toLowerCase())) files[rel] = bytes.toString("utf8");
      else {
        files[rel] = bytes.toString("base64");
        binary.push(rel);
      }
    }
    const pages = content.pages.map((p) => pageFile(p.slug));
    for (const p of pages) if (files[p] === undefined) throw new TrackBBuildError(`the export has no ${p}`, build.output);

    const source: Record<string, string> = {};
    for (const rel of [...starterSourceFiles(work), "lib/type.generated.ts", "content/site.json", "content/theme.json", ...walk(path.join(work, "app")).filter((f) => f.endsWith("/page.tsx")).map((f) => `app/${f}`)]) {
      // Dotfiles (.gitignore) are tooling, not the site's source, and the artifact store refuses them.
      if (rel.split("/").some((seg) => seg.startsWith("."))) continue;
      if (source[rel] === undefined && existsSync(path.join(work, rel))) source[rel] = readFileSync(path.join(work, rel), "utf8");
    }

    return {
      files,
      binary,
      pages,
      source,
      record: {
        starterVersion: STARTER_VERSION,
        isolation,
        installMs: install.durationMs,
        buildMs: build.durationMs,
        outputFiles: Object.keys(files).length,
        outputBytes,
        outputHash: hash.digest("hex"),
      },
    };
  } finally {
    if (!opts.keep) rmSync(work, { recursive: true, force: true });
  }
}
