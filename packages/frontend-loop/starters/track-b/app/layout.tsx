/**
 * The document shell. Colour tokens from content/theme.json become CSS custom properties on <html>, so
 * every component reads the same palette; the chosen type pairing provides --font-display and
 * --font-text. JSON-LD carries only facts the brief supplied (never SAMPLE placeholders).
 */
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { content, palette } from "@/lib/content";
import { displayFace, textFace } from "@/lib/type.generated";
import { MotionRoot } from "@/components/motion/MotionRoot";

export const metadata: Metadata = {
  title: { default: content.business.name, template: `%s | ${content.business.name}` },
};

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};
/** The brand decides the theme (one theme per site): a dark paper means a dark page. */
const scheme = lum(palette.paper) < 0.5 ? "dark" : "light";

export const viewport: Viewport = { themeColor: palette.paper, colorScheme: scheme };

const vars = {
  "--ink": palette.ink,
  "--paper": palette.paper,
  "--accent": palette.accent,
  "--accent-ink": palette.accentInk,
  "--on-accent": palette.onAccent,
  "--deep": palette.deep,
  "--on-deep": palette.onDeep,
  "--muted": palette.muted,
  "--surface": palette.surface,
  "--deep-panel": palette.deepPanel,
  "--dim": palette.dim,
} as React.CSSProperties;

function jsonLd() {
  const b = content.business;
  const data: Record<string, string> = { "@context": "https://schema.org", "@type": "Organization", name: b.name };
  if (b.email?.source === "brief") data.email = b.email.value;
  if (b.phone?.source === "brief") data.telephone = b.phone.value;
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={vars} className={`${displayFace.variable} ${textFace.variable}`} data-motion={content.brand.motion} data-pairing={content.brand.typePairing} data-scheme={scheme}>
      <body>
        {children}
        <MotionRoot smooth={content.brand.motion === "expressive"} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd() }} />
      </body>
    </html>
  );
}
