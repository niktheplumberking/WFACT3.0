"use client";
/**
 * Selected work as a reel: on wide screens, with expressive motion allowed, the section pins and the
 * vertical scroll pans the projects past horizontally, one at a time (the scroll relationship is the
 * point: each project gets the whole stage). Everywhere else, including reduced motion and phones, the
 * same panels are a plain vertical stack. The server renders the stack, so nothing depends on scripts.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { MOTION_OK_QUERY, WIDE_QUERY, motionTokens } from "@/lib/motion";
import { withMotion } from "@/lib/gsap";

export function WorkReel({ children, pan }: { children: ReactNode; pan: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const w = wrap.current;
    const t = track.current;
    if (!pan || !w || !t) return;
    return withMotion(`${MOTION_OK_QUERY} and ${WIDE_QUERY}`, ({ gsap }) => {
      w.classList.add("is-panning");
      const distance = () => Math.max(0, t.scrollWidth - w.clientWidth);
      gsap.to(t, {
        x: () => -distance(),
        ease: motionTokens.gsapEase.none,
        scrollTrigger: { trigger: w, start: "top top", end: () => `+=${distance()}`, pin: true, scrub: 0.6, invalidateOnRefresh: true },
      });
      return () => w.classList.remove("is-panning");
    });
  }, [pan]);
  return (
    <div ref={wrap} className="reel">
      <div ref={track} className="reel-track">
        {children}
      </div>
    </div>
  );
}
