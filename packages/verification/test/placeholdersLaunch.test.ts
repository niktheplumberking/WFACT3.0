/**
 * Build-quality Package 3: content.placeholders-launch. A site still showing "Image to come" cards fails the launch check;
 * the owner's "launch with placeholders" tick lets it pass; at preview the check is not applicable (placeholders expected).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { placeholdersLaunchCheck } from "../src/checks/registryChecks.js";

const page = (body: string) => `<!doctype html><html lang="en"><head><title>x</title></head><body><main>${body}</main></body></html>`;
const card = '<figure class="media media-placeholder" data-placeholder="work.work.2"><figcaption>Image to come: project photo</figcaption></figure>';
const site = (html: string) => ({ files: { "index.html": page("<h1>Hi</h1>"), "work/index.html": html }, pages: ["index.html", "work/index.html"] });
const ctx = (html: string, extra = {}) => ({ html: page(""), clientSlug: "x", requiredSections: [], otherClientSlugs: [], site: site(html), ...extra });

test("a placeholder card left on any page fails at launch, naming the page and the slot", () => {
  const r = placeholdersLaunchCheck.run(ctx(page(card)));
  assert.equal(r.passed, false);
  assert.match(r.details[0]!, /1 image\(s\) still show a placeholder card \(work\/index\.html: work\.work\.2\)/);
});

test("the owner's 'launch with placeholders' tick lets it pass; no placeholders passes too", () => {
  assert.equal(placeholdersLaunchCheck.run(ctx(page(card), { launchWithPlaceholders: true })).passed, true);
  assert.equal(placeholdersLaunchCheck.run(ctx(page("<p>photo</p>"))).passed, true);
});
