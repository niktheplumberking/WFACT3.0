/**
 * Generates the Step 4B M1 fixtures from ONE clean base page, so every failing fixture differs from
 * the clean one by exactly the planted defect. Output (committed, regenerate with `npm run fixtures`):
 *   packages/frontend-loop/design/fixtures/clean.html           passes every deterministic check
 *   packages/frontend-loop/design/fixtures/<RULE-ID>.html       one per rulebook rule
 *   packages/verification/test/fixtures/claims/<class>.html    one per claims defect class
 *   packages/rendered-qa/test/fixtures/<case>.html             broken link, console error, JS budget, reduced motion
 *
 * SYNTHETIC: "Summit Line Roofing" is the fictional Step 2 client; its only facts are those in
 * clients/summit-line-roofing/brief.json (phone 555-0142 and hello@summitlineroofing.example, both
 * SAMPLE placeholders). Fixtures are test inputs, not designs to ship.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repo = path.resolve(import.meta.dirname, "..", "..", "..");
const designDir = path.join(repo, "packages/frontend-loop/design/fixtures");
const claimsDir = path.join(repo, "packages/verification/test/fixtures/claims");
const renderDir = path.join(repo, "packages/rendered-qa/test/fixtures");

const BASE_CSS = `
  :root { --pine: #1F3D36; --cream: #F6F1E7; --copper: #9A4F1C; --ink: #1d2623; --line: #d8cfbd; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--cream); color: var(--ink); font: 17px/1.6 "Avenir Next", "Segoe UI", sans-serif; }
  h1, h2, h3 { font-family: "Iowan Old Style", "Palatino Linotype", Palatino, serif; color: var(--pine); line-height: 1.15; margin: 0 0 .5em; }
  h1 { font-size: clamp(2.2rem, 5vw, 3.6rem); max-width: 18ch; }
  h2 { font-size: clamp(1.6rem, 3vw, 2.3rem); }
  a { color: var(--copper); }
  a:focus-visible, button:focus-visible, summary:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 3px solid var(--copper); outline-offset: 2px; }
  .skip { position: absolute; left: -999px; } .skip:focus { left: 1rem; top: 1rem; background: #fff; padding: .5rem 1rem; }
  header.site { display: flex; justify-content: space-between; align-items: center; padding: 1rem clamp(1rem, 4vw, 3rem); border-bottom: 1px solid var(--line); }
  header.site nav a { display: inline-block; padding: .6rem .5rem; color: var(--pine); }
  .brand { font-weight: 700; color: var(--pine); text-decoration: none; padding: .6rem 0; display: inline-block; }
  main > section { padding: clamp(3rem, 7vw, 6rem) clamp(1rem, 4vw, 3rem); }
  #hero { background: var(--pine); color: var(--cream); display: grid; grid-template-columns: 1.3fr 1fr; gap: 3rem; align-items: end; }
  #hero h1 { color: var(--cream); }
  #hero p { max-width: 46ch; }
  .cta { display: inline-block; background: var(--copper); color: #fff; padding: .9rem 1.4rem; border-radius: 6px; text-decoration: none; font-weight: 600; min-height: 44px; }
  .services { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.5rem 3rem; max-width: 64rem; }
  .services dt { font-weight: 700; color: var(--pine); } .services dd { margin: 0 0 1rem; }
  .packages { border-top: 2px solid var(--pine); max-width: 56rem; }
  .packages div { display: grid; grid-template-columns: 10rem 1fr; gap: 1rem; padding: 1.1rem 0; border-bottom: 1px solid var(--line); }
  .packages b { font-family: "Iowan Old Style", Palatino, serif; font-size: 1.3rem; color: var(--pine); }
  ol.steps { max-width: 44rem; padding-left: 1.4rem; } ol.steps li { margin-bottom: .8rem; }
  .proof { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 1.5rem; }
  .proof blockquote { margin: 0; padding: 1.2rem; background: #fff; border: 1px solid var(--line); }
  .proof .label { display: block; font-size: .8rem; font-weight: 700; color: var(--copper); margin-bottom: .5rem; }
  details { border-bottom: 1px solid var(--line); padding: .8rem 0; max-width: 46rem; } summary { cursor: pointer; font-weight: 600; min-height: 44px; display: flex; align-items: center; }
  #contact { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; }
  form label { display: block; font-weight: 600; margin-top: 1rem; }
  form input, form select, form textarea { width: 100%; padding: .7rem; font: inherit; border: 1px solid #6b6455; background: #fff; min-height: 44px; }
  form button { margin-top: 1.2rem; background: var(--copper); color: #fff; border: 0; padding: .9rem 1.4rem; font: inherit; font-weight: 600; min-height: 44px; border-radius: 6px; }
  footer { padding: 2rem clamp(1rem, 4vw, 3rem); border-top: 1px solid var(--line); }
  @media (max-width: 760px) {
    #hero, #contact, .services, .proof { grid-template-columns: 1fr; }
    .packages div { grid-template-columns: 1fr; }
    header.site { flex-wrap: wrap; }
  }
`;

const SECTIONS = {
  hero: `<section id="hero" aria-labelledby="hero-h">
    <div>
      <h1 id="hero-h">Roof repairs, replacements and a yearly Care visit</h1>
      <p>A five-person roofing and gutter crew. We explain what we find before any work starts, in plain words.</p>
      <p><a class="cta" href="#contact">Request a free roof inspection</a></p>
    </div>
    <p>Most calls are about a leak, missing shingles or blocked gutters. Tell us which, and we will say what a visit involves.</p>
  </section>`,
  services: `<section id="services" aria-labelledby="services-h">
    <h2 id="services-h">What we do</h2>
    <dl class="services">
      <div><dt>Roof repairs</dt><dd>Leaks, lifted or missing shingles, flashing around chimneys and vents.</dd></div>
      <div><dt>Full replacements</dt><dd>Strip, inspect the deck, re-roof and clean up the site afterwards.</dd></div>
      <div><dt>Gutters</dt><dd>Cleaning, re-sealing joints and re-hanging sagging runs.</dd></div>
      <div><dt>Care visit</dt><dd>A yearly check so small problems are caught before they spread.</dd></div>
    </dl>
  </section>`,
  packages: `<section id="packages" aria-labelledby="packages-h">
    <h2 id="packages-h">Three ways to work with us</h2>
    <div class="packages">
      <div><b>Repair</b><span>One problem fixed: we find the cause, agree the scope with you, and repair it.</span></div>
      <div><b>Replace</b><span>A new roof from the deck up, with the old material removed and the site cleared.</span></div>
      <div><b>Care</b><span>A yearly visit: roof and gutters checked, photos of anything worth watching.</span></div>
    </div>
  </section>`,
  process: `<section id="process" aria-labelledby="process-h">
    <h2 id="process-h">How a job runs</h2>
    <ol class="steps">
      <li>You send the short form below, or call the office in the morning.</li>
      <li>We visit, look at the roof and gutters, and show you photos of what we found.</li>
      <li>You get a written scope. Nothing starts until you agree to it.</li>
      <li>We do the work, then clear the site and walk you through what changed.</li>
    </ol>
  </section>`,
  proof: `<section id="proof" aria-labelledby="proof-h">
    <h2 id="proof-h">What customers say</h2>
    <div class="proof">
      <blockquote><span class="label">SAMPLE - replace with real customer feedback</span><p>"They showed me photos of the problem before talking about any work."</p><footer>Sam (fictional)</footer></blockquote>
      <blockquote><span class="label">SAMPLE - replace with real customer feedback</span><p>"The written scope matched what they did."</p><footer>Ola (fictional)</footer></blockquote>
      <blockquote><span class="label">SAMPLE - replace with real customer feedback</span><p>"The yard was tidy when they left."</p><footer>Rae (fictional)</footer></blockquote>
    </div>
  </section>`,
  faq: `<section id="faq" aria-labelledby="faq-h">
    <h2 id="faq-h">Common questions</h2>
    <details><summary>Do you show prices on the site?</summary><p>Not yet. Every roof is different, so we give a written scope after the visit.</p></details>
    <details><summary>Can I book a time online?</summary><p>Send the form and the office will call you back to arrange a time.</p></details>
  </section>`,
  contact: `<section id="contact" aria-labelledby="contact-h">
    <div>
      <h2 id="contact-h">Request a free roof inspection</h2>
      <ul>
        <li>Phone: <a href="tel:5550142">555-0142</a> (SAMPLE number)</li>
        <li>Email: <a href="mailto:hello@summitlineroofing.example">hello@summitlineroofing.example</a> (SAMPLE address)</li>
      </ul>
    </div>
    <form aria-label="Inspection request" onsubmit="event.preventDefault()">
      <label for="f-name">Name</label><input id="f-name" name="name" autocomplete="name" required>
      <label for="f-phone">Phone</label><input id="f-phone" name="phone" type="tel" autocomplete="tel" required>
      <label for="f-area">Address or suburb</label><input id="f-area" name="area" autocomplete="street-address">
      <label for="f-need">What you need</label><select id="f-need" name="need"><option>Repair</option><option>Replace</option><option>Care visit</option><option>Not sure</option></select>
      <label for="f-time">Preferred time of day</label><select id="f-time" name="time"><option>Morning</option><option>Afternoon</option></select>
      <button type="submit">Request a free roof inspection</button>
    </form>
  </section>`,
};

type Parts = { css?: string; head?: string; sections?: Partial<Record<keyof typeof SECTIONS, string>>; extraMain?: string; script?: string; after?: string; note: string };

function page(p: Parts): string {
  const sections = { ...SECTIONS, ...(p.sections ?? {}) };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Summit Line Roofing (synthetic fixture)</title>
<!-- SYNTHETIC TEST FIXTURE, generated by packages/rendered-qa/scripts/make-fixtures.ts: ${p.note} -->
<style>${BASE_CSS}${p.css ?? ""}</style>
${p.head ?? ""}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site"><a class="brand" href="#hero">Summit Line Roofing</a>
  <nav aria-label="Primary"><a href="#services">Services</a> <a href="#packages">Packages</a> <a href="#faq">Questions</a> <a href="#contact">Contact</a></nav></header>
<main id="main">
${Object.values(sections).join("\n")}
${p.extraMain ?? ""}
</main>
<footer><p>Summit Line Roofing. A synthetic client used to test WFACT.</p></footer>
<script>${p.script ?? 'document.documentElement.dataset.ready = "1";'}</script>
</body>
</html>${p.after ?? ""}
`;
}

const cardRow = (n: number) =>
  `<section id="why" aria-labelledby="why-h"><h2 id="why-h">Why us</h2><div class="row">${Array.from({ length: n }, (_, i) =>
    `<div class="card"><span class="icon" aria-hidden="true">&#9632;</span><h3>Point ${i + 1}</h3><p>A short line of supporting text.</p></div>`,
  ).join("")}</div></section>`;
const CARD_CSS = `.row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; } .card { background: #fff; padding: 1.5rem; border: 1px solid var(--line); }`;

const DESIGN: Record<string, Parts> = {
  "clean": { note: "clean base; passes every deterministic check" },
  "DR-GRADIENT-HERO": { note: "planted: purple/blue gradient hero", css: `#hero { background: linear-gradient(135deg, #6d28d9, #2563eb); }` },
  "DR-THREE-CARD-ROW": { note: "planted: generic three-card feature row", css: CARD_CSS, extraMain: cardRow(3) },
  "DR-EMOJI-ICONS": { note: "planted: emoji used as icons", sections: { services: SECTIONS.services.replace("<dt>Roof repairs</dt>", "<dt>🔨 Roof repairs</dt>").replace("<dt>Gutters</dt>", "<dt>🌧️ Gutters</dt>").replace("<dt>Care visit</dt>", "<dt>✅ Care visit</dt>") } },
  "DR-CENTRED-EVERYTHING": { note: "planted: centred-everything layout", css: `main, main * { text-align: center; }` },
  "DR-SINGLE-DEFAULT-FONT": { note: "planted: one default font", css: `body, h1, h2, h3, .packages b { font-family: Inter, sans-serif; }` },
  "DR-FAKE-SOCIAL-PROOF": { note: "planted: initials avatars and a trusted-by strip", css: `.av { display: inline-grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: #fff; color: var(--pine); font-weight: 700; }`, sections: { hero: SECTIONS.hero.replace("<h1", `<p>Trusted by local homeowners <span class="av">JK</span><span class="av">RM</span><span class="av">TP</span></p><h1`) } },
  "DR-FILLER-COPY": { note: "planted: filler marketing copy", sections: { hero: SECTIONS.hero.replace("A five-person roofing and gutter crew.", "Unlock your home's potential with seamless, cutting-edge roofing that will elevate your property.") } },
  "DR-GLASS-EVERYWHERE": { note: "planted: glassmorphism on every block", css: `.services div, .packages div, details, .proof blockquote { backdrop-filter: blur(12px); background: rgba(255,255,255,.4); }` },
  "DR-REPEATED-RHYTHM": { note: "planted (review-only rule): every section uses the same heading + card-grid layout", css: CARD_CSS, sections: Object.fromEntries((["services", "packages", "process", "faq"] as const).map((k) => [k, `<section id="${k}" aria-labelledby="${k}-h"><h2 id="${k}-h">${k[0]!.toUpperCase()}${k.slice(1)}</h2><div class="row"><div class="card"><p>One plain block of text about ${k}.</p></div><div class="card"><p>A second plain block.</p></div><div class="card"><p>A third plain block.</p></div></div></section>`])) },
  "DR-GRATUITOUS-MOTION": { note: "planted: several infinite decorative animations", css: `@keyframes bob { from { transform: translateY(0); } to { transform: translateY(-6px); } } h2, .cta, summary { animation: bob 1.2s ease-in-out infinite alternate; }` },
  "DR-THIN-LOW-CONTRAST": { note: "planted: thin, faded body text", css: `main p, main li, main dd { font-weight: 300; opacity: .6; font-size: 15px; }` },
  "DR-EYEBROW-OVERUSE": { note: "planted: uppercase eyebrow above every heading", css: `.eyebrow { font-size: 12px; text-transform: uppercase; letter-spacing: .18em; color: var(--copper); margin: 0 0 .4rem; }`, sections: Object.fromEntries((["services", "packages", "process", "proof", "faq"] as const).map((k) => [k, SECTIONS[k].replace("<h2", `<p class="eyebrow">${k}</p><h2`)])) },
  // Required qualities are judged by the reviewer only; these fixtures fail them on purpose.
  "DQ-ART-DIRECTION": { note: "planted: ignores the brand direction (generic grey template, no pine/cream/copper)", css: `body { background: #fff; color: #333; font-family: Arial, sans-serif; } #hero { background: #eee; color: #333; } #hero h1, h1, h2, h3 { color: #333; font-family: Arial, sans-serif; } .cta, form button { background: #555; }` },
  "DQ-TYPE-HIERARCHY": { note: "planted: flat type scale, headline same size as body", css: `h1, h2, h3, .packages b { font-size: 17px !important; font-family: inherit; }` },
  "DQ-CONTENT-HIERARCHY": { note: "planted: hero says nothing about the business and offers three competing actions", sections: { hero: `<section id="hero" aria-labelledby="hero-h"><div><h1 id="hero-h">Welcome</h1><p>Have a look around.</p><p><a class="cta" href="#services">Explore</a> <a class="cta" href="#faq">Learn more</a> <a class="cta" href="#contact">Get started</a></p></div></section>` } },
  "DQ-MOBILE-READABLE": { note: "planted: tiny text and tap targets on phones", css: `@media (max-width: 760px) { body { font-size: 11px; } header.site nav a { padding: 0; font-size: 10px; } }` },
};

const CLAIMS: Record<string, Parts> = {
  "leaked-text": { note: "planted: agent tool output after </html>", after: "\nFile-mutation verifier: 2 file edit(s) FAILED this turn." },
  "missing-sample": { note: "planted: testimonials without SAMPLE labels", sections: { proof: SECTIONS.proof.replaceAll('<span class="label">SAMPLE - replace with real customer feedback</span>', "") } },
  "invented-fact": { note: "planted: invented phone, hours and response promise", sections: { contact: SECTIONS.contact.replace("(SAMPLE number)</li>", "(SAMPLE number)</li><li>Office: (555) 014-7732, Mon-Sat 7:00am to 6:00pm. We reply within one business day.</li>") } },
  "banned-claim": { note: "planted: licence, years and superlative claims", sections: { hero: SECTIONS.hero.replace("A five-person roofing and gutter crew.", "The best roofer in the county: licensed and insured, with 25 years of experience.") } },
};

const RENDER: Record<string, Parts> = {
  "broken-link": { note: "planted: a link to a missing page and an anchor with no target", extraMain: `<section id="more" aria-labelledby="more-h"><h2 id="more-h">More</h2><p><a href="./areas.html">Areas we cover</a> and <a href="#missing-anchor">how we schedule visits</a>.</p></section>` },
  "console-error": { note: "planted: a script that throws at load", script: `document.documentElement.dataset.ready = "1"; undefinedFunctionCall();` },
  "over-budget-js": { note: "planted: about 80 KB of inline JavaScript (Track A budget is 50 KB)", script: `window.__pad = ${JSON.stringify("x".repeat(80_000))}; document.documentElement.dataset.ready = "1";` },
  "reduced-motion-ignored": { note: "planted: an infinite animation with no prefers-reduced-motion override", css: `@keyframes pulse { from { opacity: 1; } to { opacity: .85; } } .cta { animation: pulse 1s ease-in-out infinite alternate; }` },
};

for (const [dir, set] of [[designDir, DESIGN], [claimsDir, CLAIMS], [renderDir, RENDER]] as const) {
  mkdirSync(dir, { recursive: true });
  for (const [name, parts] of Object.entries(set)) writeFileSync(path.join(dir, `${name}.html`), page(parts));
}
// Sanity: the rulebook's fixture list and the generated files agree.
const rulebook = JSON.parse(readFileSync(path.join(repo, "packages/frontend-loop/design/rulebook.json"), "utf-8")) as { rules: { id: string }[] };
const missing = rulebook.rules.filter((r) => !(r.id in DESIGN)).map((r) => r.id);
if (missing.length) throw new Error(`rulebook rules without a fixture: ${missing.join(", ")}`);
console.log(`wrote ${Object.keys(DESIGN).length} design, ${Object.keys(CLAIMS).length} claims, ${Object.keys(RENDER).length} render fixtures`);
