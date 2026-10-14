// SVG logo policy (2026-10-14). An uploaded logo is served from the client's own domain, so a file opened directly must
// not be able to run code or load anything from anywhere. This is an ALLOW list: only plain drawing elements, every
// link points inside the file (#id), and anything encoded (character references, CSS escapes, data: URLs) is refused
// rather than decoded. A ban list was bypassed in review (`<x:script>`, `&#104;ttps:`, `@\69mport`).
//
// Kept byte-identical in apps/cockpit/src/lib/svgPolicy.ts (the browser check); a frontend-loop test fails if they differ.
// No imports, so both the Node build and the browser can use it.

const ALLOWED_ELEMENTS = new Set([
  "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "tspan", "textpath",
  "title", "desc", "metadata", "defs", "symbol", "use", "lineargradient", "radialgradient", "stop", "clippath", "mask",
  "pattern", "marker", "style", "filter", "fegaussianblur", "feoffset", "feblend", "fecolormatrix", "fecomposite",
  "feflood", "femerge", "femergenode", "femorphology", "fedropshadow",
]);

/** Returns why the SVG text is refused, or null when it is a plain, self-contained drawing. */
export function svgProblem(text: string): string | null {
  const lower = text.toLowerCase();
  if (/<!doctype|<!entity|<!\[cdata\[|<\?xml-stylesheet/.test(lower)) return "a DOCTYPE, entity, CDATA or stylesheet declaration";
  if (/&#|&[a-z][a-z0-9]*;/.test(lower.replace(/&(amp|lt|gt|quot|apos);/g, ""))) return "encoded characters (character or entity references)";
  if (lower.includes("\\")) return "escaped characters (backslashes)";
  if (/data:/.test(lower)) return "an embedded data: URL";
  if (/javascript:|vbscript:/.test(lower)) return "a script link";
  if (/@import/.test(lower)) return "a style import";
  if (/[\s"'/]on[a-z]+\s*=/.test(lower)) return "an event handler attribute";
  for (const m of lower.matchAll(/<\/?\s*([^\s>/!?]+)/g)) {
    const name = m[1]!;
    if (name.includes(":")) return `a namespaced element <${name}>`;
    if (!ALLOWED_ELEMENTS.has(name)) return `an element that is not allowed in a logo (<${name}>)`;
  }
  for (const m of lower.matchAll(/(?:^|[\s"'])(?:xlink:)?href\s*=\s*(["'])([^"']*)\1/g)) {
    if (!m[2]!.trim().startsWith("#")) return "a link to something outside the file";
  }
  for (const m of lower.matchAll(/url\(\s*(["']?)\s*([^)"']*)/g)) {
    if (!m[2]!.trim().startsWith("#")) return "a style reference to something outside the file";
  }
  if (/(?:^|[\s"'])(src|action|formaction)\s*=/.test(lower)) return "a link to something outside the file";
  return null;
}
