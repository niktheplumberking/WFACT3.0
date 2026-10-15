import { test } from "node:test";
import assert from "node:assert/strict";
import { checkBriefConsistency, conflictNeed, parseDate, resolveOwnerFacts, type FactInput } from "../src/briefConsistency.js";
import { HARBOR_STREET_FACTS } from "./harborStreetFacts.js";

test("Harbor Street: both conflicts are found (opening date q2/q7, offer q3/q8) and nothing else", () => {
  const r = checkBriefConsistency({ ownerFacts: HARBOR_STREET_FACTS });
  assert.equal(r.ok, false);
  assert.deepEqual(
    r.conflicts.map((c) => [c.topic, c.facts.map((f) => f.key), c.values]),
    [
      ["opening_date", ["q2", "q7"], ["15 December 2026", "20 December 2026"]],
      ["offer", ["q3", "q8"], ["Main primary service at 20% off", "Our second flagship offer"]],
    ],
  );
});

test("Harbor Street: q3 is a leftover ('...is unclear') with the neutral topic label; every unresolved label is reported", () => {
  const r = checkBriefConsistency({ ownerFacts: HARBOR_STREET_FACTS });
  assert.deepEqual(r.leftovers.find((l) => l.key === "q3"), { key: "q3", label: "What the opening-day offer entails is unclear", neutralLabel: "Opening offer" });
  // Measured on the real brief: q1, q2, q4 and q6 also still read "not provided" / "not mentioned".
  assert.deepEqual(r.leftovers.map((l) => l.key), ["q1", "q2", "q3", "q4", "q6"]);
  assert.equal(r.leftovers.find((l) => l.key === "q4")?.neutralLabel, "Design reference or inspiration materials");
});

test("the owner's question names both values and the keys involved", () => {
  const r = checkBriefConsistency({ ownerFacts: HARBOR_STREET_FACTS });
  const need = conflictNeed(r.conflicts.find((c) => c.topic === "opening_date")!);
  assert.equal(need.key, "resolve.opening_date");
  assert.match(need.reason, /^Two answers for the opening date: 15 December 2026 and 20 December 2026\. Which is right\? \(answers q2 and q7\)/);
});

test("negative: different topics never conflict", () => {
  const r = checkBriefConsistency({
    ownerFacts: [
      { key: "q2", label: "Specific opening date not mentioned", value: "15 December 2026" },
      { key: "hours", label: "Opening hours", value: "Mon to Fri 8am to 5pm" },
      { key: "q3", label: "What the opening-day offer entails is unclear", value: "20% off" },
      { key: "pricing", label: "Prices or from-prices", value: "From $40" },
    ],
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.conflicts, []);
});

test("negative: the same value written differently is not a conflict", () => {
  const same = (a: string, b: string) =>
    checkBriefConsistency({
      ownerFacts: [
        { key: "q2", label: "Specific opening date not mentioned", value: a },
        { key: "q7", label: "What is the confirmed opening date?", value: b },
      ],
    }).ok;
  assert.equal(same("20 Dec 2026", "20 December 2026"), true);
  assert.equal(same("December 20th, 2026", "2026-12-20"), true);
  assert.equal(same("Saturday 20 December 2026", "20 december 2026."), true);
  assert.equal(same("15 December 2026", "20 December 2026"), false);
  const phones = checkBriefConsistency({ ownerFacts: [{ key: "phone", label: "Business phone number", value: "(555) 010-0142" }, { key: "q5", label: "What phone number should visitors call?", value: "555 010 0142" }] });
  assert.equal(phones.ok, true);
  const offers = checkBriefConsistency({ ownerFacts: [{ key: "q3", label: "Opening offer", value: "Coffee & a pastry, 20% off!" }, { key: "q8", label: "What does the offer include?", value: "coffee and a pastry 20% off" }] });
  assert.equal(offers.ok, true);
  const names = checkBriefConsistency({ ownerFacts: [{ key: "q1", label: "Contact person's last name not provided", value: "Rivera" }, { key: "q9", label: "Who is the contact person (full name)?", value: "Sam Rivera" }] });
  assert.equal(names.ok, true, "a surname that is part of the full name agrees with it");
});

test("negative: a single fact per topic is never a conflict, and a brief with no owner facts passes", () => {
  assert.equal(checkBriefConsistency({ ownerFacts: HARBOR_STREET_FACTS.filter((f) => f.key !== "q7" && f.key !== "q8") }).ok, true);
  assert.deepEqual(checkBriefConsistency({}), { ok: true, conflicts: [], leftovers: [] });
});

test("parseDate reads the spellings owners use and refuses what it cannot read", () => {
  assert.equal(parseDate("15 December 2026"), "2026-12-15");
  assert.equal(parseDate("Dec 15, 2026"), "2026-12-15");
  assert.equal(parseDate("mid December"), null);
});

const inputs = (extra: FactInput[] = []): FactInput[] => [...HARBOR_STREET_FACTS.map((f) => ({ ...f, waived: false })), ...extra];

test("the owner's pick wins: kept once under the topic key, the losing answers dropped, the brief then agrees", () => {
  const facts = resolveOwnerFacts(inputs([
    { key: "resolve.opening_date", label: "Opening date: which is right?", value: "20 December 2026", waived: false },
    { key: "resolve.offer", label: "Opening offer: which is right?", value: "Main primary service at 20% off", waived: false },
  ]));
  assert.deepEqual(facts.filter((f) => ["q2", "q7", "q3", "q8"].includes(f.key)), []);
  assert.deepEqual(facts.find((f) => f.key === "opening_date"), { key: "opening_date", label: "Opening date", value: "20 December 2026" });
  assert.deepEqual(facts.find((f) => f.key === "offer"), { key: "offer", label: "Opening offer", value: "Main primary service at 20% off" });
  assert.equal(facts.filter((f) => f.key.startsWith("resolve.")).length, 0);
  assert.equal(checkBriefConsistency({ ownerFacts: facts }).ok, true);
  // Leftover labels reach the builder neutral.
  assert.equal(facts.find((f) => f.key === "q1")?.label, "Contact person");
});

test("a waived pick means build without that topic: every answer on it is dropped", () => {
  const facts = resolveOwnerFacts(inputs([{ key: "resolve.offer", label: "Opening offer: which is right?", value: null, waived: true }]));
  assert.deepEqual(facts.filter((f) => f.key === "q3" || f.key === "q8" || f.key === "offer"), []);
  assert.deepEqual(checkBriefConsistency({ ownerFacts: facts }).conflicts.map((c) => c.topic), ["opening_date"]);
});

test("without a pick nothing is dropped (the conflict stays for preflight to ask about)", () => {
  const facts = resolveOwnerFacts(inputs());
  assert.equal(facts.length, HARBOR_STREET_FACTS.length);
  assert.equal(checkBriefConsistency({ ownerFacts: facts }).conflicts.length, 2);
});
