/**
 * Step 25 / MVP M4: the lead form on the brief and the Track A request form. The shape is checked (only the runner sets it),
 * a connected form posts to submit-lead with the site key, page, variant, fill time and honeypot, and without a lead form
 * the form stays exactly as honest as before ("not connected", no action). Content is the SYNTHETIC Summit Line fixture.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { loadBrief, parseBrief, InvalidBriefError } from "../src/brief.js";
import { leadFormOf, parseLeadForm, LeadFormError } from "../src/leadForm.js";
import { validateSiteContent, type SiteContent } from "../src/trackA/content.js";
import { renderSite } from "../src/trackA/render.js";

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const brief = loadBrief(path.join(ROOT, "clients", "summit-line-roofing", "brief.json"));
const content = validateSiteContent(
  JSON.parse(readFileSync(path.join(import.meta.dirname, "fixtures", "track-a", "summit-line.content.json"), "utf-8")) as SiteContent,
  brief,
).content!;
const LEAD = { endpoint: "https://abcdefghijklmnopqrst.supabase.co/functions/v1/submit-lead", siteKey: "0b7d3c1e-2a4f-4e6b-9c8d-1f2e3a4b5c6d" };
const formOf = (html: string) => html.slice(html.indexOf("<form"), html.indexOf("</form>") + 7);

test("the lead form shape: only the submit-lead endpoint and a lower-case UUID key, nothing else", () => {
  assert.deepEqual(parseLeadForm(LEAD), LEAD);
  assert.throws(() => parseLeadForm({ ...LEAD, endpoint: "https://evil.example.test/functions/v1/submit-lead" }), LeadFormError);
  assert.throws(() => parseLeadForm({ ...LEAD, endpoint: "http://abcdefghijklmnopqrst.supabase.co/functions/v1/submit-lead" }), LeadFormError);
  assert.throws(() => parseLeadForm({ ...LEAD, siteKey: LEAD.siteKey.toUpperCase() }), LeadFormError);
  assert.throws(() => parseLeadForm({ ...LEAD, redirect: "https://x.test" }), /unknown keys: redirect/);
  assert.throws(() => parseLeadForm("x"), LeadFormError);
  assert.equal(leadFormOf({}), null);
});

test("a brief carries a valid lead form and refuses a bad one", () => {
  const raw = JSON.parse(readFileSync(path.join(ROOT, "clients", "summit-line-roofing", "brief.json"), "utf-8"));
  assert.deepEqual(parseBrief({ ...raw, leadForm: LEAD }).leadForm, LEAD);
  assert.equal(parseBrief(raw).leadForm, undefined);
  assert.throws(() => parseBrief({ ...raw, leadForm: { ...LEAD, siteKey: "abc" } }), InvalidBriefError);
});

test("without a lead form the Track A form is unchanged: not connected, no action, no honeypot, no privacy line", () => {
  const html = renderSite(content).files["contact.html"]!;
  const form = formOf(html);
  assert.match(form, /data-unconnected="Thank you\. This form is not connected yet, so nothing was sent\. Please call or email instead\."/);
  assert.doesNotMatch(form, /action=|method=|site_key|name="website"|form-privacy/);
  assert.doesNotMatch(html, /id="lead-sent"/);
});

test("with a lead form the Track A form posts to submit-lead with key, variant, page, fill time and honeypot", () => {
  const contact = renderSite(content, { leadForm: LEAD }).files["contact.html"]!;
  const form = formOf(contact);
  assert.ok(form.includes(`action="${LEAD.endpoint}" method="post" data-endpoint`));
  assert.ok(form.includes(`<input type="hidden" name="site_key" value="${LEAD.siteKey}">`));
  assert.match(form, /<input type="hidden" name="variant" value="request">/);
  assert.match(form, /<input type="hidden" name="page" value="\/contact\.html">/);
  assert.match(form, /<input type="hidden" name="fill_ms" value="">/);
  assert.match(form, /<div class="hp"><label for="rq-website">Leave this field empty<\/label><input id="rq-website" name="website" type="text" tabindex="-1" autocomplete="off"><\/div>/);
  assert.doesNotMatch(form, /data-unconnected/);
  // Says what happens to the details, near the button; the no-JS return messages are on the page, with the fallback.
  assert.match(form, /<p class="form-privacy">Your details go only to Summit Line Roofing, and are used only to reply to you\.<\/p><button/);
  assert.match(contact, /<p class="form-flash" id="lead-sent" tabindex="-1">Thank you, we have your request\. We will be in touch soon\.<\/p>/);
  assert.match(contact, /id="lead-error"[^>]*>Your request was not sent\. Please try again, or call 555-0142 or email hello@summitlineroofing\.example instead\.<\/p>/);
  // The site's script sends it with fetch, with how long the form was open on the visitor's own clock.
  assert.match(contact, /body\.fill_ms = String\(Date\.now\(\) - loadedAt\)/);
  assert.match(contact, /fetch\(form\.getAttribute\("action"\)/);
});

test("the Track B builder is told the form is not connected only when it is not; connected, the note says what happens next", async () => {
  const { trackBSystemPrompt } = await import("../src/trackB/loop.js");
  assert.match(trackBSystemPrompt("multi"), /formNote must say honestly that the form is not connected yet/);
  const connected = trackBSystemPrompt("multi", true);
  assert.doesNotMatch(connected, /formNote must say honestly that the form is not connected/);
  assert.match(connected, /The form is connected: it sends\. formNote says in one short sentence what happens next/);
});
