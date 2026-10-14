/**
 * The client's own logo when the owner supplied one (track-b-starter 1.3.0), else the text wordmark. The file
 * is the owner's verified upload, written to public/ by the build; the builder model never draws a logo. On a
 * dark page the logo sits on a light chip, so a dark logo stays visible.
 */
import { logo } from "@/lib/content";

export function BrandMark({ name, footer = false }: { name: string; footer?: boolean }) {
  if (!logo) return footer ? null : <>{name}</>;
  // A plain <img>: a static export has no image server, and the intrinsic size is reserved.
  // eslint-disable-next-line @next/next/no-img-element
  // Explicit display size (track-b-starter 1.4.0): CSS width/height auto let an SVG with only a viewBox collapse to 0x0.
  const img = (
    <img className="brand-logo" src={logo.src} alt={name} width={logo.width} height={logo.height} style={{ width: logo.width, height: logo.height }} decoding="async" />
  );
  return footer ? <p className="brand-logo-footer">{img}</p> : img;
}
