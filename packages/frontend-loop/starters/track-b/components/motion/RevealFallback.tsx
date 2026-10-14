"use client";
/**
 * Section entrances where the browser has no CSS scroll-driven animation (track-b-starter 1.4.0). The entrances are CSS
 * (globals.css, `[data-reveal]` with `animation-timeline: view()`), so a browser that supports them runs no script at all.
 * Elsewhere this marks <html> and lets an IntersectionObserver add `.is-in` as each element arrives; the CSS turns that
 * into the same transform-only entrance. Nothing is hidden before this runs (no script = still, complete page), and
 * reduced motion skips it entirely.
 */
import { useEffect } from "react";
import { REDUCED_MOTION_QUERY } from "@/lib/motion";

export function RevealFallback() {
  useEffect(() => {
    if (typeof CSS !== "undefined" && CSS.supports("animation-timeline: view()")) return;
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches || typeof IntersectionObserver === "undefined") return;
    const root = document.documentElement;
    const items = [...document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-reveal='load'])")];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.01 },
    );
    // Anything already in view stays put; only what is still below the fold waits for its entrance.
    for (const el of items) if (el.getBoundingClientRect().top < innerHeight) el.classList.add("is-in");
    root.classList.add("reveal-io");
    for (const el of items) if (!el.classList.contains("is-in")) io.observe(el);
    return () => io.disconnect();
  }, []);
  return null;
}
