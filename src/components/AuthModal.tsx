import { useState } from "react";
import { useModalAccessibility } from "../hooks/useModalAccessibility";
import type { User } from "@supabase/supabase-js";
import { X } from "lucide-react";
import { supabase } from "../lib/supabase";

type Mode = "signin" | "signup" | "recovery" | "update";
type Props = { onClose: () => void; onAuthenticated: (user: User) => void; initialMode?: Mode };

export default function AuthModal({ onClose, onAuthenticated, initialMode = "signin" }: Props) {
  const dialogRef = useModalAccessibility(onClose);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    if (!supabase) { setMessage("Account services are not configured yet. Please try again later."); return; }
    if (mode !== "update" && !email.trim()) { setMessage("Enter your email address."); return; }
    if ((mode === "signin" || mode === "signup" || mode === "update") && password.length < 8) {
      setMessage("Use a password with at least 8 characters."); return;
    }
    if (mode === "update" && password !== confirmation) { setMessage("Your passwords do not match."); return; }
    setBusy(true); setMessage("");
    try {
      if (mode === "recovery") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + "/?password-reset=1" });
        if (error) throw error;
        setMessage("Password reset link sent. Check your email to continue.");
        return;
      }
      if (mode === "update") {
        const { data, error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        if (data.user) onAuthenticated(data.user);
        window.history.replaceState({}, "", window.location.pathname);
        setMessage("Your password has been updated.");
        setTimeout(onClose, 900);
        return;
      }
      const result = mode === "signin"
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password });
      if (result.error) throw result.error;
      if (result.data.session && result.data.user) { onAuthenticated(result.data.user); onClose(); }
      else setMessage("Check your email to confirm your account, then sign in.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Authentication failed."); }
    finally { setBusy(false); }
  }

  const title = mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your DevLens account" : mode === "recovery" ? "Reset your password" : "Choose a new password";
  const submitLabel = busy ? "Please wait..." : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : mode === "recovery" ? "Send reset link" : "Update password";
  return <div className="modal-backdrop" onClick={onClose}>
    <section ref={dialogRef} className="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" onClick={event => event.stopPropagation()}>
      <div className="modal-title"><b id="auth-title">{title}</b><button onClick={onClose} aria-label="Close"><X size={16}/></button></div>
      <p>{mode === "signin" ? "Sign in to access your synced API workspace." : mode === "signup" ? "Create your account. Your collections stay private until you choose to share them." : mode === "recovery" ? "Enter the email address linked to your DevLens account." : "Set a new password for your DevLens account."}</p>
      {mode !== "update" && <><label htmlFor="account-email">Email address</label><input id="account-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" disabled={mode === "recovery" ? false : undefined}/></>}
      {mode !== "recovery" && <><label htmlFor="account-password">{mode === "update" ? "New password" : "Password"}</label><input id="account-password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" onKeyDown={event => event.key === "Enter" && submit()}/></>}
      {mode === "update" && <><label htmlFor="account-confirm-password">Confirm new password</label><input id="account-confirm-password" type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder="Enter the password again" onKeyDown={event => event.key === "Enter" && submit()}/></>}
      {message && <div className="auth-message" role="status">{message}</div>}
      <button className="send-button modal-submit" disabled={busy} onClick={submit}>{submitLabel}</button>
      {mode === "signin" && <button className="auth-switch" onClick={() => { setMode("recovery"); setMessage(""); }}>Forgot your password?</button>}
      {mode === "recovery" && <button className="auth-switch" onClick={() => { setMode("signin"); setMessage(""); }}>Back to sign in</button>}
      {(mode === "signin" || mode === "signup") && <button className="auth-switch" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }}>{mode === "signin" ? "New to DevLens? Create an account" : "Already have an account? Sign in"}</button>}
    </section>
  </div>;
}
