/**
 * Magic-link sign-in. No password to invent, manage, or leak — Supabase emails a one-time link,
 * clicking it signs the browser in. The profiles row (role) that gates what's visible after sign-in
 * is seeded server-side (see BLOCKED-ON-NICK.md / PROGRESS.md), not created from this screen.
 */
import { useState } from "react";
import { supabase } from "./supabaseClient";

export function Login() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithOtp({ email });
    if (signInError) {
      setStatus("error");
      setError(signInError.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-mark">
          <span className="sidebar-mark-dot" />
          <h1 className="login-title">WFACT Cockpit</h1>
        </div>
        {status === "sent" ? (
          <p>Check {email} for a sign-in link.</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              className="login-input"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" className="btn primary" disabled={status === "sending"}>
              {status === "sending" ? "Sending…" : "Send magic link"}
            </button>
            {error && <p className="login-error">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
