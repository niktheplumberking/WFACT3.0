"use client";
/**
 * The process timeline's spine: a rule that fills from the first step to the last as the reader
 * scrolls through them, so "where am I in the process" is visible. scaleY only. Without motion the
 * spine is simply drawn in full.
 */
import { useEffect, useRef } from "react";
import { MOTION_OK_QUERY, motionTokens } from "@/lib/motion";
import { withMotion } from "@/lib/gsap";

export function ProgressRule() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return withMotion(MOTION_OK_QUERY, ({ gsap }) => {
      gsap.fromTo(
        el,
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: motionTokens.gsapEase.none,
          scrollTrigger: { trigger: el.parentElement, start: "top 70%", end: "bottom 60%", scrub: true },
        },
      );
    });
  }, []);
  return <span ref={ref} aria-hidden="true" className="progress-rule" />;
}
