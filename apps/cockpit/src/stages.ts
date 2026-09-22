/** The 11-stage pipeline, exactly as constrained by packages/db/migrations/0001's check constraint
 * on public.projects.stage — kept in sync by hand since there's no shared-types package yet. */
export const STAGES = [
  "0_onboarding",
  "1_intake",
  "2_research_direction",
  "3_assets",
  "4_homepage_build",
  "5_direction_lock",
  "6_full_build_owners_key",
  "7_qa_security",
  "8_launch",
  "9_content_bank",
  "10_post_mortem",
] as const;

export type Stage = (typeof STAGES)[number];

export function nextStage(current: string): Stage | null {
  const i = STAGES.indexOf(current as Stage);
  if (i === -1 || i === STAGES.length - 1) return null;
  return STAGES[i + 1]!;
}
