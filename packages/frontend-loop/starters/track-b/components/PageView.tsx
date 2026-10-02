/**
 * One page: header, its sections in order, footer. Server component; the motion pieces inside are
 * client islands. Page metadata (title, description) comes from the content.
 */
import type { Metadata } from "next";
import { content, href, actionHref, pageBySlug } from "@/lib/content";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { SectionView } from "./Sections";

export function pageMetadata(slug: string): Metadata {
  const page = pageBySlug(slug);
  return { title: page.title, description: page.description };
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
