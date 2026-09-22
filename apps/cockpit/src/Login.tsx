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
    <div style={{ maxWidth: 360, margin: "4rem auto", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: "1.25rem" }}>WFACT Cockpit</h1>
      {status === "sent" ? (
        <p>Check {email} for a sign-in link.</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: "0.5rem", marginBottom: "0.5rem" }}
          />
          <button type="submit" disabled={status === "sending"} style={{ padding: "0.5rem 1rem" }}>
            {status === "sending" ? "Sending…" : "Send magic link"}
          </button>
          {error && <p style={{ color: "crimson" }}>{error}</p>}
        </form>
      )}
    </div>
  );
}
