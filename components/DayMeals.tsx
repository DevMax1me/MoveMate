"use client";
import { useState } from "react";
import { api, nf, shiftDate, fmtDate } from "@/lib/client";
import { Field, Modal, Notice, toast } from "./ui";
import { parseNum } from "@/lib/calc";

export const STATE_LABEL: Record<string, [string, string]> = { non_renseignee: ["non renseignée", ""], partielle: ["partielle", "warn"], terminee: ["terminée", "ok"] };

export function DayCard({ day, date, reload, onAdd }: { day: any; date: string; reload: () => void; onAdd: (cat?: string) => void }) {
  const [edit, setEdit] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const t = day.totals;
  const groups: Record<string, any[]> = {};
  for (const e of day.entries) (groups[e.category] ??= []).push(e);
  const [lbl, kind] = STATE_LABEL[day.state];
  async function act(fn: () => Promise<any>, msg?: string) { setErr(null); try { await fn(); if (msg) toast(msg); reload(); } catch (e: any) { setErr(e.message); } }
  async function copyPrev() { await act(async () => { const r = await api("/meals-copy", { body: { from: shiftDate(date, -1), to: date } }); if (!r.copied) throw new Error("Rien à copier depuis la veille."); }, "Journée de la veille copiée"); }
  return (
    <div className="card">
      <div className="row spread"><h2 style={{ margin: 0 }}>Repas</h2><span className={`badge ${kind}`}>Journée {lbl}</span></div>
      {err && <Notice kind="err">{err}</Notice>}
      <div className="grid g3" style={{ margin: ".6rem 0" }}>
        <div><div className="big">{nf(t.kcal, 0)}<span className="unit">kcal</span></div><div className="small muted">{day.goal?.kcal != null ? `cible ${nf(day.goal.kcal, 0)} kcal` : "aucune cible"}</div></div>
        <div><div className="big">{day.remaining == null ? "—" : nf(Math.abs(day.remaining), 0)}<span className="unit">{day.remaining == null ? "" : day.remaining < 0 ? "kcal de dépassement" : "kcal restantes"}</span></div></div>
        <div className="small"><div>Protéines <b>{nf(t.protein)}</b> g{day.goal?.protein ? ` / ${nf(day.goal.protein, 0)}` : ""}</div><div>Glucides <b>{nf(t.carbs)}</b> g{day.goal?.carbs ? ` / ${nf(day.goal.carbs, 0)}` : ""}</div><div>Lipides <b>{nf(t.fat)}</b> g{day.goal?.fat ? ` / ${nf(day.goal.fat, 0)}` : ""}</div></div>
      </div>
      {day.macrosIncomplete && day.entries.length > 0 && <p><span className="badge warn">macros incomplètes</span> <span className="small muted">Les valeurs inconnues ne sont pas comptées comme 0 : ces totaux sont des minimums connus.</span></p>}
      {day.estimated && <p><span className="badge warn">dont énergie estimée</span></p>}
      {day.entries.length === 0 ? <div className="empty">Aucun repas noté pour ce jour. <div style={{ marginTop: 8 }}><button className="primary" onClick={() => onAdd()}>Ajouter un repas</button> <button onClick={copyPrev}>Copier la veille</button></div></div> :
        Object.entries(groups).map(([c, es]) => (
          <div key={c}><h3>{c}</h3>
            {es.map((e) => <div className="item" key={e.id}>
              <button className="ghost grow" style={{ justifyContent: "flex-start", textAlign: "left", padding: 0 }} onClick={() => setEdit(e)} aria-label={`Modifier ${e.label}`}>
                <span><b>{e.label}</b> <span className="muted small">{nf(e.qty)} {e.unit === "portion" ? "portion(s)" : e.unit}</span>{e.incomplete ? <> <span className="badge warn">macros incomplètes</span></> : null}</span></button>
              <span className="nowrap small">{nf(e.kcal, 0)} kcal</span></div>)}
          </div>))}
      {day.entries.length > 0 && <div className="row" style={{ marginTop: 10 }}>
        <button className="primary" onClick={() => onAdd()}>＋ Ajouter</button>
        {day.closed ? <button onClick={() => act(() => api(`/days/${date}/close`, { body: { closed: false } }), "Journée rouverte")}>Rouvrir la journée</button> : <button onClick={() => act(() => api(`/days/${date}/close`, { body: { closed: true } }), "Journée marquée terminée")}>Marquer la journée terminée</button>}
      </div>}
      {edit && <Modal title={edit.label} onClose={() => setEdit(null)}>
        <EditMeal e={edit} date={date} onDone={() => { setEdit(null); reload(); }} />
      </Modal>}
    </div>
  );
}

function EditMeal({ e, date, onDone }: { e: any; date: string; onDone: () => void }) {
  const [qty, setQty] = useState(String(e.qty)), [cat, setCat] = useState(e.category), [note, setNote] = useState(e.note ?? ""), [to, setTo] = useState(date), [err, setErr] = useState<string | null>(null), [confirmDel, setConfirmDel] = useState(false);
  const run = async (fn: () => Promise<any>, msg: string) => { setErr(null); try { await fn(); toast(msg); onDone(); } catch (x: any) { setErr(x.message); } };
  return <div>
    {err && <Notice kind="err">{err}</Notice>}
    <p className="muted small">{nf(e.kcal, 0)} kcal · valeurs figées au moment de l’enregistrement.{e.recalculated_at ? " Recalculé explicitement." : ""}</p>
    <div className="inline"><Field label={`Quantité (${e.unit})`}><input inputMode="decimal" value={qty} onChange={(x) => setQty(x.target.value)} /></Field><Field label="Repas"><input value={cat} onChange={(x) => setCat(x.target.value)} /></Field></div>
    <Field label="Commentaire"><input value={note} onChange={(x) => setNote(x.target.value)} /></Field>
    <div className="row"><button className="primary" onClick={() => run(() => api(`/meals/${e.id}`, { method: "PUT", body: { qty: parseNum(qty), category: cat, note } }), "Modifié")}>Enregistrer</button>
      {!confirmDel ? <button className="danger" onClick={() => setConfirmDel(true)}>Supprimer</button> : <button className="danger" onClick={() => run(() => api(`/meals/${e.id}`, { method: "DELETE" }), "Supprimé")}>Confirmer la suppression</button>}</div>
    <h3>Dupliquer vers une autre date</h3>
    <div className="row"><input type="date" value={to} onChange={(x) => setTo(x.target.value)} style={{ width: "auto" }} aria-label="Date cible" /><button onClick={() => run(() => api(`/meals/${e.id}/duplicate`, { body: { date: to } }), `Dupliqué le ${fmtDate(to)}`)}>Dupliquer</button></div>
    <h3>Recalcul avec la dernière version</h3>
    <p className="small muted">Si l’aliment ou la recette a été modifié depuis, vous pouvez recalculer ce repas. L’action est tracée.</p>
    <button onClick={() => run(() => api(`/meals/${e.id}/recalc`, { body: {} }), "Recalculé")}>Recalculer ce repas</button>
  </div>;
}
