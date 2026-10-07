"use client";
/**
 * The contact form, in one of two shapes the content chooses: "enquiry" (a project enquiry: name, email,
 * organisation, what they are planning, timing) or "signup" (email updates only: email, and a first name
 * that is optional, Cockpit job 6f68adbd: an email signup must not ask for a project brief). It is not
 * connected to a handler yet (a later step wires it), so on submit it checks the required fields, then
 * says plainly that nothing was sent and how to get in touch instead. Labels above fields, errors below
 * and announced, no placeholder-as-label.
 */
import { useId, useState } from "react";
import { ArrowUpRight } from "lucide-react";

type Field = "name" | "email" | "message";
const MESSAGES: Record<Field, string> = {
  name: "Please enter your name.",
  email: "Please enter an email address we can reply to.",
  message: "Please tell us a little about the project.",
};
const REQUIRED: Record<"enquiry" | "signup", Field[]> = { enquiry: ["name", "email", "message"], signup: ["email"] };

export function ContactForm({
  variant,
  actionLabel,
  note,
  fallback,
}: {
  variant: "enquiry" | "signup";
  actionLabel: string;
  note: string;
  fallback: string;
}) {
  const id = useId();
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [status, setStatus] = useState("");

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const next: Partial<Record<Field, string>> = {};
    for (const f of REQUIRED[variant]) {
      const v = String(data.get(f) ?? "").trim();
      if (!v || (f === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v))) next[f] = MESSAGES[f];
    }
    setErrors(next);
    setStatus(Object.keys(next).length ? "" : `Thank you. This form is not connected yet, so nothing was sent. ${fallback}`);
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
    <form className="enquiry" data-form={variant} noValidate onSubmit={submit} aria-label={actionLabel}>
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
      <button type="submit" className="btn btn-accent">
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
