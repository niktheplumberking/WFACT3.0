"use client";
/**
 * The contact form, in one of two shapes the content chooses: "enquiry" (a project enquiry: name, email,
 * organisation, what they are planning, timing) or "signup" (email updates only: email, and a first name
 * that is optional, Cockpit job 6f68adbd: an email signup must not ask for a project brief). Labels above fields,
 * errors below and announced, no placeholder-as-label.
 *
 * Connected (Step 25 / MVP M4; `lead` comes from launch.json, written by the build, never the builder): the form posts to
 * the submit-lead endpoint with the site key, the page, how long the form was open and a hidden honeypot. With JavaScript it
 * is sent with fetch and the result is announced; without it, it is a plain form post that comes back to #lead-sent or
 * #lead-error, which CSS shows (:target). Not connected: on submit it checks the required fields, then says plainly that
 * nothing was sent and how to get in touch instead.
 */
import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type { LeadFormConfig } from "@/lib/content";

type Field = "name" | "email" | "message";
const MESSAGES: Record<Field, string> = {
  name: "Please enter your name.",
  email: "Please enter an email address we can reply to.",
  message: "Please tell us a little about the project.",
};
const REQUIRED: Record<"enquiry" | "signup", Field[]> = { enquiry: ["name", "email", "message"], signup: ["email"] };
const SENT: Record<"enquiry" | "signup", string> = {
  enquiry: "Thank you, we have your message. We will reply soon.",
  signup: "Thank you, you are signed up for updates.",
};

export function ContactForm({
  variant,
  actionLabel,
  note,
  fallback,
  lead,
  businessName,
  page,
}: {
  variant: "enquiry" | "signup";
  actionLabel: string;
  note: string;
  fallback: string;
  lead: LeadFormConfig | null;
  businessName: string;
  /** This page's site path ("/", "/contact/"): where a form post without JavaScript comes back to. */
  page: string;
}) {
  const id = useId();
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  const loadedAt = useRef(0);
  const failed = `Your message was not sent. Please try again. ${fallback}`;

  // The endpoint drops a form sent faster than a person can type, so it is told how long the form was open, measured on the
  // visitor's own clock (load to submit).
  useEffect(() => {
    loadedAt.current = Date.now();
  }, []);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const next: Partial<Record<Field, string>> = {};
    for (const f of REQUIRED[variant]) {
      const v = String(data.get(f) ?? "").trim();
      if (!v || (f === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v))) next[f] = MESSAGES[f];
    }
    setErrors(next);
    if (Object.keys(next).length) {
      setStatus("");
      return;
    }
    if (!lead) {
      setStatus(`Thank you. This form is not connected yet, so nothing was sent. ${fallback}`);
      return;
    }
    const body: Record<string, string> = {};
    data.forEach((value, key) => {
      body[key] = String(value);
    });
    body.fill_ms = String(Date.now() - loadedAt.current);
    setSending(true);
    setStatus("Sending...");
    fetch(lead.endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((r) => r.json().then((j: { ok?: boolean }) => r.ok && j?.ok === true))
      .then((ok) => {
        if (ok) form.reset();
        setStatus(ok ? SENT[variant] : failed);
      })
      .catch(() => setStatus(failed))
      .finally(() => setSending(false));
  };

  const field = (name: Field, label: string, control: (props: Record<string, unknown>) => React.ReactNode, required = true) => {
    const fid = `${id}-${name}`;
    const err = errors[name];
    const req = required ? { required: true, "aria-required": true } : {};
    return (
      <div className="field">
        <label htmlFor={fid}>
          {label}
          {required ? <span aria-hidden="true"> *</span> : <span className="field-optional"> (optional)</span>}
        </label>
        {control({ id: fid, name, ...req, "aria-invalid": !!err, "aria-describedby": err ? `${fid}-error` : undefined })}
        {err && (
          <p id={`${fid}-error`} className="field-error" role="alert">
            {err}
          </p>
        )}
      </div>
    );
  };

  return (
    <form
      className="enquiry"
      data-form={variant}
      noValidate
      onSubmit={submit}
      aria-label={actionLabel}
      {...(lead ? { action: lead.endpoint, method: "post", "data-endpoint": "" } : {})}
    >
      {lead && (
        <>
          <p className="form-flash" id="lead-sent" tabIndex={-1}>
            {SENT[variant]}
          </p>
          <p className="form-flash form-flash-error" id="lead-error" tabIndex={-1}>
            {failed}
          </p>
          <input type="hidden" name="site_key" defaultValue={lead.siteKey} />
          <input type="hidden" name="variant" defaultValue={variant} />
          <input type="hidden" name="page" defaultValue={page} />
          <input type="hidden" name="fill_ms" defaultValue="" />
          <div className="hp">
            <label htmlFor={`${id}-website`}>Leave this field empty</label>
            <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
          </div>
        </>
      )}
      {variant === "signup" ? (
        <>
          {field("email", "Email", (p) => <input type="email" autoComplete="email" {...p} />)}
          {field("name", "First name", (p) => <input type="text" autoComplete="given-name" {...p} />, false)}
        </>
      ) : (
        <>
      {field("name", "Your name", (p) => <input type="text" autoComplete="name" {...p} />)}
      {field("email", "Email", (p) => <input type="email" autoComplete="email" {...p} />)}
      <div className="field">
        <label htmlFor={`${id}-org`}>Company or organisation</label>
        <input id={`${id}-org`} name="organisation" type="text" autoComplete="organization" />
      </div>
      {field("message", "What are you planning?", (p) => <textarea rows={5} {...p} />)}
      <div className="field">
        <label htmlFor={`${id}-when`}>When would you like to start?</label>
        <select id={`${id}-when`} name="timing" defaultValue="">
          <option value="">Not sure yet</option>
          <option value="soon">As soon as possible</option>
          <option value="quarter">In the next few months</option>
          <option value="later">Later this year or beyond</option>
        </select>
      </div>
        </>
      )}
      <p className="form-note">{note}</p>
      {lead && (
        <p className="form-privacy">
          {variant === "signup"
            ? `Your email goes only to ${businessName}, and is used only to send you updates.`
            : `Your details go only to ${businessName}, and are used only to reply to you.`}
        </p>
      )}
      <button type="submit" className="btn btn-accent" disabled={sending}>
        <span>{actionLabel}</span>
        <span className="btn-icon" aria-hidden="true">
          <ArrowUpRight size={18} strokeWidth={1.75} />
        </span>
      </button>
      <p className="form-status" role="status" aria-live="polite">
        {status}
      </p>
    </form>
  );
}
