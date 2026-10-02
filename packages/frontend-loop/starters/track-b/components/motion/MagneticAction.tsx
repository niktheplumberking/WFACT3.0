"use client";
/**
 * The primary action in the closing band leans toward the pointer and settles back, an acknowledgement
 * that the button is live before it is pressed. GSAP quickTo (already loaded for the scroll scenes, so
 * this adds no library); transform only. Off for touch, keyboard and reduced motion, where it is an
 * ordinary link.
 */
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import type { gsap } from "gsap";
import { MOTION_OK_QUERY, motionTokens } from "@/lib/motion";
import { withMotion } from "@/lib/gsap";

export function MagneticAction({ href, label }: { href: string; label: string }) {
  const wrap = useRef<HTMLSpanElement>(null);
  const to = useRef<{ x: gsap.QuickToFunc; y: gsap.QuickToFunc } | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    return withMotion(MOTION_OK_QUERY, ({ gsap }) => {
      const opts = { duration: motionTokens.duration.slow, ease: motionTokens.gsapEase.out };
      to.current = { x: gsap.quickTo(el, "x", opts), y: gsap.quickTo(el, "y", opts) };
      return () => {
        to.current = null;
      };
    });
  }, []);

  const move = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (!to.current || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    to.current.x((e.clientX - (r.left + r.width / 2)) * 0.22);
    to.current.y((e.clientY - (r.top + r.height / 2)) * 0.32);
  };
  const reset = () => {
    to.current?.x(0);
    to.current?.y(0);
  };

  return (
    <span ref={wrap} className="inline-block">
      <Link href={href} className="btn btn-on-deep btn-lg" onPointerMove={move} onPointerLeave={reset}>
        <span>{label}</span>
        <span className="btn-icon" aria-hidden="true">
          <ArrowUpRight size={20} strokeWidth={1.75} />
        </span>
      </Link>
    </span>
  );
}
