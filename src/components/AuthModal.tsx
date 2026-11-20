import { useState } from "react";
import { useModalAccessibility } from "../hooks/useModalAccessibility";
import type { User } from "@supabase/supabase-js";
import { HiOutlineXMark as X, HiOutlineArrowLeft as ArrowLeft } from "react-icons/hi2";
import { supabase } from "../lib/supabase";

type Mode = "signin" | "signup" | "verify" | "recovery" | "update";
type Props = { onClose: () => void; onAuthenticated: (user: User) => void; initialMode?: Mode };

export default function AuthModal({ onClose, onAuthenticated, initialMode = "signin" }: Props) {
  const dialogRef = useModalAccessibility(onClose);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    if (!supabase) { setMessage("Account services are not configured yet. Please try again later."); return; }
    if (mode !== "update" && !email.trim()) { setMessage("Enter your email address."); return; }
    if ((mode === "signin" || mode === "signup" || mode === "update") && password.length < 8) {
      setMessage("Use a password with at least 8 characters."); return;
    }
    if (mode === "update" && password !== confirmation) { setMessage("Your passwords do not match."); return; }
    if (mode === "verify" && !/^\d{6}$/.test(verificationCode.trim())) {
      setMessage("Enter the 6-digit code from your email."); return;
    }
    setBusy(true); setMessage("");
    try {
      if (mode === "recovery") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + "/?password-reset=1" });
        if (error) throw error;
        setMessage("Password reset email sent. Check your inbox to continue.");
        return;
      }
      if (mode === "update") {
        const { data, error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        if (data.user) onAuthenticated(data.user);
        window.history.replaceState({}, "", window.location.pathname);
        setMessage("Your password has been updated.");
        window.setTimeout(onClose, 900);
        return;
      }
      if (mode === "verify") {
        const { data, error } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: verificationCode.trim(),
          type: "email"
        });
        if (error) throw error;
        if (data.user) { onAuthenticated(data.user); onClose(); }
        return;
      }
      if (mode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        if (data.user) { onAuthenticated(data.user); onClose(); }
        return;
      }

      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) throw error;
      if (data.session && data.user) { onAuthenticated(data.user); onClose(); return; }
      if (data.user?.email_confirmed_at) {
        setMode("signin");
        setMessage("This email is already verified. Sign in with your password instead.");
        return;
      }
      setMode("verify");
      setMessage("Your 6-digit verification code is on its way. Check your inbox and spam folder.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Authentication failed."); }
    finally { setBusy(false); }
  }

  async function resendCode() {
    if (!supabase || !email.trim()) return;
    setBusy(true); setMessage("");
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: email.trim() });
      if (error) throw error;
      setMessage("A new verification code has been sent. Check your inbox and spam folder.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not resend the code."); }
    finally { setBusy(false); }
  }

  const title = mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your DevLens account" : mode === "verify" ? "Verify your email" : mode === "recovery" ? "Reset your password" : "Choose a new password";
  const submitLabel = busy ? "Please wait..." : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : mode === "verify" ? "Verify email" : mode === "recovery" ? "Send reset email" : "Update password";
  return <div className="modal-backdrop" onClick={onClose}>
    <section ref={dialogRef} className="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" onClick={event => event.stopPropagation()}>
      <div className="modal-title"><b id="auth-title">{title}</b><button onClick={onClose} aria-label="Close"><X size={16}/></button></div>
      <p>{mode === "signin" ? "Sign in to access your synced API workspace." : mode === "signup" ? "Create your account. Your collections stay private until you choose to share them." : mode === "verify" ? `Enter the 6-digit code we sent to ${email.trim()}.` : mode === "recovery" ? "Enter the email address linked to your DevLens account." : "Set a new password for your DevLens account."}</p>
      {mode !== "update" && <><label htmlFor="account-email">Email address</label><input id="account-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" disabled={mode === "verify"}/></>}
      {mode === "verify" && <><label htmlFor="verification-code">VERIFICATION CODE</label><input id="verification-code" className="auth-otp-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={verificationCode} onChange={event => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" onKeyDown={event => event.key === "Enter" && submit()}/></>}
      {mode !== "recovery" && mode !== "verify" && <><label htmlFor="account-password">{mode === "update" ? "New password" : "Password"}</label><input id="account-password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" onKeyDown={event => event.key === "Enter" && submit()}/></>}
      {mode === "update" && <><label htmlFor="account-confirm-password">Confirm new password</label><input id="account-confirm-password" type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder="Enter the password again" onKeyDown={event => event.key === "Enter" && submit()}/></>}
      {message && <div className="auth-message" role="status">{message}</div>}
      <button className="send-button modal-submit" disabled={busy} onClick={submit}>{submitLabel}</button>
      {mode === "verify" && <><button className="auth-switch" disabled={busy} onClick={resendCode}>Didn't receive a code? Resend code</button><button className="auth-switch" onClick={() => { setMode("signup"); setVerificationCode(""); setMessage(""); }}><ArrowLeft size={13}/> Change email or details</button></>}
      {mode === "signin" && <button className="auth-switch" onClick={() => { setMode("recovery"); setMessage(""); }}>Forgot your password?</button>}
      {mode === "recovery" && <button className="auth-switch" onClick={() => { setMode("signin"); setMessage(""); }}>Back to sign in</button>}
      {(mode === "signin" || mode === "signup") && <button className="auth-switch" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }}>{mode === "signin" ? "New to DevLens? Create an account" : "Already have an account? Sign in"}</button>}
    </section>
  </div>;
}
