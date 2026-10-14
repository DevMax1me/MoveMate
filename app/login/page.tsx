"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { Field, Notice } from "@/components/ui";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [err, setErr] = useState<string | null>(null), [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api("/auth/login", { body: { email, password } }); router.replace("/today"); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }
  return (
    <div className="pub" id="contenu">
      <h1>Connexion</h1>
      <form className="card" onSubmit={submit}>
        {err && <Notice kind="err">{err}</Notice>}
        <Field label="Adresse électronique"><input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Mot de passe"><input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <button className="primary" disabled={busy}>{busy ? "Connexion…" : "Se connecter"}</button>
      </form>
      <p className="small" style={{ marginTop: 12 }}><Link href="/register">Créer un compte</Link> · <Link href="/reset">Mot de passe oublié</Link> · <Link href="/">Accueil</Link></p>
    </div>
  );
}
