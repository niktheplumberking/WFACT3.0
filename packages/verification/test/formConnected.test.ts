/**
 * Step 25 / MVP M4: launch.form-connected. A form with no endpoint (the starters' "not connected" form) fails at launch,
 * naming the page; a form wired to submit-lead with a site key, variant and honeypot passes; at preview the check is not
 * applicable (rehearsals keep their honest unconnected forms); a single file has no site, so it is not applicable either.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { formConnectedCheck } from "../src/checks/registryChecks.js";
import { entryById, registryCheck } from "../src/evalRegistry.js";

const page = (body: string) => `<!doctype html><html lang="en"><head><title>x</title></head><body><main>${body}</main></body></html>`;
const ENDPOINT = "https://abcdefghijklmnopqrst.supabase.co/functions/v1/submit-lead";
const KEY = "0b7d3c1e-2a4f-4e6b-9c8d-1f2e3a4b5c6d";
const wired = `<form id="request" action="${ENDPOINT}" method="post"><input type="hidden" name="site_key" value="${KEY}"><input type="hidden" name="variant" value="request"><div class="hp"><label for="w">Leave this field empty</label><input id="w" name="website"></div><label for="n">Name</label><input id="n" name="name"></form>`;
const unconnected = '<form id="request" data-request data-unconnected="Thank you. This form is not connected yet, so nothing was sent."><label for="n">Name</label><input id="n" name="name"></form>';
const site = (contact: string) => ({ files: { "index.html": page("<h1>Hi</h1>"), "contact.html": page(contact) }, pages: ["index.html", "contact.html"] });
const ctx = (contact: string, extra = {}) => ({ html: page(""), clientSlug: "x", requiredSections: [], otherClientSlugs: [], site: site(contact), ...extra });

test("an unconnected form fails at launch, naming the page and the form", () => {
  const r = formConnectedCheck.run(ctx(unconnected));
  assert.equal(r.passed, false);
  assert.match(r.details[0]!, /^contact\.html: form #request has no action, so it is not connected/);
  assert.match(r.details[0]!, /has no site_key; has no form variant; has no honeypot field/);
});

test("a form wired to submit-lead with key, variant and honeypot passes; a site with no form passes", () => {
  assert.equal(formConnectedCheck.run(ctx(wired)).passed, true);
  assert.equal(formConnectedCheck.run(ctx("<p>Call us.</p>")).passed, true);
  assert.equal(formConnectedCheck.run(ctx('<form role="search" action="/search"><label for="q">Search</label><input id="q" name="q"></form>')).passed, true);
});

test("a form posting anywhere else, by GET, or with a malformed key fails", () => {
  const other = formConnectedCheck.run(ctx(wired.replace(ENDPOINT, "https://forms.example.test/submit")));
  assert.match(other.details[0]!, /posts to "https:\/\/forms\.example\.test\/submit", not the submit-lead endpoint/);
  assert.match(formConnectedCheck.run(ctx(wired.replace('method="post"', 'method="get"'))).details[0]!, /is not method="post"/);
  assert.match(formConnectedCheck.run(ctx(wired.replace(KEY, "not-a-key"))).details[0]!, /has no site_key/);
  const redirected = wired.replace("</form>", '<button type="submit" formaction="https://forms.example.test/x">Send</button></form>');
  assert.match(formConnectedCheck.run(ctx(redirected)).details[0]!, /has a button with formaction="https:\/\/forms\.example\.test\/x"/);
});

test("through the registry: not applicable at preview (rehearsals keep honest forms), failing at launch", () => {
  const check = registryCheck(entryById("launch.form-connected")!);
  const preview = check.run(ctx(unconnected));
  assert.equal(preview.passed, true);
  assert.match(preview.notApplicable ?? "", /launch-stage check/);
  const launch = check.run(ctx(unconnected, { stage: "launch" }));
  assert.equal(launch.passed, false);
  assert.equal(launch.severity, "major");
});

test("a single page with no site files is not applicable (the check reads the whole site)", () => {
  const r = formConnectedCheck.run({ html: page(unconnected), clientSlug: "x", requiredSections: [], otherClientSlugs: [] });
  assert.equal(r.passed, true);
  assert.ok(r.notApplicable);
});
