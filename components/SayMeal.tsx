"use client";
import { useMemo, useState } from "react";
import { api, nf } from "@/lib/client";
import { Field, Notice, toast } from "@/components/ui";
import { parseNum, sumNutrients } from "@/lib/calc";
import { toAmount, lineNutrients, type FoodLite } from "@/lib/recipe-amount";
import type { Parsed } from "@/lib/recipe-parse";

type F = FoodLite & { id: string; private?: boolean };
type Cand = { food_key: string; score: number; food: F };
type Unit = "g" | "ml" | "portion";
type Row = { raw: string; parsed: Parsed; cands: Cand[]; food: F | null; amount: string; unit: Unit; approx: boolean; how: string; confidence: string; skip: boolean; seeking: boolean; est: { name: string; kcal: string; detail: boolean; p: string; c: string; l: string } };
export type SayItem = { food: F; qty: string; unit: Unit; approx: boolean };

const hasPortion = (f: F) => f.basis === "portion" || !!f.portion_g || !!f.portion_ml;
const fromPreview = (d: any): Row[] => d.lines.map((l: any): Row => {
  const food: F | null = l.chosen ? l.candidates.find((c: Cand) => c.food_key === l.chosen)?.food ?? null : null, a = l.amount;
  return { raw: l.raw, parsed: l.parsed, cands: l.candidates, food, amount: a && !a.negligible ? String(+a.qty.toFixed(1)) : a?.negligible ? "0" : "", unit: a?.unit ?? (food?.basis === "100ml" ? "ml" : "g"), approx: !!a?.approx || !a, how: a?.how ?? "", confidence: l.confidence, skip: !!a?.negligible, seeking: false,
    est: { name: l.parsed.name, kcal: "", detail: false, p: "", c: "", l: "" } };
});

