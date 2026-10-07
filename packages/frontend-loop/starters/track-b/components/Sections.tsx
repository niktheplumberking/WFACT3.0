/**
 * Every section type the builder can choose, rendered by reviewed code. Each type has its own layout
 * family so a page never repeats one rhythm (DR-REPEATED-RHYTHM), and each carries at most one motion
 * idea, chosen for what it explains:
 *
 *   hero       kinetic headline (CSS, from the first paint) that drifts away as the page takes over
 *   statement  one passage lit word by word as it is read (scroll-paced)
 *   work       a pinned horizontal reel on wide screens; a vertical stack otherwise
 *   services   sticky heading beside a long list (CSS only)
 *   process    a rule that fills through the steps (scroll progress)
 *   quote      one featured quote, still
 *   faq        disclosure rows (native <details>), still
 *   contact    the enquiry form beside the contact facts, still
 *   prose      reading column with an aside, still
 *   cta        the closing band; the action leans toward the pointer
 *
 * Anything that is SAMPLE content (fictional work, quotes, contact details) carries a visible SAMPLE
 * label where it appears.
 */
import { ArrowUpRight, Plus } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { actionHref, content, type Fact, type Section } from "@/lib/content";
import { ContactForm } from "./ContactForm";
import { MagneticAction } from "./motion/MagneticAction";
import { ProgressRule } from "./motion/ProgressRule";
import { ScrollDrift } from "./motion/ScrollDrift";
import { ScrollReading } from "./motion/ScrollReading";
import { WorkReel } from "./motion/WorkReel";

export const Sample = ({ text = "SAMPLE" }: { text?: string }) => <span className="sample">{text}</span>;

const telHref = (v: string) => `tel:${v.replace(/[^\d+]/g, "")}`;

export function FactLine({ fact, kind }: { fact: Fact; kind: "email" | "phone" | "text" }) {
  const value =
    kind === "email" ? <a href={`mailto:${fact.value}`}>{fact.value}</a> : kind === "phone" ? <a href={telHref(fact.value)}>{fact.value}</a> : fact.value;
  return (
    <>
      {value}
      {fact.source === "sample" && (
        <>
          {" "}
          <Sample />
        </>
      )}
    </>
  );
}

function ActionLink({ className = "btn btn-accent" }: { className?: string }) {
  return (
    <Link href={actionHref()} className={className}>
      <span>{content.primaryAction.label}</span>
      <span className="btn-icon" aria-hidden="true">
        <ArrowUpRight size={18} strokeWidth={1.75} />
      </span>
    </Link>
  );
}

const TONES = ["tone-deep", "tone-accent", "tone-surface", "tone-panel"] as const;

