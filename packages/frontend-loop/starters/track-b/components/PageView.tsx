/**
 * One page: header, its sections in order, footer. Server component; the motion pieces inside are
 * client islands. Page metadata (title, description) comes from the content.
 */
import type { Metadata } from "next";
import { content, href, actionHref, pageBySlug, siteUrl, OG_IMAGE } from "@/lib/content";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { SectionView } from "./Sections";

/** Title, description and share tags. Canonical, og:url and og:image only once the live address is known. */
export function pageMetadata(slug: string): Metadata {
  const page = pageBySlug(slug);
  const url = href(slug);
  return {
    title: page.title,
    description: page.description,
    ...(siteUrl ? { alternates: { canonical: url } } : {}),
    openGraph: {
      type: "website",
      siteName: content.business.name,
      title: page.title,
      description: page.description,
      ...(siteUrl ? { url, images: [{ url: OG_IMAGE, width: 1200, height: 630 }] } : {}),
    },
    ...(siteUrl ? { twitter: { card: "summary_large_image" } } : {}),
  };
}

export function PageView({ slug }: { slug: string }) {
  const page = pageBySlug(slug);
  const items = content.pages.map((p) => ({ slug: p.slug, label: p.navLabel, href: href(p.slug) }));
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <SiteHeader name={content.business.name} items={items} current={slug} action={{ label: content.primaryAction.label, href: actionHref() }} />
      <main id="main" tabIndex={-1}>
        {page.sections.map((s, i) => (
          <SectionView key={s.id} section={s} first={i === 0} />
        ))}
      </main>
      <SiteFooter current={slug} />
    </>
  );
}
