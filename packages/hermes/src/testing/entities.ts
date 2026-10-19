/**
 * Step 21 K: the entity list tests pass to intake and Hermes-lite, in place of a live read of public.entities.
 * SYNTHETIC copy of the two real rows (migration 0028); test-only, never used by a runtime path.
 */
import type { KnownEntity } from "../entities.js";

export const TEST_ENTITIES: readonly KnownEntity[] = Object.freeze([
  { slug: "bennett-co", aliases: ["bennett", "bennett & co", "bennett and co"] },
  { slug: "dreamsign", aliases: ["dreamsign"] },
]);
