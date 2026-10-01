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

/** Plain names for people (Step 4C copy guide): the slug never appears as a main label. */
export const STAGE_LABEL: Record<Stage, string> = {
  "0_onboarding": "Onboarding",
  "1_intake": "Intake",
  "2_research_direction": "Research and direction",
  "3_assets": "Assets",
  "4_homepage_build": "Homepage build",
  "5_direction_lock": "Direction lock",
  "6_full_build_owners_key": "Full build",
  "7_qa_security": "QA and security",
  "8_launch": "Launch",
  "9_content_bank": "Content bank",
  "10_post_mortem": "Review",
};

/** Short labels for the route line, where 11 names share one row. */
export const STAGE_SHORT: Record<Stage, string> = {
  "0_onboarding": "Onboard",
  "1_intake": "Intake",
  "2_research_direction": "Direction",
  "3_assets": "Assets",
  "4_homepage_build": "Homepage",
  "5_direction_lock": "Direction lock",
  "6_full_build_owners_key": "Full build",
  "7_qa_security": "QA",
  "8_launch": "Launch",
  "9_content_bank": "Content",
  "10_post_mortem": "Review",
};

/** Human gates drawn as signals on the route line (Playbook §7 human moments). */
export const GATE_STAGES: readonly Stage[] = ["5_direction_lock", "8_launch"];

/**
 * Step 4C decision D3: the Cockpit never moves a project INTO Launch. Launch is Nick's decision and is
 * recorded outside the Cockpit until a proper Launch gate exists (CLAUDE.md §3); the stage move would
 * only invite the belief that something was published.
 */
export const LAUNCH_STAGE: Stage = "8_launch";

export function stageIndex(stage: string): number {
  return STAGES.indexOf(stage as Stage);
}

export function stageLabel(stage: string): string {
  return STAGE_LABEL[stage as Stage] ?? stage;
}

export function nextStage(current: string): Stage | null {
  const i = STAGES.indexOf(current as Stage);
  if (i === -1 || i === STAGES.length - 1) return null;
  return STAGES[i + 1]!;
}

/** Whether the Cockpit may offer the move to the next stage; null when it may, else the reason why not. */
export function stageMoveBlock(current: string): string | null {
  const next = nextStage(current);
  if (!next) return "This is the last stage.";
  if (next === LAUNCH_STAGE) return "Launch is Nick's decision and is recorded outside the Cockpit. Nothing here publishes a site.";
  return null;
}
