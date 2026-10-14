/* Simple and Detailed (Cockpit v2, design system "Simple and Detailed"). One product, one set of screens; detail is a
   per-person setting. Simple: plain sentences, rounded durations, every Technical details drawer closed. Detailed:
   drawers open, ids with copy buttons, exact timings, check slugs beside their plain names. Money, missing details
   and placeholders show in both. Role decides what you may do; detail decides how much you see.
   Kept in this browser until per-person settings land with the Settings room (phase 13). */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Role } from "./model";

export type Detail = "simple" | "detailed";

const KEY = "cockpit-detail";

/** Team defaults by role (locked): owners Simple, admins Detailed, PMs Simple. */
export function defaultDetail(role: Role | null | undefined): Detail {
  return role === "admin" ? "detailed" : "simple";
}

export function readDetail(role?: Role | null): Detail {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "simple" || v === "detailed") return v;
  } catch {
    /* fall through to the role default */
  }
  return defaultDetail(role);
}

interface DetailValue {
  detail: Detail;
  detailed: boolean;
  setDetail: (d: Detail) => void;
  toggle: () => void;
}

const DetailContext = createContext<DetailValue>({ detail: "simple", detailed: false, setDetail: () => {}, toggle: () => {} });

export function DetailProvider({ role, initial, children }: { role?: Role | null; initial?: Detail; children: ReactNode }) {
  const [detail, set] = useState<Detail>(() => initial ?? readDetail(role));
  const setDetail = useCallback((d: Detail) => {
    set(d);
    try {
      localStorage.setItem(KEY, d);
    } catch {
      /* private mode: lasts for this visit */
    }
  }, []);
  const value = useMemo<DetailValue>(
    () => ({ detail, detailed: detail === "detailed", setDetail, toggle: () => setDetail(detail === "detailed" ? "simple" : "detailed") }),
    [detail, setDetail],
  );
  return <DetailContext.Provider value={value}>{children}</DetailContext.Provider>;
}

export const useDetail = () => useContext(DetailContext);
