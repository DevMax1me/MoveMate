"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { Field, Notice } from "@/components/ui";

export default function Register() {
  const router = useRouter();
  const [f, setF] = useState({ name: "", email: "", password: "", adult: false }), [err, setErr] = useState<string | null>(null), [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api("/auth/register", { body: { ...f, tz: Intl.DateTimeFormat().resolvedOptions().timeZone } }); router.replace("/account?welcome=1"); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }
  return (
    <div className="pub" id="contenu">
      <h1>Créer un compte</h1>
      <form className="card" onSubmit={submit}>
        {err && <Notice kind="err">{err}</Notice>}
        <Field label="Prénom ou pseudo" hint="facultatif"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="nickname" /></Field>
        <Field label="Adresse électronique"><input type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Mot de passe" hint="10 caractères minimum"><input type="password" autoComplete="new-password" minLength={10} required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <label className="chk"><input type="checkbox" checked={f.adult} onChange={(e) => setF({ ...f, adult: e.target.checked })} /> J’ai 18 ans ou plus (service réservé aux adultes)</label>
        <p className="small muted">Vos données de poids, d’alimentation et d’activité peuvent révéler des informations sur votre santé. Elles restent privées, ne sont ni vendues ni utilisées pour entraîner un modèle. <Link href="/confidentialite">En savoir plus</Link>.</p>
        <button className="primary" disabled={busy || !f.adult}>{busy ? "Création…" : "Créer mon compte"}</button>
      </form>
      <p className="small" style={{ marginTop: 12 }}><Link href="/login">J’ai déjà un compte</Link></p>
    </div>
  );
}
