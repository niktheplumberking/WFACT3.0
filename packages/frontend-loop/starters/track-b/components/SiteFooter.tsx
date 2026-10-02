/**
 * Footer: the name set large as the page's last word, the pages, the contact facts (SAMPLE-labelled
 * where they are placeholders) and, when the site holds any sample content, one plain line saying so.
 */
import Link from "next/link";
import { content, href } from "@/lib/content";
import { FactLine } from "./Sections";

export function SiteFooter({ current }: { current: string }) {
  const b = content.business;
  const hasSample =
    [b.email, b.phone, b.location].some((f) => f?.source === "sample") ||
    content.pages.some((p) =>
      p.sections.some((s) => (s.type === "work" && s.items.some((i) => i.source === "sample")) || (s.type === "quote" && s.quotes.some((q) => q.source === "sample"))),
    );
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <p className="footer-name" aria-hidden="true">
          {b.name}
        </p>
        <div className="footer-cols">
          <nav aria-label="Footer">
            <ul>
              {content.pages.map((p) => (
                <li key={p.slug}>
                  <Link href={href(p.slug)} aria-current={current === p.slug ? "page" : undefined}>
                    {p.navLabel}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <ul className="footer-facts">
            {b.tagline && <li>{b.tagline}</li>}
            {b.email && (
              <li>
                <FactLine fact={b.email} kind="email" />
              </li>
            )}
            {b.phone && (
              <li>
                <FactLine fact={b.phone} kind="phone" />
              </li>
            )}
            {b.location && (
              <li>
                <FactLine fact={b.location} kind="text" />
              </li>
            )}
          </ul>
        </div>
        {hasSample && <p className="footer-note">Items marked SAMPLE are placeholders until the real ones are supplied.</p>}
      </div>
    </footer>
  );
}