export function SectionView({ section, first }: { section: Section; first: boolean }) {
  const s = section;
  switch (s.type) {
    case "hero": {
      const words = s.heading.split(/\s+/).filter(Boolean);
      return (
        <section id={s.id} className="hero">
          <div className="container hero-grid">
            <ScrollDrift className="hero-heading-wrap">
              <h1 className="display hero-heading">
                {words.map((w, i) => (
                  <Fragment key={i}>
                    <span className="rise" style={{ "--i": i } as React.CSSProperties}>
                      {w}
                    </span>
                    {i < words.length - 1 ? " " : null}
                  </Fragment>
                ))}
              </h1>
            </ScrollDrift>
            <div className="hero-aside">
              <p className="lede">{s.intro}</p>
              {s.showAction && <ActionLink />}
            </div>
            <span className="hero-rule" aria-hidden="true" />
          </div>
        </section>
      );
    }
    case "statement":
      return (
        <section id={s.id} className="statement" aria-labelledby={`${s.id}-label`}>
          <div className="container">
            <h2 id={`${s.id}-label`} className="sr-only">
              {s.label}
            </h2>
            <ScrollReading text={s.text} className="statement-text" />
          </div>
        </section>
      );
    case "work":
      return (
        <section id={s.id} className="work">
          <div className="container work-head">
            <h2 className="h2">{s.heading}</h2>
            {s.intro && <p className="body-lg muted">{s.intro}</p>}
          </div>
          <WorkReel pan={content.brand.motion === "expressive"}>
            {s.items.map((item, i) => (
              <article key={item.title} className={`reel-panel ${TONES[i % TONES.length]}`}>
                <div className="panel-top">
                  <p className="panel-client">{item.client}</p>
                  {item.source === "sample" && <Sample text="SAMPLE project, not real client work" />}
                </div>
                <h3 className="panel-title">{item.title}</h3>
                <div className="panel-foot">
                  <p className="panel-summary">{item.summary}</p>
                  <ul className="panel-tags" aria-label="Disciplines">
                    {item.disciplines.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </WorkReel>
        </section>
      );
    case "services":
      return (
        <section id={s.id} className="services">
          <div className="container services-grid">
            <div className="services-head">
              <h2 className="h2">{s.heading}</h2>
              {s.intro && <p className="body-lg muted">{s.intro}</p>}
            </div>
            <ul className="services-list">
              {s.items.map((it) => (
                <li key={it.name} className="service">
                  <h3 className="h3">{it.name}</h3>
                  <p>{it.summary}</p>
                  {it.details.length > 0 && <p className="service-details">{it.details.join(" / ")}</p>}
                </li>
              ))}
            </ul>
          </div>
        </section>
      );
    case "process":
      return (
        <section id={s.id} className="process">
          <div className="container process-grid">
            <div className="process-head">
              <h2 className="h2">{s.heading}</h2>
              {s.intro && <p className="body-lg muted">{s.intro}</p>}
            </div>
            <ol className="steps">
              <ProgressRule />
              {s.steps.map((st, i) => (
                <li key={st.title} className="step">
                  <span className="step-num" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="h3">{st.title}</h3>
                  <p>{st.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      );
    case "quote": {
      const [lead, ...rest] = s.quotes;
      const label = "SAMPLE - replace with real client feedback";
      return (
        <section id={s.id} className="quotes">
          <div className="container quotes-grid">
            <h2 className="h2 quotes-heading">{s.heading}</h2>
            <figure className="quote quote-lead">
              <blockquote>
                <p>{lead!.text}</p>
              </blockquote>
              <figcaption>
                {lead!.attribution}
                {lead!.source === "sample" && (
                  <>
                    {" "}
                    <Sample text={label} />
                  </>
                )}
              </figcaption>
            </figure>
            {rest.length > 0 && (
              <div className="quotes-rest">
                {rest.map((q) => (
                  <figure key={q.text} className="quote">
                    <blockquote>
                      <p>{q.text}</p>
                    </blockquote>
                    <figcaption>
                      {q.attribution}
                      {q.source === "sample" && (
                        <>
                          {" "}
                          <Sample text={label} />
                        </>
                      )}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        </section>
      );
    }
    case "faq":
      return (
        <section id={s.id} className="faq">
          <div className="container faq-grid">
            <h2 className="h2">{s.heading}</h2>
            <div className="faq-list">
              {s.items.map((it) => (
                <details key={it.q} className="faq-item">
                  <summary>
                    <span>{it.q}</span>
                    <Plus className="faq-icon" size={20} strokeWidth={1.75} aria-hidden="true" />
                  </summary>
                  <p>{it.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      );
    case "contact": {
      const b = content.business;
      const fallback = b.email ? `Please email ${b.email.value} instead.` : "Please get in touch another way.";
      return (
        <section id={s.id} className="contact">
          <div className="container contact-grid">
            <div className="contact-head">
              {first ? <h1 className="h2">{s.heading}</h1> : <h2 className="h2">{s.heading}</h2>}
              <p className="body-lg">{s.intro}</p>
              {s.showDetails && (
                <dl className="facts">
                  {b.email && (
                    <div>
                      <dt>Email</dt>
                      <dd>
                        <FactLine fact={b.email} kind="email" />
                      </dd>
                    </div>
                  )}
                  {b.phone && (
                    <div>
                      <dt>Phone</dt>
                      <dd>
                        <FactLine fact={b.phone} kind="phone" />
                      </dd>
                    </div>
                  )}
                  {b.location && (
                    <div>
                      <dt>Location</dt>
                      <dd>
                        <FactLine fact={b.location} kind="text" />
                      </dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
            <ContactForm variant={s.form ?? "enquiry"} actionLabel={content.primaryAction.label} note={s.formNote} fallback={fallback} />
          </div>
        </section>
      );
    }
    case "prose":
      return (
        <section id={s.id} className="prose">
          <div className="container prose-grid">
            {first ? <h1 className="display prose-heading">{s.heading}</h1> : <h2 className="h2 prose-heading">{s.heading}</h2>}
            <div className="prose-body">
              {s.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            {s.aside && (
              <aside className="prose-aside">
                <h3 className="h4">{s.aside.heading}</h3>
                <p>{s.aside.text}</p>
              </aside>
            )}
          </div>
        </section>
      );
    case "cta":
      return (
        <section id={s.id} className="cta">
          <div className="container cta-grid">
            <h2 className="display cta-heading">{s.heading}</h2>
            <div className="cta-aside">
              <p className="body-lg">{s.text}</p>
              <MagneticAction href={actionHref()} label={content.primaryAction.label} />
            </div>
          </div>
        </section>
      );
  }
}
