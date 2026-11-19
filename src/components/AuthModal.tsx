import { useState } from "react";
import { useModalAccessibility } from "../hooks/useModalAccessibility";
import type { User } from "@supabase/supabase-js";
import { X } from "lucide-react";
import { supabase } from "../lib/supabase";

type Props = { onClose: () => void; onAuthenticated: (user: User) => void };

export default function AuthModal({
  const dialogRef = useModalAccessibility(onClose); onClose, onAuthenticated }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    if (!supabase) {
      setMessage("Cloud sync is not configured yet. Guest mode remains available.");
      return;
    }
    if (!email.trim() || password.length < 8) {
      setMessage("Enter a valid email and a password with at least 8 characters.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = mode === "signin"
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password });
      if (result.error) throw result.error;
      if (result.data.session && result.data.user) {
        onAuthenticated(result.data.user);
        onClose();
      } else {
        setMessage("Check your email to confirm your account, then sign in.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="modal-backdrop" onClick={onClose}>
    <section ref={dialogRef} className="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" onClick={event => event.stopPropagation()}>
      <div className="modal-title"><b id="auth-title">{mode === "signin" ? "Welcome back" : "Create your DevLens account"}</b><button onClick={onClose} aria-label="Close"><X size={16}/></button></div>
      <p>{mode === "signin" ? "Sign in to sync collections and environments across devices." : "Your collections stay private until you choose to share them."}</p>
      <label>Email address</label>
      <input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com"/>
      <label>Password</label>
      <input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" onKeyDown={event => event.key === "Enter" && submit()}/>
      {message && <div className="auth-message" role="status">{message}</div>}
      <button className="send-button modal-submit" disabled={busy} onClick={submit}>{busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}</button>
      <button className="auth-switch" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }}>{mode === "signin" ? "New to DevLens? Create an account" : "Already have an account? Sign in"}</button>
    </section>
  </div>;
}