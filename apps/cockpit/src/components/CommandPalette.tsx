/* Command palette (Cockpit v2, screens section 15): ⌘K / Ctrl+K anywhere. One labelled search field; results
   grouped as Clients, Actions, Go to, Settings. Arrow keys move, Enter runs the selected (else first) match, Esc
   closes. A native modal <dialog>: the page behind is inert, focus returns to whatever opened it. */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { MagnifyingGlass, type Icon } from "@phosphor-icons/react";

export type PaletteGroup = "Clients" | "Actions" | "Go to" | "Settings";
const ORDER: PaletteGroup[] = ["Clients", "Actions", "Go to", "Settings"];

export interface PaletteItem {
  id: string;
  group: PaletteGroup;
  label: string;
  /** A short line on the right: the client's step, the shortcut, etc. */
  hint?: string;
  icon?: Icon;
  /** Extra words the search matches on. */
  keywords?: string;
  /** Always listed, whatever is typed (e.g. "Ask the factory a question", which takes the typed text as the question). */
  always?: boolean;
  run: (query: string) => void;
}

export function matchItems(items: PaletteItem[], q: string): PaletteItem[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hit = (i: PaletteItem) => {
    const hay = `${i.label} ${i.hint ?? ""} ${i.keywords ?? ""} ${i.group}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  };
  return ORDER.flatMap((g) => items.filter((i) => i.group === g && (!words.length || i.always || hit(i))));
}

export function CommandPalette({ open, onClose, items }: { open: boolean; onClose: () => void; items: PaletteItem[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<Element | null>(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const base = useId();
  const shown = useMemo(() => matchItems(items, q), [items, q]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      setQ("");
      setActive(0);
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
      input.current?.focus();
    } else if (!open && d.open) {
      if (typeof d.close === "function") d.close();
      else d.removeAttribute("open");
      (opener.current as HTMLElement | null)?.focus?.();
    }
  }, [open]);

  useEffect(() => setActive(0), [q]);

  function run(i: PaletteItem | undefined) {
    if (!i) return;
    onClose();
    i.run(q);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (shown.length ? (a + 1) % shown.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (shown.length ? (a - 1 + shown.length) % shown.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(shown[active] ?? shown[0]);
    }
  }

  const listId = `${base}-list`;
  const optId = (i: number) => `${base}-o${i}`;
  let n = -1;
  return (
    <dialog
      ref={ref}
      className="palette"
      aria-label="Search or run a command"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="palette-search">
        <MagnifyingGlass aria-hidden="true" />
        <input
          ref={input}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={shown.length ? optId(active) : undefined}
          aria-autocomplete="list"
          aria-label="Search clients, builds, actions and settings"
          placeholder="Search clients, builds, actions, settings"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
        />
        <kbd>Esc</kbd>
      </div>
      <div className="palette-results">
        {shown.length === 0 && <p className="palette-empty">Nothing matches “{q}”.</p>}
        <ul id={listId} role="listbox" aria-label="Results">
          {ORDER.map((g) => {
            const inGroup = shown.filter((i) => i.group === g);
            if (!inGroup.length) return null;
            return (
              <li key={g} role="presentation">
                <p className="palette-group" aria-hidden="true">
                  {g}
                </p>
                <ul role="group" aria-label={g}>
                  {inGroup.map((i) => {
                    n += 1;
                    const idx = n;
                    const I = i.icon;
                    return (
                      <li key={i.id} id={optId(idx)} role="option" aria-selected={idx === active} className={idx === active ? "active" : undefined} onMouseMove={() => setActive(idx)} onClick={() => run(i)}>
                        {I && <I aria-hidden="true" />}
                        <span className="palette-label">{i.label}</span>
                        {i.hint && <span className="palette-hint">{i.hint}</span>}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="palette-foot" aria-hidden="true">
        <span>↑ ↓ to move</span>
        <span>Enter to open</span>
        <span>? for all shortcuts</span>
      </div>
    </dialog>
  );
}
