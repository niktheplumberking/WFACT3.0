#!/usr/bin/env node
/**
 * Track B build from the command line (Step 4B M4), used by CI to prove the build step on its own:
 *
 *   npm run build-track-b -- <brief.json> <content.json> [outDir]
 *
 * Validates the content against the brief, runs the isolated build (no network, allow-listed
 * environment, `npm ci --offline` from the package cache), writes the static export to outDir when given,
 * and prints the build record (isolation probe, timings, output hash). Needs no secrets and calls no model.
 * Exit 0 only when the build succeeded with the network blocked and no unexpected environment variables.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadBrief } from "../brief.js";
import { validateSiteContent } from "./content.js";
import { buildTrackBSite, TrackBBuildError } from "./build.js";

async function main(): Promise<void> {
  const [briefPath, contentPath, outDir] = process.argv.slice(2);
  if (!briefPath || !contentPath) {
    console.error("Usage: npm run build-track-b -- <brief.json> <content.json> [outDir]");
    process.exitCode = 1;
    return;
  }
  const brief = loadBrief(briefPath);
  const { content, errors } = validateSiteContent(JSON.parse(readFileSync(contentPath, "utf-8")), brief);
  if (!content) {
    console.error(`content is not valid:\n- ${errors.join("\n- ")}`);
    process.exitCode = 1;
    return;
  }
  try {
    const b = await buildTrackBSite(content);
    if (outDir) {
      const bin = new Set(b.binary);
      for (const [name, body] of Object.entries(b.files)) {
        const target = path.join(outDir, name);
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, bin.has(name) ? Buffer.from(body, "base64") : body);
      }
    }
    console.log(JSON.stringify({ pages: b.pages, binary: b.binary, sourceFiles: Object.keys(b.source).length, record: b.record }, null, 2));
    if (b.record.isolation.network !== "blocked" || b.record.isolation.unexpectedEnv.length) process.exitCode = 1;
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    if (err instanceof TrackBBuildError && err.log) console.error(err.log.slice(-4000));
    process.exitCode = 1;
  }
}

void main();