/** « Dire ce que j'ai mangé » : on écrit comme on parle, l'application estime les quantités et calcule ; chaque ligne reste modifiable. */
export default function SayMeal({ onAdd, onUrl, onCategory }: { onAdd: (items: SayItem[]) => void; onUrl: (url: string) => void; onCategory?: (c: string) => void }) {
  const [text, setText] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null), [urls, setUrls] = useState<string[]>([]), [q, setQ] = useState(""), [found, setFound] = useState<any[]>([]);

  async function run() {
    setErr(null); setBusy(true);
    try {
      const d = await api("/meals/say/preview", { body: { text } });
      setUrls(d.urls ?? []); if (d.category) onCategory?.(d.category);
      setRows(d.lines.length ? fromPreview(d) : null);
      if (d.urls?.length && !d.lines.length) onUrl(d.urls[0]);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  const upd = (i: number, p: Partial<Row>) => setRows((r) => (r ? r.map((x, k) => (k === i ? { ...x, ...p } : x)) : r));
  function pickFood(i: number, food: F) {
    const r = rows![i], a = toAmount(r.parsed, food, { meal: true });
    upd(i, { food, seeking: false, skip: false, amount: a && !a.negligible ? String(+a.qty.toFixed(1)) : "", unit: a?.unit ?? (food.basis === "portion" ? "portion" : food.basis === "100ml" ? "ml" : "g"), approx: !a || !!a.approx, how: a?.how ?? "", confidence: "medium" });
  }
  async function search(v: string) { setQ(v); if (v.trim().length < 2) return setFound([]); setFound((await api(`/foods?q=${encodeURIComponent(v)}`)).foods.slice(0, 8)); }
  async function createFood(i: number) {
    const r = rows![i], e = r.est, kcal = parseNum(e.kcal);
    if (!e.name.trim() || kcal == null || kcal < 0) return setErr("Indiquez un nom et une estimation en calories pour une portion.");
    setErr(null);
    try {
      const body: any = { basis: "portion", name: e.name.trim(), kcal, portion_label: "1 portion" };
      if (e.detail) { body.protein = parseNum(e.p); body.carbs = parseNum(e.c); body.fat = parseNum(e.l); }
      const res = await api("/foods", { body });
      const food: F = { id: res.id, food_key: res.food_key, name: e.name.trim(), basis: "portion", portion_label: "1 portion", portion_g: null, portion_ml: null, density: null, kcal, kj: null, protein: body.protein ?? null, carbs: body.carbs ?? null, fat: body.fat ?? null, fiber: null, private: true };
      upd(i, { food, amount: String(r.parsed.qty ?? 1), unit: "portion", approx: true, how: "estimation saisie par vous, mémorisée pour la prochaine fois", confidence: "high" });
      toast("Aliment mémorisé : il sera reconnu la prochaine fois");
    } catch (x: any) { setErr(x.message); }
  }

  const calc = useMemo(() => {
    const parts: any[] = []; const items: SayItem[] = []; let missing = 0;
    for (const r of rows ?? []) {
      if (r.skip) continue;
      const n = parseNum(r.amount);
      if (!r.food || !n || n <= 0) { missing++; continue; }
      const c = lineNutrients(r.food, { qty: n, unit: r.unit }); if (!c) { missing++; continue; }
      parts.push(c); items.push({ food: r.food, qty: String(n), unit: r.unit, approx: r.approx });
    }
    return { totals: parts.length ? sumNutrients(parts) : null, items, missing };
  }, [rows]);

  function add() { onAdd(calc.items); setRows(null); setText(""); setUrls([]); setErr(null); }

  return <div>
    <p className="muted small" style={{ marginTop: 0 }}>Écrivez ce que vous avez mangé, comme vous le diriez. L’application reconnaît les aliments, estime les quantités et calcule ; vous corrigez si besoin.</p>
    {err && <Notice kind="err">{err}</Notice>}
    {!rows && <>
      <Field label="Qu’avez-vous mangé ?" hint="un repas ou juste un en-cas, ajoutez au fur et à mesure"><textarea rows={4} autoFocus placeholder={"2 œufs au plat, 2 tranches de pain complet, un café, une pomme\n\nou : une part de pizza et un coca\nou : l’adresse d’une recette"} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim() && !busy) run(); }} /></Field>
      <div className="row">
        <button className="primary" disabled={busy || !text.trim()} onClick={run}>{busy ? "Analyse…" : "Estimer"}</button>
        {urls.length === 0 && /https?:\/\//.test(text) && <span className="small muted">Une adresse web sera importée comme recette.</span>}
      </div>
      <p className="small muted">Exemples : « 100 g de riz, un steak, des haricots verts » · « un croissant et un café au lait » · « une grosse part de tarte ». Sans quantité, une portion usuelle est estimée.</p>
    </>}

    {rows && <>
      <div className="row spread" style={{ margin: "4px 0 8px" }}><b>Voici ce que j’ai compris</b><button className="ghost" onClick={() => { setRows(null); setErr(null); }}>← Modifier le texte</button></div>
      {urls.map((u) => <div className="notice" key={u} style={{ marginBottom: 8 }}>Adresse détectée : <b>{(() => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } })()}</b> <button onClick={() => onUrl(u)}>Importer cette recette</button></div>)}
      {rows.map((r, i) => {
        const n = r.food && !r.skip ? (() => { const a = parseNum(r.amount); return a && a > 0 ? lineNutrients(r.food!, { qty: a, unit: r.unit }) : null; })() : null;
        const need = !r.skip && !!r.food && !parseNum(r.amount);
        return <div className={`irow ${r.skip ? "off" : ""} ${need || !r.food && !r.skip ? "need" : ""}`} key={i}>
          <div className="row spread" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
            <span className="irow-raw">{r.raw}</span>
            <label className="chk" style={{ minHeight: 0, flex: "none" }}><input type="checkbox" checked={r.skip} onChange={(e) => upd(i, { skip: e.target.checked })} />retirer</label>
          </div>
          {!r.skip && r.food && <>
            <div className="irow-grid">
              <select aria-label={`Aliment pour « ${r.raw} »`} value={r.food.food_key} onChange={(e) => { const v = e.target.value; if (v === "__more") { upd(i, { seeking: true }); setQ(""); setFound([]); return; } if (v === "__none") { upd(i, { food: null, amount: "", approx: true }); return; } const c = r.cands.find((x) => x.food_key === v); if (c) pickFood(i, c.food); }}>
                {!r.cands.some((c) => c.food_key === r.food!.food_key) && <option value={r.food.food_key}>{r.food.name}</option>}
                {r.cands.map((c) => <option key={c.food_key} value={c.food_key}>{c.food.name}{c.food.private ? " (à moi)" : ""}</option>)}
                <option value="__more">Autre aliment…</option>
                <option value="__none">Aucun de ceux-là : ajouter mon estimation</option>
              </select>
              <div className="irow-q">
                <input inputMode="decimal" aria-label={`Quantité pour « ${r.raw} »`} value={r.amount} placeholder="?" onChange={(e) => upd(i, { amount: e.target.value, approx: false })} style={{ width: 84 }} />
                <select aria-label="Unité" value={r.unit} onChange={(e) => upd(i, { unit: e.target.value as Unit, approx: false })} style={{ width: 90 }}><option>g</option><option>ml</option>{hasPortion(r.food) && <option value="portion">portion</option>}</select>
                <div className="irow-kcal">{n?.kcal != null ? <b>{nf(n.kcal, 0)} kcal</b> : <span className="muted">—</span>}</div>
              </div>
            </div>
            <div className="small muted">
              {r.how && r.approx ? `${r.how}. ` : ""}{r.approx && !r.how ? "Quantité estimée. " : ""}
              {need && <span className="badge warn">quantité à préciser</span>} {!need && r.confidence === "low" && <span className="badge warn">à vérifier</span>}
            </div>
          </>}
          {!r.skip && !r.food && <div style={{ marginTop: 6 }}>
            <p className="small" style={{ margin: "0 0 6px" }}>Je ne connais pas encore cet aliment. Donnez une estimation : il sera mémorisé et reconnu la prochaine fois.</p>
            <div className="inline">
              <Field label="Nom"><input value={r.est.name} onChange={(e) => upd(i, { est: { ...r.est, name: e.target.value } })} /></Field>
              <Field label="Calories pour 1 portion" hint="même approximatives"><input inputMode="decimal" value={r.est.kcal} placeholder="ex. 350" onChange={(e) => upd(i, { est: { ...r.est, kcal: e.target.value } })} /></Field>
            </div>
            <label className="chk" style={{ minHeight: 0 }}><input type="checkbox" checked={r.est.detail} onChange={(e) => upd(i, { est: { ...r.est, detail: e.target.checked } })} />Je connais aussi protéines, glucides et lipides</label>
            {r.est.detail && <div className="inline num"><Field label="Protéines (g)"><input inputMode="decimal" value={r.est.p} onChange={(e) => upd(i, { est: { ...r.est, p: e.target.value } })} /></Field><Field label="Glucides (g)"><input inputMode="decimal" value={r.est.c} onChange={(e) => upd(i, { est: { ...r.est, c: e.target.value } })} /></Field><Field label="Lipides (g)"><input inputMode="decimal" value={r.est.l} onChange={(e) => upd(i, { est: { ...r.est, l: e.target.value } })} /></Field></div>}
            <div className="row"><button className="primary" onClick={() => createFood(i)}>Mémoriser cet aliment</button><button onClick={() => { upd(i, { seeking: true }); setQ(r.est.name); search(r.est.name); }}>Chercher dans mes aliments</button></div>
          </div>}
          {r.seeking && <div style={{ marginTop: 6 }}>
            <input type="search" autoFocus placeholder="Chercher dans mes aliments…" aria-label="Chercher un autre aliment" value={q} onChange={(e) => search(e.target.value)} />
            {found.map((f) => <div className="item" key={f.id}><div className="grow">{f.name} <span className="small muted">{nf(f.kcal, 0)} kcal/{f.basis === "portion" ? "portion" : f.basis === "100ml" ? "100 ml" : "100 g"}</span></div><button onClick={() => pickFood(i, { ...f, kcal_kj_only: f.kj, private: !!f.user_id })}>Choisir</button></div>)}
            <button className="ghost" onClick={() => upd(i, { seeking: false })}>Fermer</button>
          </div>}
        </div>;
      })}
      <div className="card" style={{ marginTop: 10 }}>
        <b>≈ {calc.totals?.kcal != null ? nf(calc.totals.kcal, 0) : "—"} kcal</b>{calc.totals && <> · P {nf(calc.totals.protein)} g · G {nf(calc.totals.carbs)} g · L {nf(calc.totals.fat)} g</>}
        <p className="small muted" style={{ margin: ".3rem 0 0" }}>Estimation : les quantités et valeurs sont des ordres de grandeur. Corrigez une ligne si vous connaissez la vraie quantité.</p>
        {calc.missing > 0 && <p className="small" style={{ margin: ".3rem 0 0" }}><span className="badge warn">{calc.missing} ligne{calc.missing > 1 ? "s" : ""} à compléter</span> Précisez, mémorisez l’aliment ou cochez « retirer ».</p>}
      </div>
      <div className="row" style={{ marginTop: 10 }}><button className="primary" disabled={!calc.items.length} onClick={add}>Ajouter au repas{calc.items.length ? ` (${calc.items.length})` : ""}</button></div>
    </>}
  </div>;
}
