/**
 * Harbor Street owner facts (job e6a71046, workflow.reopen 2026-10-15 09:16 UTC, read-only SQL). The q2, q3, q7 and q8 keys,
 * labels and values are copied exactly; so are the q4/q6 labels. Stand-ins (synthetic, so no real contact detail is
 * committed): the phone, the address and the contact name in q1/q9.
 */
export const HARBOR_STREET_FACTS = [
  { key: "phone", label: "Business phone number", value: "(555) 010-0142" },
  { key: "email", label: "Business email", value: "contact@example.com" },
  { key: "address", label: "Street address or suburb", value: "12 Example Lane (stand-in)" },
  { key: "hours", label: "Opening hours", value: "Mon to Fri 8am to 5pm, Sat 9am to 1pm." },
  { key: "q1", label: "Contact person's last name not provided", value: "Rivera" },
  { key: "q2", label: "Specific opening date not mentioned", value: "15 December 2026" },
  { key: "q3", label: "What the opening-day offer entails is unclear", value: "Main primary service at 20% off" },
  { key: "q4", label: "Design reference or inspiration materials not provided", value: "Use any inspiration from Modern, motion-rich, 3d websites" },
  { key: "q6", label: "Target audience details not mentioned", value: "Pakistanis and Americans" },
  { key: "q7", label: "What is the confirmed opening date for the second location?", value: "20 December 2026" },
  { key: "q8", label: "What exactly does the opening-day offer include?", value: "Our second flagship offer" },
  { key: "q9", label: "Who is the contact person (full name) for the page?", value: "Sam Rivera" },
];
