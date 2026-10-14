"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { parseNum } from "@/lib/calc";
import { Field, Notice, toast } from "./ui";

export default function WeightForm({ date, onSaved }: { date: string; onSaved: () => void }) {
  const [kg, setKg] = useState(""), [note, setNote] = useState(""), [ctx, setCtx] = useState(""), [err, setErr] = useState<string | null>(null), [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    try { const v = parseNum(kg); if (v == null) throw new Error("Saisissez un poids en kg (la virgule est acceptée)."); await api("/weights", { body: { date, kg: v, note, context: ctx } }); setKg(""); setNote(""); toast("Pesée enregistrée"); onSaved(); }
    catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }
  return <form onSubmit={save}>
    {err && <Notice kind="err">{err}</Notice>}
    <div className="inline"><Field label="Poids (kg)"><input inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="72,4" /></Field>
      <Field label="Repère" hint="facultatif"><select value={ctx} onChange={(e) => setCtx(e.target.value)}><option value="">—</option><option value="matin">matin</option><option value="soir">soir</option><option value="après séance">après séance</option></select></Field></div>
    <Field label="Commentaire" hint="facultatif : contexte d'une fluctuation"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></Field>
    <button className="primary" disabled={busy || !kg}>Enregistrer la pesée</button>
  </form>;
}
