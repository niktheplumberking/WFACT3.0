/**
 * Pictures still needed from the client (Build-quality Package 3): the media slots of a passing build that still show an
 * "Image to come" card. The rows, uploads and the "launch with placeholders" tick live in components/SiteReview.tsx
 * (usePlaceholderPictures); the needs screen reads the same slots.
 */
import type { JobRow } from "../jobsClient";

export interface PlaceholderSlot {
  slot: string;
  page: string;
  section: string;
  note: string;
}

export function placeholdersOf(job: JobRow): PlaceholderSlot[] {
  const raw = job.result?.placeholders;
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is PlaceholderSlot => !!p && typeof p === "object" && typeof (p as PlaceholderSlot).slot === "string" && typeof (p as PlaceholderSlot).note === "string");
}
