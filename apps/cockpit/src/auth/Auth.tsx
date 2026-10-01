/**
 * Sign-in screens (Step 3A logic, restyled in Step 4C; behaviour unchanged).
 *
 * Login: email + password, create an account, magic link (existing accounts only), forgot password.
 * A new account has NO access until an owner (or, for pm accounts, an admin) approves it — the approval
 * gate is the database (migration 0010: a sign-up only creates a pending account_requests row, never a
 * profiles row, so every RLS policy grants it nothing). Errors are deliberately generic ("Invalid email
 * or password", "If that account exists…") so the form can't be used to discover which emails have accounts.
 *
 * SetPassword: shown after a reset link (Supabase fires PASSWORD_RECOVERY and signs the browser in for
 * that one purpose); also how a magic-link account sets its first password.
 *
 * AccessPending: a signed-in account with no profile can read only its own account_requests row; it
 * shows where the request stands and lets the person sign out. It never grants anything.
 */
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "../supabaseClient";
import { Notice, RouteLine } from "../components/ui";

export const MIN_PASSWORD_LENGTH = 12;

function AuthFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-side" aria-hidden="true">
        <div className="mark">
          <span className="mark-glyph">WF</span>
          <span className="mark-name">
            WFACT<span>Cockpit</span>
          </span>
        </div>
        <div className="stack-tight">
          <p style={{ font: "700 var(--t-xl)/1.25 var(--face-plate)", color: "var(--ink)", maxWidth: "22ch" }}>A route only lights when every signal along it is proven clear.</p>
          <p>The control room for the factory: every decision, every build and every check, in one place. Launch and money always stay with a person.</p>
          <div style={{ maxWidth: 420 }}>
            <RouteLine stage="6_full_build_owners_key" name="Example route" />
          </div>
        </div>
        <span className="quiet fine">WFACT 3.0</span>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <h1>{title}</h1>
          {children}
        </div>
      </main>
    </div>
  );
}

type Mode = "signin" | "signup" | "magic" | "forgot";

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
      if (password.length < MIN_PASSWORD_LENGTH) return setError(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
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
        } else if (!data.session) {
          setNotice("Account requested. Confirm your email using the link we sent, then an owner will review your request. You'll be able to sign in once it's approved.");
        }
        // With email confirmation off the browser is already signed in; App shows the "waiting for approval" screen.
      } else if (mode === "forgot") {
        await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        setNotice(`If ${email} has an account, a password reset link is on its way.`);
      } else {
        // shouldCreateUser:false — a magic link can only sign in an existing account, never create one.
        await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
        setNotice(`If ${email} has an account, a sign-in link is on its way.`);
      }
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "signin" ? "Sign in" : mode === "signup" ? "Create an account" : mode === "forgot" ? "Reset your password" : "Email me a sign-in link";
  const submitLabel = mode === "signin" ? "Sign in" : mode === "signup" ? "Request an account" : mode === "forgot" ? "Send reset link" : "Send sign-in link";

  return (
    <AuthFrame title={title}>
      {notice ? (
        <>
          <Notice tone="clear">{notice}</Notice>
          <div>
            <button type="button" className="btn" onClick={() => switchMode("signin")}>
              Back to sign in
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <div className="field">
              <label htmlFor="auth-name">Full name</label>
              <input id="auth-name" className="input" type="text" required autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-email">Email</label>
            <input id="auth-email" className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {mode !== "magic" && mode !== "forgot" && (
            <div className="field">
              <label htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                className="input"
                type="password"
                required
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby={mode === "signup" ? "auth-password-hint" : undefined}
              />
              {mode === "signup" && (
                <span id="auth-password-hint" className="hint">
                  At least {MIN_PASSWORD_LENGTH} characters.
                </span>
              )}
            </div>
          )}
          {error && (
            <p role="alert" style={{ color: "var(--stop)", margin: 0 }}>
              {error}
            </p>
          )}
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "Working…" : submitLabel}
          </button>
        </form>
      )}
      {!notice && (
        <div className="auth-links">
          {mode !== "signin" && (
            <button type="button" className="link-btn" onClick={() => switchMode("signin")}>
              Sign in with a password
            </button>
          )}
          {mode !== "signup" && (
            <button type="button" className="link-btn" onClick={() => switchMode("signup")}>
              Create an account
            </button>
          )}
          {mode !== "magic" && (
            <button type="button" className="link-btn" onClick={() => switchMode("magic")}>
              Email me a link instead
            </button>
          )}
          {mode !== "forgot" && (
            <button type="button" className="link-btn" onClick={() => switchMode("forgot")}>
              Forgot password?
            </button>
          )}
        </div>
      )}
      {mode === "signup" && !notice && <p className="quiet fine">New accounts need approval by an owner before they can see anything.</p>}
    </AuthFrame>
  );
}

export function SetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) return setError(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) return setError(updateError.message);
    onDone();
  }

  return (
    <AuthFrame title="Choose a new password">
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="new-pw">New password</label>
          <input id="new-pw" className="input" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="new-pw-hint" />
          <span id="new-pw-hint" className="hint">
            At least {MIN_PASSWORD_LENGTH} characters.
          </span>
        </div>
        <div className="field">
          <label htmlFor="new-pw2">Repeat the new password</label>
          <input id="new-pw2" className="input" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {error && (
          <p role="alert" style={{ color: "var(--stop)", margin: 0 }}>
            {error}
          </p>
        )}
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? "Saving…" : "Save password"}
        </button>
      </form>
    </AuthFrame>
  );
}

type Status = "pending" | "approved" | "rejected" | "none";

export function AccessPending({ email }: { email: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase.from("account_requests").select("status,decision_note").maybeSingle();
      if (cancelled) return;
      setStatus((data?.status as Status | undefined) ?? "none");
      setNote((data?.decision_note as string | null | undefined) ?? null);
    }
    load();
    // Re-check while the tab is open so an approval shows up without a manual refresh.
    const timer = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const message =
    status === "rejected"
      ? "This account request wasn't approved."
      : status === "approved"
        ? "Approved. Reload the page to continue."
        : "Your account is waiting for approval by an owner. You'll be able to use the Cockpit once it's approved; this page checks every few seconds.";

  return (
    <AuthFrame title="Waiting for approval">
      <p className="muted">Signed in as {email}</p>
      {status === null ? (
        <p className="muted" role="status">
          Checking your request…
        </p>
      ) : (
        <Notice tone={status === "rejected" ? "stop" : status === "approved" ? "clear" : "caution"}>{message}</Notice>
      )}
      {status === "rejected" && note && <p className="muted">Note from the reviewer: {note}</p>}
      <div className="actions">
        <button type="button" className="btn" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
        {status === "approved" && (
          <button type="button" className="btn primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        )}
      </div>
    </AuthFrame>
  );
}
