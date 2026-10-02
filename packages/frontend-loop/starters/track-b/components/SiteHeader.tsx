"use client";
/**
 * Header: the business name, the pages and the one primary action on one line from 960px; below that a
 * Menu button opens a full-screen panel. The panel is a native modal <dialog> (focus moves in, the page
 * behind is inert, Escape closes it, focus returns to the button), so no dialog library ships to the
 * visitor; its links arrive in a short CSS stagger that reduced motion turns off. The current page is
 * marked with aria-current.
 */
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Menu, X } from "lucide-react";

export interface NavItem {
  slug: string;
  label: string;
  href: string;
}

export function SiteHeader({ name, items, current, action }: { name: string; items: NavItem[]; current: string; action: { label: string; href: string } }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const restore = () => trigger.current?.focus();
    d.addEventListener("close", restore);
    return () => d.removeEventListener("close", restore);
  }, []);

  const close = () => dialog.current?.close();

  return (
    <header className="site-header">
      <div className="container header-row">
        <Link href="/" className="wordmark" aria-current={current === "index" ? "page" : undefined}>
          {name}
        </Link>
        <nav aria-label="Main" className="nav-desktop">
          <ul>
            {items
              .filter((i) => i.slug !== "index")
              .map((i) => (
                <li key={i.slug}>
                  <Link href={i.href} className="nav-link" aria-current={current === i.slug ? "page" : undefined}>
                    {i.label}
                  </Link>
                </li>
              ))}
          </ul>
          <Link href={action.href} className="btn btn-accent btn-sm">
            {action.label}
          </Link>
        </nav>
        <button ref={trigger} type="button" className="menu-button" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
          <Menu size={20} strokeWidth={1.75} aria-hidden="true" />
          <span>Menu</span>
        </button>
      </div>
      <dialog ref={dialog} className="menu-panel" aria-label={`${name} menu`} data-lenis-prevent="">
        <div className="container header-row">
          <p className="wordmark">{name}</p>
          <button type="button" className="menu-button" onClick={close} autoFocus>
            <X size={20} strokeWidth={1.75} aria-hidden="true" />
            <span>Close</span>
          </button>
        </div>
        <nav aria-label="Main" className="container menu-nav">
          <ul>
            {items.map((item, i) => (
              <li key={item.slug} style={{ "--i": i } as React.CSSProperties}>
                <Link href={item.href} className="menu-link" aria-current={current === item.slug ? "page" : undefined} onClick={close}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div style={{ "--i": items.length } as React.CSSProperties}>
            <Link href={action.href} className="btn btn-accent" onClick={close}>
              {action.label}
            </Link>
          </div>
        </nav>
      </dialog>
    </header>
  );
}
