"use client";
/**
 * The statement is read with the scroll: words start dim and light up in reading order as the passage
 * moves through the viewport, so the visitor's own scrolling paces the sentence. Server HTML has every
 * word at full strength; the dimming is applied only when motion is allowed. "Dim" is a colour, not an
 * opacity: the palette's `dim` still reaches 4.5:1 on the paper, so every word is readable throughout.
 */
import { useEffect, useRef } from "react";
import { MOTION_OK_QUERY, motionTokens } from "@/lib/motion";
import { withMotion } from "@/lib/gsap";

export function ScrollReading({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return withMotion(MOTION_OK_QUERY, ({ gsap }) => {
      const words = el.querySelectorAll<HTMLElement>("[data-word]");
      const css = getComputedStyle(document.documentElement);
      gsap.fromTo(
        words,
        { color: css.getPropertyValue("--dim").trim() },
        {
          color: css.getPropertyValue("--ink").trim(),
          ease: motionTokens.gsapEase.none,
          stagger: 0.08,
          scrollTrigger: { trigger: el, start: "top 80%", end: "bottom 45%", scrub: true },
        },
      );
    });
  }, []);
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <p ref={ref} className={className}>
      {words.map((w, i) => (
        <span key={i} data-word="">
          {w}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </p>
  );
}
