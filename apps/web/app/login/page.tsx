"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await login(email, password); } catch (err) { setError(err instanceof Error ? err.message : "Unable to sign in"); setBusy(false); }
  }

  return <main className="auth-page"><div className="auth-visual"><video autoPlay muted loop playsInline poster="/logo.jpg"><source src="/introloop.mp4" type="video/mp4"/></video><div className="auth-visual-copy"><span>LANE INTELLIGENCE</span><h2>Turn every shot into a better decision.</h2><p>Track transition, equipment, and recommendation performance from one focused dashboard.</p></div></div><div className="auth-panel"><Link href="/" className="marketing-brand auth-brand"><span className="brand-orbit small"><span className="brand-ball" /></span><strong>STRIKEPATH</strong><em>AI</em></Link><form onSubmit={submit} className="auth-form"><div><small>Welcome back</small><h1>Sign in to StrikePath</h1><p>Continue your session history and lane analysis.</p></div>{error && <div className="error-banner">{error}</div>}<label className="field"><span>Email</span><input type="email" required autoComplete="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com"/></label><label className="field"><span>Password</span><input type="password" required autoComplete="current-password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="••••••••"/></label><button className="primary-button wide" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button><div className="demo-note"><b>Local demo:</b> demo@strikepath.ai / DemoPass123!</div><p className="auth-switch">New to StrikePath? <Link href="/register">Create an account</Link></p></form></div></main>;
}
