/**
 * Step 4B M4: no-console-errors on a multi-page site. A script the site itself ships is allowed and
 * parsed; an external, missing or broken one fails. A single page keeps the original rule (no src at all).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { runChecks } from "../src/registry.js";
import { noConsoleErrorsCheck } from "../src/checks/noConsoleErrors.js";

const page = (scripts: string) => `<!doctype html><html lang="en"><head><title>t</title></head><body><main><h1>x</h1></main>${scripts}</body></html>`;
const ctx = (files: Record<string, string>, pages: string[]) => ({
  html: files[pages[0]!]!,
  clientSlug: "a",
  requiredSections: [],
  otherClientSlugs: [],
  site: { files, pages, binary: ["_next/static/media/f.woff2"] },
});
const details = (files: Record<string, string>, pages: string[]) => runChecks(ctx(files, pages), [noConsoleErrorsCheck])[0]!.details;

test("a site's own scripts (absolute and relative paths) are allowed and parsed", () => {
  const files = {
    "index.html": page('<script src="/_next/static/chunks/a.js" async=""></script>'),
    "work/index.html": page('<script src="../_next/static/chunks/a.js?v=1"></script>'),
    "_next/static/chunks/a.js": "self.x = (self.x || []).concat([1]);",
  };
  assert.deepEqual(details(files, ["index.html", "work/index.html"]), []);
});

test("external, missing, binary and syntactically broken scripts each fail with the page named", () => {
  const files = {
    "index.html": page(
      '<script src="https://cdn.example.com/x.js"></script><script src="//cdn.example.com/y.js"></script><script src="/_next/static/chunks/missing.js"></script><script src="/_next/static/media/f.woff2"></script><script src="/_next/static/chunks/bad.js"></script>',
    ),
    "_next/static/chunks/bad.js": "function (",
    "_next/static/media/f.woff2": "AAAA",
  };
  const d = details(files, ["index.html"]).join("\n");
  assert.match(d, /index\.html: <script> #1 references an external src/);
  assert.match(d, /index\.html: <script> #2 references an external src/);
  assert.match(d, /#3 references \/_next\/static\/chunks\/missing\.js, which is not a script file of this site/);
  assert.match(d, /#4 references \/_next\/static\/media\/f\.woff2, which is not a script file of this site/);
  assert.match(d, /#5 loads \/_next\/static\/chunks\/bad\.js, which has a syntax error/);
});

test("a single page (no site) keeps the original rule: any script src fails", () => {
  const r = noConsoleErrorsCheck.run({ html: page('<script src="/a.js"></script>'), clientSlug: "a", requiredSections: [], otherClientSlugs: [] });
  assert.equal(r.passed, false);
  assert.match(r.details[0]!, /references an external src/);
});
