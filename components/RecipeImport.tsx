"use client";
import { useMemo, useState } from "react";
import { api } from "@/lib/client";
import { Field, Modal, Notice, toast } from "@/components/ui";
import { nf } from "@/lib/client";
import { parseNum, sumNutrients } from "@/lib/calc";
import { toAmount, lineNutrients, type FoodLite } from "@/lib/recipe-amount";
import type { Parsed } from "@/lib/recipe-parse";

type Cand = { food_key: string; score: number; food: FoodLite & { private?: boolean } };
type Row = { raw: string; parsed: Parsed; cands: Cand[]; food: (FoodLite & { private?: boolean }) | null; amount: string; unit: "g" | "ml"; negligible: boolean; ignored: boolean; how: string; approx: boolean; confidence: string };

const fromPreview = (d: any): Row[] => d.lines.map((l: any): Row => {
  const food = l.chosen ? l.candidates.find((c: Cand) => c.food_key === l.chosen)?.food ?? null : null;
  const a = l.amount;
  return { raw: l.raw, parsed: l.parsed, cands: l.candidates, food, amount: a && !a.negligible ? String(+a.qty.toFixed(1)) : "", unit: a?.unit ?? (food?.basis === "100ml" ? "ml" : "g"), negligible: !!a?.negligible, ignored: !!l.parsed.optional, how: a?.how ?? "", approx: !!a?.approx, confidence: l.confidence };
});

