"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

type AuthMode = "sign-in" | "sign-up" | "forgot-password" | "reset-password";

function nextPath() {
  if (typeof window === "undefined") return "/";
  const requested = new URLSearchParams(window.location.search).get("next");
  return requested?.startsWith("/") ? requested : "/";
}

function AuthBrand() {
  return <div className="mb-8 flex items-center justify-center gap-2 text-stone-950"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-sm font-bold text-white">S</span><span className="text-xl font-bold tracking-tight">Studio</span></div>;
}

function AuthShell({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return <main className="min-h-screen bg-mist px-4 py-10 text-stone-900 sm:px-6"><div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center"><AuthBrand/>{children}{note && <div className="mt-5 text-center text-xs leading-5 text-stone-500">{note}</div>}</div></main>;
}

function AuthError({ message }: { message: string }) {
  return <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm font-medium leading-5 text-rose-800">{message}</p>;
}

function AuthLinks({ mode }: { mode: AuthMode }) {
  const links = mode === "sign-in"
    ? <><a href="/sign-up" className="font-semibold text-brand hover:underline">Create an account</a><span aria-hidden="true"> · </span><a href="/forgot-password" className="font-semibold text-brand hover:underline">Forgot password?</a></>
    : mode === "sign-up"
      ? <>Already have an account? <a href="/sign-in" className="font-semibold text-brand hover:underline">Sign in</a></>
      : <a href="/sign-in" className="font-semibold text-brand hover:underline">Back to sign in</a>;
  return <p className="text-center text-sm text-stone-500">{links}</p>;
}

function PasswordField({ id, value, onChange, autoComplete, placeholder, disabled = false, required = true, minLength }: { id: string; value: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void; autoComplete: string; placeholder: string; disabled?: boolean; required?: boolean; minLength?: number }) {
  const [visible, setVisible] = useState(false);
  const label = visible ? "Hide password" : "Show password";
  return <div className="relative mt-2"><LockKeyhole className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-stone-400" aria-hidden="true"/><Input id={id} type={visible ? "text" : "password"} autoComplete={autoComplete} required={required} minLength={minLength} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} className="h-11 pl-9 pr-11"/><button type="button" aria-label={label} aria-pressed={visible} onClick={() => setVisible((current) => !current)} disabled={disabled} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:pointer-events-none disabled:opacity-50">{visible ? <EyeOff className="h-4 w-4" aria-hidden="true"/> : <Eye className="h-4 w-4" aria-hidden="true"/>}</button></div>;
}

export function AuthForm({ mode, googleEnabled = false }: { mode: AuthMode; googleEnabled?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignIn = mode === "sign-in";
  const isSignUp = mode === "sign-up";
  const isForgot = mode === "forgot-password";
  const isReset = mode === "reset-password";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      if (isSignIn) {
        const result = await authClient.signIn.email({ email: email.trim(), password });
        if (result.error) throw new Error(result.error.message || "We could not sign you in.");
        router.replace(nextPath());
        router.refresh();
        return;
      }

      if (isSignUp) {
        const result = await authClient.signUp.email({ name: name.trim(), email: email.trim(), password });
        if (result.error) throw new Error(result.error.message || "We could not create your account.");
        router.replace(nextPath());
        router.refresh();
        return;
      }

      if (isForgot) {
        const result = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: `${window.location.origin}/reset-password` });
        if (result.error) throw new Error(result.error.message || "We could not start password recovery.");
        setMessage("If an account exists for that email, a password reset link is on its way.");
        return;
      }

      const token = new URLSearchParams(window.location.search).get("token");
      if (!token) throw new Error("This password reset link is missing or invalid.");
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) throw new Error(result.error.message || "We could not reset your password.");
      setMessage("Your password has been updated. You can sign in now.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const signInWithGoogle = async () => {
    if (!googleEnabled || isSubmitting) return;
    setError("");
    setIsSubmitting(true);
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: nextPath() });
      if (result.error) throw new Error(result.error.message || "We could not start Google sign-in.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  };

  const title = isSignIn ? "Welcome back" : isSignUp ? "Create your Studio account" : isForgot ? "Reset your password" : "Choose a new password";
  const description = isSignIn ? "Sign in to keep your orders and business records private." : isSignUp ? "Your account keeps your Studio workspace separate from everyone else’s." : isForgot ? "Enter your email and we’ll send a secure reset link." : "Use at least 8 characters for your new password.";
  const buttonLabel = isSignIn ? "Sign in" : isSignUp ? "Create account" : isForgot ? "Send reset link" : "Update password";

  return <AuthShell note={isSignUp ? "Email verification is optional. You can start using Studio immediately." : undefined}><Card className="border-stone-200/80 shadow-sm ring-0"><CardHeader className="space-y-2 p-6 pb-4"><CardTitle className="text-2xl font-bold tracking-tight text-stone-950">{title}</CardTitle><CardDescription className="text-sm leading-6 text-stone-500">{description}</CardDescription></CardHeader><CardContent className="space-y-5 p-6 pt-2">{message && <div role="status" className="flex gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-medium leading-5 text-emerald-800"><Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true"/>{message}</div>}{error && <AuthError message={error}/>} {!isReset && <><form onSubmit={submit} className="space-y-4">{isSignUp && <div><Label htmlFor="auth-name">Name</Label><Input id="auth-name" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" className="mt-2 h-11"/></div>}<div><Label htmlFor="auth-email">Email</Label><div className="relative mt-2"><Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-stone-400" aria-hidden="true"/><Input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="h-11 pl-9"/></div></div>{!isForgot && <div><Label htmlFor="auth-password">Password</Label><PasswordField id="auth-password" autoComplete={isSignIn ? "current-password" : "new-password"} required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isSignIn ? "Your password" : "At least 8 characters"}/></div>}<Button type="submit" disabled={isSubmitting} className="h-11 w-full bg-brand text-white hover:bg-teal-800">{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Working"/> : <>{buttonLabel}<ArrowRight className="h-4 w-4" aria-hidden="true"/></>}</Button></form>{(isSignIn || isSignUp) && <><div className="flex items-center gap-3 text-xs text-stone-400"><span className="h-px flex-1 bg-stone-200"/><span>or continue with</span><span className="h-px flex-1 bg-stone-200"/></div><Button type="button" variant="outline" disabled={!googleEnabled || isSubmitting} onClick={signInWithGoogle} className="h-11 w-full">Continue with Google</Button>{!googleEnabled && <p className="text-center text-xs leading-5 text-stone-400">Google sign-in will appear here once its OAuth credentials are connected.</p>}</>}</>} {isReset && <form onSubmit={submit} className="space-y-4"><div><Label htmlFor="reset-password">New password</Label><PasswordField id="reset-password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters"/></div><Button type="submit" disabled={isSubmitting} className="h-11 w-full bg-brand text-white hover:bg-teal-800">{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Working"/> : buttonLabel}</Button></form>}<AuthLinks mode={mode}/>{isSignUp && <p className="flex items-start gap-2 text-xs leading-5 text-stone-400"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true"/>We use a secure session cookie. Your Studio records are kept separate from other accounts.</p>}</CardContent></Card></AuthShell>;
}

export function AuthSetupNotice() {
  return <AuthShell><Card className="border-stone-200/80 shadow-sm ring-0"><CardHeader className="space-y-2 p-6"><CardTitle className="text-2xl font-bold tracking-tight text-stone-950">Authentication setup needed</CardTitle><CardDescription className="text-sm leading-6 text-stone-500">Studio is ready for Better Auth, but the Neon connection and server secret have not been added yet.</CardDescription></CardHeader><CardContent className="space-y-4 p-6 pt-0"><div className="rounded-xl bg-stone-50 p-4 text-sm leading-6 text-stone-600"><p className="font-semibold text-stone-900">Add these environment variables:</p><code className="mt-2 block whitespace-pre-wrap text-xs">DATABASE_URL{`\n`}BETTER_AUTH_SECRET{`\n`}BETTER_AUTH_URL</code></div><p className="text-sm leading-6 text-stone-500">Google OAuth and password-reset email are optional until their provider credentials are connected.</p></CardContent></Card></AuthShell>;
}
