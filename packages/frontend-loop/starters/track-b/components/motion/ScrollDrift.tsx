"use client";
/**
 * The hero's exit: as the hero scrolls away, its headline drifts up a little slower than the page and
 * softens, so the next section visibly takes over. Scroll-linked (scrubbed), transform + opacity only.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { MOTION_OK_QUERY, motionTokens } from "@/lib/motion";
import { withMotion } from "@/lib/gsap";

export function ScrollDrift({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return withMotion(MOTION_OK_QUERY, ({ gsap }) => {
      gsap.to(el, {
        yPercent: -18,
        opacity: 0.35,
        ease: motionTokens.gsapEase.none,
        scrollTrigger: { trigger: el.closest("section") ?? el, start: "top top", end: "bottom top", scrub: true },
      });
    });
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
