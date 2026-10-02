/**
 * Motion tokens for the Track B starter. Every duration, easing and distance used by the motion
 * components comes from here (no inline numbers), so the motion budget checked by rendered QA
 * (render.motion-budget) has one place to read from.
 *
 * Rules the components follow (Step 4B M4, the impeccable / motion-foundations skills):
 *   - Content is visible in the server-rendered HTML; motion only runs after hydration, so a failed
 *     script never hides the page and the hero text is the LCP element from the first paint.
 *   - Only transform and opacity are animated. Never width, height, top, left, margins or padding.
 *   - prefers-reduced-motion: reduce turns off every spatial animation, the smooth scroll and the pinned
 *     sequences; state changes stay (instant or opacity-only, at most 0.2 s).
 */
export const motionTokens = {
  duration: { instant: 0.08, fast: 0.18, normal: 0.35, slow: 0.6, focal: 0.8 },
  easing: {
    /** Confident arrival: exponential ease-out. */
    out: [0.16, 1, 0.3, 1] as [number, number, number, number],
    sharp: [0.4, 0, 0.2, 1] as [number, number, number, number],
  },
  gsapEase: { out: "expo.out", none: "none" },
  distance: { sm: 8, md: 16, lg: 24 },
  stagger: { list: 0.06 },
} as const;

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
export const MOTION_OK_QUERY = "(prefers-reduced-motion: no-preference)";
/** Wide enough for pinned, horizontally panned sequences; below it every sequence is a vertical stack. */
export const WIDE_QUERY = "(min-width: 960px)";
