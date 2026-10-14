"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client";
import { Field, Notice } from "@/components/ui";

function Inner() {
  const token = useSearchParams().get("token");
  const [email, setEmail] = useState(""), [pw, setPw] = useState(""), [msg, setMsg] = useState<string | null>(null), [err, setErr] = useState<string | null>(null);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setMsg(null);
    try {
      if (token) { await api("/auth/reset", { body: { token, password: pw } }); setMsg("Mot de passe mis à jour. Vous pouvez vous connecter."); }
      else { const r = await api("/auth/reset-request", { body: { email } }); setMsg(r.message); }
    } catch (x: any) { setErr(x.message); }
  }
  return (
    <div className="pub" id="contenu">
      <h1>{token ? "Nouveau mot de passe" : "Mot de passe oublié"}</h1>
      <form className="card" onSubmit={go}>
        {err && <Notice kind="err">{err}</Notice>}{msg && <Notice kind="okk">{msg}</Notice>}
        {token ? <Field label="Nouveau mot de passe" hint="10 caractères minimum"><input type="password" minLength={10} required value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
          : <Field label="Adresse électronique"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>}
        <button className="primary">Valider</button>
      </form>
      <p className="small" style={{ marginTop: 12 }}><Link href="/login">Retour à la connexion</Link></p>
    </div>
  );
}
export default function Reset() { return <Suspense><Inner /></Suspense>; }
