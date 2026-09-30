/**
 * "Choose a new password" — shown after someone opens a password-reset link (Supabase fires the
 * PASSWORD_RECOVERY auth event and signs the browser in for that one purpose). Also the way an account
 * created by magic link sets its first password. Rules match Login.tsx's sign-up form.
 */
import { useState } from "react";
import { supabase } from "./supabaseClient";
import { MIN_PASSWORD_LENGTH } from "./Login";

export function SetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      return setError(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) return setError(updateError.message);
    onDone();
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-mark">
          <span className="sidebar-mark-dot" />
          <h1 className="login-title">WFACT Cockpit</h1>
        </div>
        <p className="login-sub">Choose a new password</p>
        <form onSubmit={handleSubmit}>
          <input
            className="login-input"
            type="password"
            required
            autoComplete="new-password"
            placeholder={`New password (${MIN_PASSWORD_LENGTH}+ characters)`}
            aria-label="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            className="login-input"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Repeat the new password"
            aria-label="Repeat the new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "Saving…" : "Save password"}
          </button>
          {error && <p className="login-error" role="alert">{error}</p>}
        </form>
      </div>
    </div>
  );
}
