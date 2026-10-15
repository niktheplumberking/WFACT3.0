import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeOpenQuestions, topicOf } from "../src/factTopics.js";

// Harbor Street plan 4acbde1f (approved 2026-10-02): the intake's ambiguities, then the Planner's questions, word for word.
const AMBIGUITIES = [
  "Contact person's last name not provided",
  "Specific opening date not mentioned",
  "What the opening-day offer entails is unclear",
  "Design reference or inspiration materials not provided",
  "Any existing brand guidelines or colors not specified",
  "Target audience details not mentioned",
];
const QUESTIONS = [
  "What is the confirmed opening date for the second location?",
  "What exactly does the opening-day offer include?",
  "Who is the contact person (full name) for the page?",
  "Are there existing brand colors, fonts, or logo files to use?",
  "Who is the target audience for this launch (existing customers, new neighborhood, etc.)?",
  "Is there any real customer feedback or community recognition we can reference for the social-proof section, or should it focus on general brand/community messaging instead?",
];

test("topics: 'opening-day offer' is the offer, not the opening date; slots match by key", () => {
  assert.equal(topicOf(null, "What the opening-day offer entails is unclear")?.id, "offer");
  assert.equal(topicOf(null, "Specific opening date not mentioned")?.id, "opening_date");
  assert.equal(topicOf(null, "Opening hours")?.id, "hours");
  assert.equal(topicOf("site_url", "Live site address")?.id, "site_url");
  assert.equal(topicOf(null, "Business email address")?.id, "email");
  assert.equal(topicOf(null, "Target audience details not mentioned"), null);
});

test("Harbor Street 4acbde1f: a topic the Planner asks about is asked once (12 questions become 9, no q2/q7 pair)", () => {
  const merged = mergeOpenQuestions(AMBIGUITIES, QUESTIONS);
  assert.equal(merged.length, 9);
  for (const dropped of ["Contact person's last name not provided", "Specific opening date not mentioned", "What the opening-day offer entails is unclear"]) {
    assert.equal(merged.includes(dropped), false, dropped);
  }
  const topics = merged.map((q) => topicOf(null, q)?.id).filter(Boolean);
  assert.equal(new Set(topics).size, topics.length, "no topic twice");
  // Questions the table does not know are all kept (NOT COVERED: brand colours and audience are still asked twice).
  assert.ok(merged.includes("Target audience details not mentioned") && merged.includes(QUESTIONS[4]!));
});

test("no overlap: nothing is dropped and the order is unchanged", () => {
  assert.deepEqual(mergeOpenQuestions(["Logo not provided"], ["What are your opening hours?"]), ["Logo not provided", "What are your opening hours?"]);
});
