/**
 * Sign in with email + password, create an account, or (fallback) get a magic link.
 *
 * A new account has NO access until an owner (or, for pm accounts, an admin) approves it — the
 * approval gate is the database (migration 0010: a sign-up only creates a pending account_requests
 * row, never a profiles row, so every RLS policy grants it nothing). This screen only collects
 * credentials; App.tsx shows the "waiting for approval" screen for signed-in accounts without a profile.
 *
 * Errors are deliberately generic ("Invalid email or password", "If that account exists…") so the
 * form can't be used to discover which emails have accounts.
 */
import { useState } from "react";
import { supabase } from "./supabaseClient";

type Mode = "signin" | "signup" | "magic" | "forgot";
export const MIN_PASSWORD_LENGTH = 12;

export function Login() {
  const [mode, setMode] = useState<Mode>("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === "signup") {
      if (fullName.trim().length < 2) return setError("Enter your name so the approver knows who you are.");
      if (password.length < MIN_PASSWORD_LENGTH) {
        return setError(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
      }
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) setError("Invalid email or password.");
      } else if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName.trim() }, emailRedirectTo: window.location.origin },
        });
        if (signUpError) {
          setError(signUpError.message);
        } else if (data.session) {
          // Email confirmation is off: already signed in; App.tsx will show the pending screen.
        } else {
          setNotice(
            "Account requested. Confirm your email using the link we sent, then an owner will review your request. You'll be able to sign in once it's approved.",
          );
        }
      } else if (mode === "forgot") {
        // Works for accounts that never had a password too (e.g. created via magic link): the emailed
        // link signs them in and App.tsx then shows the "choose a new password" screen.
        await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        // Same message whether or not the account exists (no account enumeration).
        setNotice(`If ${email} has an account, a password reset link is on its way.`);
      } else {
        // shouldCreateUser:false — a magic link can only sign in an existing account, never create one.
        await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
        // Same message whether or not the account exists (no account enumeration).
        setNotice(`If ${email} has an account, a sign-in link is on its way.`);
      }
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === "signin" ? "Sign in" : mode === "signup" ? "Create an account" : mode === "forgot" ? "Reset your password" : "Email me a sign-in link";
  const submitLabel =
    mode === "signin" ? "Sign in" : mode === "signup" ? "Request account" : mode === "forgot" ? "Send reset link" : "Send magic link";

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-mark">
          <span className="sidebar-mark-dot" />
          <h1 className="login-title">WFACT Cockpit</h1>
        </div>
        <p className="login-sub">{title}</p>

        {notice ? (
          <>
            <p className="login-notice" role="status">{notice}</p>
            <button type="button" className="btn" onClick={() => switchMode("signin")}>Back to sign in</button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            {mode === "signup" && (
              <input
                className="login-input"
                type="text"
                required
                autoComplete="name"
                placeholder="Full name"
                aria-label="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            )}
            <input
              className="login-input"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              aria-label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {mode !== "magic" && mode !== "forgot" && (
              <input
                className="login-input"
                type="password"
                required
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder={mode === "signup" ? `Password (${MIN_PASSWORD_LENGTH}+ characters)` : "Password"}
                aria-label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? "Working…" : submitLabel}
            </button>
            {error && <p className="login-error" role="alert">{error}</p>}
          </form>
        )}

        {!notice && (
          <div className="login-links">
            {mode !== "signin" && <button type="button" className="link-btn" onClick={() => switchMode("signin")}>Sign in with password</button>}
            {mode !== "signup" && <button type="button" className="link-btn" onClick={() => switchMode("signup")}>Create an account</button>}
            {mode !== "magic" && <button type="button" className="link-btn" onClick={() => switchMode("magic")}>Email me a link instead</button>}
            {mode !== "forgot" && <button type="button" className="link-btn" onClick={() => switchMode("forgot")}>Forgot password?</button>}
          </div>
        )}
        {mode === "signup" && !notice && (
          <p className="login-fine">New accounts need approval by an owner before they can see anything.</p>
        )}
      </div>
    </div>
  );
}
