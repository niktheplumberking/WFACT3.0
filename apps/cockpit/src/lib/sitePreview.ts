/**
 * Preview of a built multi-page site (Track A or Track B), whose checkpoint is a site.manifest.json listing every file.
 * Supabase Storage serves .html as text (so its shared domain can't host live pages), so the page's HTML is fetched
 * and shown in a sandboxed iframe (no same-origin: it can't read the Cockpit's session), and every file it refers to
 * (styles, fonts, scripts, the logo, images) is pointed at a short-lived signed link to that exact stored file.
 * Links between the site's pages are caught inside the frame and sent to the Cockpit, which switches page, so the
 * preview never navigates anywhere.
 */
import { supabase } from "../supabaseClient";

export interface PreviewManifest {
  pages: string[];
  files: { name: string }[];
}

/** The site's folder ("clients/x/sites/track-b") for its manifest path. */
export const siteBase = (manifestPath: string) => manifestPath.slice(0, manifestPath.lastIndexOf("/"));

/** A page file ("services/index.html", "services.html", "index.html") as a short plain label. */
export function pageLabel(file: string): string {
  const slug = file.replace(/\/index\.html$|\.html$/, "").replace(/^index$/, "");
  return slug === "" ? "Home" : slug.split(/[-_/]/).filter(Boolean).map((w) => w[0]!.toUpperCase() + w.slice(1)).join(" ");
}

/** Which page a link inside the site points at ("/services/", "services.html", "/" ...), or null for anything else. */
export function pageForHref(href: string, pages: string[]): string | null {
  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(href) || href.startsWith("#")) return null;
  let p = href.split(/[?#]/)[0]!.replace(/^\.?\//, "");
  if (p === "") p = "index.html";
  else if (p.endsWith("/")) p += "index.html";
  else if (!/\.[a-z0-9]+$/i.test(p)) p += "/index.html";
  return pages.includes(p) ? p : null;
}

/** Points every reference to a stored file at its signed link. Page links are left alone (the frame script catches them). */
export function rewriteRefs(html: string, urls: Map<string, string>): string {
  return html.replace(/(["'(=]\s*)((?:\.?\/)?[A-Za-z0-9_][A-Za-z0-9_./%-]*)/g, (m, lead: string, ref: string) => {
    let key = ref.replace(/^\.?\//, "");
    try {
      key = decodeURIComponent(key);
    } catch {
      return m;
    }
    const url = urls.get(key);
    return url ? `${lead}${url}` : m;
  });
}

/** Catches clicks on links inside the frame: a site page is shown by the Cockpit; anything else is not followed. */
const FRAME_SCRIPT = `<script>(function(){addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;if(!a)return;var h=a.getAttribute("href")||"";if(h.charAt(0)==="#")return;e.preventDefault();e.stopImmediatePropagation();parent.postMessage({wfactPreviewHref:h},"*");},true);addEventListener("submit",function(e){e.preventDefault();},true);})();</script>`;

/**
 * The site's own script files are left out: a Next.js runtime needs a real web address to load its code and, started
 * inside a preview frame, it fails and throws the page's styling away. The page as built (HTML, styles, fonts, images,
 * small inline scripts) is what the preview shows; motion plays on a real preview link.
 */
export function withoutScriptFiles(html: string): string {
  return html
    .replace(/<script\b[^>]*\bsrc\s*=[^>]*>\s*<\/script>/gi, "")
    .replace(/<link\b(?=[^>]*\brel\s*=\s*["']?(?:modulepreload|preload)\b)(?=[^>]*\bas\s*=\s*["']?script\b)[^>]*>/gi, "")
    .replace(/<link\b(?=[^>]*\brel\s*=\s*["']?modulepreload\b)[^>]*>/gi, "");
}

export function framePage(html: string, urls: Map<string, string>): string {
  const rewritten = rewriteRefs(withoutScriptFiles(html), urls);
  return /<head[^>]*>/i.test(rewritten) ? rewritten.replace(/<head[^>]*>/i, (h) => h + FRAME_SCRIPT) : FRAME_SCRIPT + rewritten;
}

export interface SitePreviewData {
  pages: string[];
  render: (page: string) => Promise<string>;
}

/** Loads the manifest and signs every non-page file once (links last an hour). */
export async function loadSitePreview(manifestPath: string): Promise<{ data: SitePreviewData | null; error: string | null }> {
  const bucket = supabase.storage.from("artifacts");
  const m = await bucket.download(manifestPath);
  if (m.error || !m.data) return { data: null, error: m.error?.message ?? "Could not load the site's file list." };
  let manifest: PreviewManifest;
  try {
    manifest = JSON.parse(await m.data.text()) as PreviewManifest;
  } catch {
    return { data: null, error: "The site's file list is not readable." };
  }
  if (!Array.isArray(manifest.pages) || manifest.pages.length === 0 || !Array.isArray(manifest.files)) {
    return { data: null, error: "The site's file list has no pages." };
  }
  const base = siteBase(manifestPath);
  const assets = manifest.files.map((f) => f.name).filter((n) => !/\.html$/i.test(n) && !n.startsWith("_source/"));
  const urls = new Map<string, string>();
  if (assets.length > 0) {
    const signed = await bucket.createSignedUrls(assets.map((n) => `${base}/${n}`), 3600);
    if (signed.error) return { data: null, error: signed.error.message };
    (signed.data ?? []).forEach((s, i) => {
      if (s.signedUrl) urls.set(assets[i]!, s.signedUrl);
    });
  }
  const cache = new Map<string, string>();
  return {
    error: null,
    data: {
      pages: manifest.pages,
      render: async (page) => {
        const hit = cache.get(page);
        if (hit) return hit;
        const res = await bucket.download(`${base}/${page}`);
        if (res.error || !res.data) throw new Error(res.error?.message ?? `Could not load ${page}.`);
        const html = framePage(await res.data.text(), urls);
        cache.set(page, html);
        return html;
      },
    },
  };
}
