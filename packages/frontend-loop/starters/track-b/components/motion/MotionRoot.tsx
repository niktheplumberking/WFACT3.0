"use client";
/**
 * Smooth scrolling and the scroll clock for every ScrollTrigger on the page. Lenis runs only when the
 * brand asked for expressive motion and the visitor has not asked for reduced motion; it is torn down the
 * moment the preference changes. Lenis and GSAP load after the page is up (see lib/gsap.ts). Without
 * Lenis, ScrollTrigger reads the native scroll.
 */
import { useEffect } from "react";
import { REDUCED_MOTION_QUERY } from "@/lib/motion";
import { loadMotionKit } from "@/lib/gsap";

export function MotionRoot({ smooth }: { smooth: boolean }) {
  useEffect(() => {
    if (!smooth) return;
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    let cancelled = false;
    let stop = () => {};
    let start = () => {};

    void Promise.all([import("lenis"), loadMotionKit()]).then(([{ default: Lenis }, { gsap, ScrollTrigger }]) => {
      if (cancelled) return;
      let lenis: InstanceType<typeof Lenis> | null = null;
      const tick = (time: number) => lenis?.raf(time * 1000);
      start = () => {
        if (lenis || query.matches) return;
        lenis = new Lenis({ lerp: 0.12, wheelMultiplier: 1, anchors: true });
        lenis.on("scroll", ScrollTrigger.update);
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);
      };
      stop = () => {
        gsap.ticker.remove(tick);
        lenis?.destroy();
        lenis = null;
      };
      start();
    });
    const onChange = () => (query.matches ? stop() : start());
    query.addEventListener("change", onChange);
    return () => {
      cancelled = true;
      query.removeEventListener("change", onChange);
      stop();
    };
  }, [smooth]);

  return null;
}