export default function RecipeImport({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [mode, setMode] = useState<"url" | "text">("url"), [url, setUrl] = useState(""), [text, setText] = useState(""), [textTitle, setTextTitle] = useState(""), [textServ, setTextServ] = useState("");
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const [prev, setPrev] = useState<any | null>(null), [rows, setRows] = useState<Row[]>([]), [title, setTitle] = useState(""), [servings, setServings] = useState("4"), [keepSteps, setKeepSteps] = useState(false);
  const [more, setMore] = useState<number | null>(null), [q, setQ] = useState(""), [found, setFound] = useState<any[]>([]);

  async function analyse() {
    setErr(null); setBusy(true);
    try {
      const d = await api("/recipes/import/preview", { body: mode === "url" ? { url } : { text, title: textTitle, servings: textServ ? parseNum(textServ) : undefined } });
      setPrev(d); setRows(fromPreview(d)); setTitle(d.title); setServings(String(d.servings)); setKeepSteps(false); setMore(null);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  const upd = (i: number, p: Partial<Row>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...p } : x)));
  function pickFood(i: number, food: (FoodLite & { private?: boolean }) | null) {
    if (!food) return upd(i, { food: null, amount: "", ignored: true });
    const a = toAmount(rows[i].parsed, food);
    upd(i, { food, ignored: false, amount: a && !a.negligible ? String(+a.qty.toFixed(1)) : "", unit: a?.unit ?? (food.basis === "100ml" ? "ml" : "g"), negligible: !!a?.negligible, how: a?.how ?? "", approx: !!a?.approx, confidence: "medium" });
  }
  async function search(v: string) { setQ(v); if (v.trim().length < 2) return setFound([]); setFound((await api(`/foods?q=${encodeURIComponent(v)}`)).foods.slice(0, 8)); }

  const calc = useMemo(() => {
    const parts: any[] = []; let missing = 0, counted = 0;
    for (const r of rows) {
      if (r.ignored || r.negligible && !r.food) continue;
      const n = parseNum(r.amount);
      if (!r.food || !n || n <= 0) { if (!r.negligible) missing++; continue; }
      const c = lineNutrients(r.food, { qty: n, unit: r.unit }); if (c) { parts.push(c); counted++; } else missing++;
    }
    return { totals: parts.length ? sumNutrients(parts) : null, missing, counted };
  }, [rows]);
  const sv = parseNum(servings) || 1, perServ = calc.totals?.kcal != null ? calc.totals.kcal / sv : null;
  const rep = prev?.reported?.kcal ?? null, gap = rep && perServ ? (perServ - rep) / rep : null;
  const saveable = prev && title.trim() && calc.counted > 0 && calc.missing === 0;

  async function save() {
    setErr(null); setBusy(true);
    try {
      const ingredients = rows.filter((r) => !r.ignored && r.food && parseNum(r.amount)).map((r) => ({ key: r.food!.food_key, qty: parseNum(r.amount), unit: r.unit }));
      await api("/recipes", { body: { title: title.trim(), servings: sv, time_min: prev.time_min, tags: ["importée"], steps: keepSteps ? prev.steps : "", source_url: prev.source_url, ingredients } });
      toast("Recette enregistrée"); onSaved();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  if (!prev) return <Modal title="Importer une recette" onClose={onClose}>
    <p className="muted small" style={{ marginTop: 0 }}>Collez l’adresse d’une recette : l’application lit la liste des ingrédients, les rapproche de vos aliments et calcule les calories et les macros. <b>Vous vérifiez tout avant d’enregistrer.</b></p>
    <div className="chips" role="tablist" style={{ marginTop: 0 }}>
      <button type="button" role="tab" className="chip-b" aria-pressed={mode === "url"} onClick={() => setMode("url")}>Adresse web</button>
      <button type="button" role="tab" className="chip-b" aria-pressed={mode === "text"} onClick={() => setMode("text")}>Coller le texte</button>
    </div>
    {err && <div style={{ marginTop: 10 }}><Notice kind="err">{err}{mode === "url" && /Collez|Aucune recette|Impossible de joindre/.test(err) && <div style={{ marginTop: 6 }}><button onClick={() => { setMode("text"); setErr(null); }}>Coller la liste des ingrédients à la place</button></div>}</Notice></div>}
    {mode === "url" ? <>
      <Field label="Adresse de la recette" hint="l'adresse complète de la page"><input type="url" inputMode="url" autoFocus placeholder="https://www.marmiton.org/recettes/…" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && url.trim() && !busy && analyse()} /></Field>
      <p className="small muted">C’est le serveur de l’application qui télécharge la page, une seule fois : le site ne voit pas votre adresse IP. Rien n’est enregistré avant votre validation. Seuls les ingrédients et leurs quantités sont repris ; le texte de préparation reste sur le site (vous pouvez le conserver si vous le souhaitez, pour votre usage personnel). Certains sites refusent la lecture automatique : utilisez alors « Coller le texte ».</p>
    </> : <>
      <Field label="Liste des ingrédients" hint="un ingrédient par ligne"><textarea rows={7} autoFocus placeholder={"300 g de farine\n3 oeufs\n60 cl de lait\n2 c. à soupe de sucre"} value={text} onChange={(e) => setText(e.target.value)} /></Field>
      <div className="inline"><Field label="Titre" hint="facultatif"><input value={textTitle} onChange={(e) => setTextTitle(e.target.value)} /></Field><Field label="Portions" hint="facultatif"><input inputMode="decimal" value={textServ} onChange={(e) => setTextServ(e.target.value)} /></Field></div>
      <p className="small muted">Pratique quand un site bloque la lecture automatique : copiez la liste des ingrédients de la page et collez-la ici.</p>
    </>}
    <div className="row"><button className="primary" disabled={busy || (mode === "url" ? !url.trim() : !text.trim())} onClick={analyse}>{busy ? "Analyse en cours…" : "Analyser la recette"}</button><button onClick={onClose}>Annuler</button></div>
  </Modal>;

  return <Modal title="Vérifier la recette importée" onClose={onClose}>
    {err && <Notice kind="err">{err}</Notice>}
    <Field label="Titre"><input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
    <div className="inline"><Field label="Portions" hint={prev.servings_guess ? "non indiqué par la page : à vérifier" : prev.servings_label ?? undefined}><input inputMode="decimal" value={servings} onChange={(e) => setServings(e.target.value)} /></Field></div>
    {prev.source_host && <p className="small muted" style={{ marginTop: 0 }}>Source : <a href={prev.source_url} target="_blank" rel="noopener noreferrer nofollow">{prev.source_host} ↗</a>{prev.time_min ? ` · ${prev.time_min} min` : ""}</p>}
    <p className="small">Pour chaque ligne, vérifiez l’aliment proposé et la quantité convertie en grammes ou millilitres. Les valeurs des aliments génériques sont indicatives.</p>

    {rows.map((r, i) => {
      const n = r.food && !r.ignored ? (() => { const a = parseNum(r.amount); return a && a > 0 ? lineNutrients(r.food!, { qty: a, unit: r.unit }) : null; })() : null;
      const need = !r.ignored && !r.negligible && (!r.food || !parseNum(r.amount));
      return <div className={`irow ${r.ignored ? "off" : ""} ${need ? "need" : ""}`} key={i}>
        <div className="row spread" style={{ alignItems: "flex-start" }}>
          <span className="irow-raw">{r.raw.replace(/\s+/g, " ")}</span>
          <label className="chk" style={{ minHeight: 0, flex: "none" }}><input type="checkbox" checked={r.ignored} onChange={(e) => upd(i, { ignored: e.target.checked })} />ignorer</label>
        </div>
        {!r.ignored && r.negligible && !r.amount && <div className="small muted" style={{ marginTop: 2 }}>Assaisonnement : apport négligeable, non compté. <button className="ghost" onClick={() => upd(i, { negligible: false })}>Compter quand même</button></div>}
        {!r.ignored && !(r.negligible && !r.amount) && <>
          <div className="irow-grid">
            <select aria-label={`Aliment pour « ${r.raw} »`} value={r.food?.food_key ?? ""} onChange={(e) => { const v = e.target.value; if (v === "__more") { setMore(i); setQ(""); setFound([]); return; } pickFood(i, r.cands.find((c) => c.food_key === v)?.food ?? (r.food && r.food.food_key === v ? r.food : null)); }}>
              {!r.food && <option value="">— choisir un aliment —</option>}
              {r.food && !r.cands.some((c) => c.food_key === r.food!.food_key) && <option value={r.food.food_key}>{r.food.name}</option>}
              {r.cands.map((c) => <option key={c.food_key} value={c.food_key}>{c.food.name}{c.food.private ? " (à moi)" : ""}</option>)}
              <option value="__more">Autre aliment…</option>
            </select>
            <div className="irow-q">
              <input inputMode="decimal" aria-label={`Quantité pour « ${r.raw} »`} value={r.amount} placeholder="?" onChange={(e) => upd(i, { amount: e.target.value })} style={{ width: 84 }} />
              <select aria-label="Unité" value={r.unit} onChange={(e) => upd(i, { unit: e.target.value as "g" | "ml" })} style={{ width: 72 }}><option>g</option><option>ml</option></select>
              <div className="irow-kcal">{n?.kcal != null ? <b>{nf(n.kcal, 0)} kcal</b> : <span className="muted">—</span>}</div>
            </div>
          </div>
          <div className="small muted">
            {r.how && r.amount && (r.approx || /[×≈=]/.test(r.how)) ? `${r.how}${r.approx ? " (estimation)" : ""}. ` : ""}
            {need && <span className="badge warn">quantité à préciser</span>} {!need && r.confidence === "low" && <span className="badge warn">à vérifier</span>}
          </div>
          {more === i && <div style={{ marginTop: 6 }}>
            <input type="search" autoFocus placeholder="Chercher dans mes aliments…" aria-label="Chercher un autre aliment" value={q} onChange={(e) => search(e.target.value)} />
            {found.map((f) => <div className="item" key={f.id}><div className="grow">{f.name} <span className="small muted">{nf(f.kcal, 0)} kcal/100</span></div><button onClick={() => { pickFood(i, { ...f, kcal_kj_only: f.kj, private: !!f.user_id }); setMore(null); }}>Choisir</button></div>)}
            <button className="ghost" onClick={() => setMore(null)}>Fermer</button>
          </div>}
        </>}
      </div>;
    })}

    <div className="card" style={{ marginTop: 12 }}>
      <b>Total {calc.totals?.kcal != null ? nf(calc.totals.kcal, 0) : "—"} kcal</b>{calc.totals && <> · P {nf(calc.totals.protein)} g · G {nf(calc.totals.carbs)} g · L {nf(calc.totals.fat)} g</>}
      <div>Par portion ({nf(sv)}) : <b>{perServ != null ? nf(perServ, 0) : "—"} kcal</b>{calc.totals?.protein != null && <> · P {nf(calc.totals.protein / sv)} g · G {nf((calc.totals.carbs ?? 0) / sv)} g · L {nf((calc.totals.fat ?? 0) / sv)} g</>}</div>
      {rep != null && perServ != null && <p className="small" style={{ margin: ".4rem 0 0" }}>Le site indique {nf(rep, 0)} kcal par portion{prev.reported?.servingG ? ` (de ${nf(prev.reported.servingG, 0)} g)` : ""} : notre calcul donne {gap! >= 0 ? "+" : ""}{nf(gap! * 100, 0)} %. {Math.abs(gap!) > 0.25 && <b>Écart important : vérifiez les quantités et le nombre de portions.</b>}</p>}
      {calc.missing > 0 && <p className="small" style={{ margin: ".4rem 0 0" }}><span className="badge warn">{calc.missing} ligne{calc.missing > 1 ? "s" : ""} à compléter</span> Précisez la quantité, choisissez un aliment, ou cochez « ignorer » (le total sera alors sous-estimé).</p>}
    </div>
    {prev.steps && <label className="chk" style={{ margin: "10px 0" }}><input type="checkbox" checked={keepSteps} onChange={(e) => setKeepSteps(e.target.checked)} />Conserver aussi le texte de préparation de la page (usage personnel)</label>}
    <div className="row" style={{ marginTop: 10 }}><button className="primary" disabled={!saveable || busy} onClick={save}>Enregistrer la recette</button><button onClick={() => { setPrev(null); setErr(null); }}>Retour</button></div>
  </Modal>;
}
