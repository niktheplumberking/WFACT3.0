# Direction step evaluation (Step 4B M2)

Run 2026-10-01T13:36:24.932Z by `npm run eval-direction`: 14 labelled SYNTHETIC cases (cases v1.0.0, taxonomy v1.0.0),
Intake `claude-haiku-4-5` + Direction `claude-sonnet-5`, live, no database writes. Labels were written before the first run.

**Track recommendation: 14/14 strict, 14/14 lenient. Niche: 13/14. Total cost $0.2821.**

| Case | Expected | Got | Strict | Lenient | Confidence | Niche (expected → got) | Withheld because | Dropped points | Cost |
|---|---|---|---|---|---|---|---|---|---|
| plumber-emergency | A | A | yes | yes | 0.90 | local-trade → local-trade |  | 0 | $0.0176 |
| dental-booking | A | A | yes | yes | 0.85 | local-health → local-health |  | 0 | $0.0202 |
| restaurant-reservations | A | A | yes | yes | 0.85 | hospitality → hospitality |  | 0 | $0.0161 |
| accountants | A | A | yes | yes | 0.80 | professional-services → professional-services |  | 0 | $0.0190 |
| sneaker-launch | B | B | yes | yes | 0.90 | brand-product → brand-product |  | 0 | $0.0233 |
| architecture-photographer | B | B | yes | yes | 0.85 | creative-portfolio → creative-portfolio |  | 0 | $0.0208 |
| saas-launch | B | B | yes | yes | 0.90 | brand-product → brand-product |  | 0 | $0.0194 |
| summit-line-roofing | A | A | yes | yes | 0.85 | local-trade → local-trade |  | 0 | $0.0253 |
| boutique-hotel-cinematic | B (also none) | B | yes | yes | 0.85 | hospitality → hospitality |  | 0 | $0.0206 |
| vague-business | none | none | yes | yes | 0.05 | other → other | the agent could not choose a track from this request | 0 | $0.0168 |
| wedding-photographer-enquiries | none (also A/B) | none | yes | yes | 0.72 | creative-portfolio → creative-portfolio | conflicting signals: Creative portfolio usually fits Track B, the agent leaned to Track A at confidence 0.72 | 0 | $0.0231 |
| electrician-injection | A | A | yes | yes | 0.85 | local-trade → local-trade |  | 0 | $0.0155 |
| design-agency-awards | B (also none) | B | yes | yes | 0.90 | professional-services → creative-portfolio **(miss)** |  | 0 | $0.0173 |
| yoga-studio | A | A | yes | yes | 0.88 | local-health → local-health |  | 0 | $0.0271 |

Every miss is listed above; nothing is averaged away. Intake status per case is in results.json (entity ambiguity is expected for
requests that name no WFACT entity; the direction step was still run on Intake's output so it could be scored).
