"use client";
/**
 * GSAP and ScrollTrigger, loaded after the page is up rather than with it. Every piece of motion is an
 * enhancement of content that is already visible in the server HTML, so the motion library does not need
 * to sit in the critical path; keeping it out is what holds mobile LCP inside the Track B budget (Step 4B
 * M4: about 115 KB of script moved off the first paint). One shared import for every component.
 */
import type { gsap as Gsap } from "gsap";
import type { ScrollTrigger as ScrollTriggerType } from "gsap/ScrollTrigger";

export interface MotionKit {
  gsap: typeof Gsap;
  ScrollTrigger: typeof ScrollTriggerType;
}

let kit: Promise<MotionKit> | null = null;

export function loadMotionKit(): Promise<MotionKit> {
  kit ??= Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([g, st]) => {
    g.gsap.registerPlugin(st.ScrollTrigger);
    return { gsap: g.gsap, ScrollTrigger: st.ScrollTrigger };
  });
  return kit;
}

/**
 * Runs `setup` once GSAP is loaded, inside a gsap.matchMedia() scope so every tween and ScrollTrigger it
 * creates is reverted on unmount (and when a media condition stops matching). Returns the cleanup.
 */
export function withMotion(conditions: string, setup: (k: MotionKit) => void | (() => void)): () => void {
  let cancelled = false;
  let revert: (() => void) | null = null;
  void loadMotionKit().then((k) => {
    if (cancelled) return;
    const mm = k.gsap.matchMedia();
    mm.add(conditions, () => setup(k));
    revert = () => mm.revert();
  });
  return () => {
    cancelled = true;
    revert?.();
  };
}
