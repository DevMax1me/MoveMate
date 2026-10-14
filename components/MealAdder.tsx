"use client";
import { useEffect, useMemo, useState } from "react";
import { api, nf } from "@/lib/client";
import { computeFood, recipePortion, CalcError, parseNum, type FoodBasis } from "@/lib/calc";
import { Field, Modal, Notice, Tabs, toast } from "./ui";

export const CATEGORIES = ["Petit-déjeuner", "Déjeuner", "Dîner", "Collation"];
type Food = FoodBasis & { id: string; food_key: string; name: string; brand: string | null; portion_label: string | null; favorite?: boolean; public: boolean; incomplete: boolean; source: string; kj: number | null };

export function FoodForm({ initial, onSaved, onCancel }: { initial?: Partial<Food> & { food_key?: string; version?: number }; onSaved: (key: string) => void; onCancel: () => void }) {
  const [f, setF] = useState<any>({ basis: "100g", name: "", brand: "", kcal: "", protein: "", carbs: "", fat: "", fiber: "", portion_g: "", portion_ml: "", portion_label: "", density: "", ...initial });
  const [err, setErr] = useState<string | null>(null), [warn, setWarn] = useState<string[]>([]);
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  async function save() {
    setErr(null);
    const body = { ...f, version: initial?.version, kcal: parseNum(f.kcal), kj: null, protein: parseNum(f.protein), carbs: parseNum(f.carbs), fat: parseNum(f.fat), fiber: parseNum(f.fiber), portion_g: parseNum(f.portion_g), portion_ml: parseNum(f.portion_ml), density: parseNum(f.density) };
    try {
      const r = initial?.food_key ? await api(`/foods/${initial.food_key}`, { method: "PUT", body }) : await api("/foods", { body });
      if (r.warnings?.length) { setWarn(r.warnings); toast("Enregistré avec avertissement"); }
      onSaved(r.food_key ?? initial?.food_key!);
    } catch (e: any) { setErr(e.message); }
  }
  const unit = f.basis === "100ml" ? "ml" : "g";
  return (
    <div>
      {err && <Notice kind="err">{err}</Notice>}{warn.map((w) => <Notice key={w}>{w}</Notice>)}
      <Field label="Nom"><input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
      <div className="inline"><Field label="Marque" hint="facultatif"><input value={f.brand ?? ""} onChange={(e) => set("brand", e.target.value)} /></Field>
        <Field label="Base"><select value={f.basis} onChange={(e) => set("basis", e.target.value)}><option value="100g">pour 100 g</option><option value="100ml">pour 100 ml</option><option value="portion">par portion</option></select></Field></div>
      <div className="inline"><Field label="Énergie (kcal)"><input inputMode="decimal" value={f.kcal ?? ""} onChange={(e) => set("kcal", e.target.value)} /></Field><Field label="Protéines (g)"><input inputMode="decimal" value={f.protein ?? ""} onChange={(e) => set("protein", e.target.value)} /></Field></div>
      <div className="inline"><Field label="Glucides (g)"><input inputMode="decimal" value={f.carbs ?? ""} onChange={(e) => set("carbs", e.target.value)} /></Field><Field label="Lipides (g)"><input inputMode="decimal" value={f.fat ?? ""} onChange={(e) => set("fat", e.target.value)} /></Field><Field label="Fibres (g)"><input inputMode="decimal" value={f.fiber ?? ""} onChange={(e) => set("fiber", e.target.value)} /></Field></div>
      <p className="small muted">Laissez vide ce qui est inconnu : une valeur absente n’est jamais comptée comme 0.</p>
      {f.basis !== "portion" && <div className="inline"><Field label={`Une portion équivaut à (${unit})`} hint="facultatif"><input inputMode="decimal" value={(f.basis === "100g" ? f.portion_g : f.portion_ml) ?? ""} onChange={(e) => set(f.basis === "100g" ? "portion_g" : "portion_ml", e.target.value)} /></Field>
        <Field label="Libellé de portion" hint="ex. 1 pot"><input value={f.portion_label ?? ""} onChange={(e) => set("portion_label", e.target.value)} /></Field>
        <Field label="Densité (g/ml)" hint="pour convertir g ↔ ml"><input inputMode="decimal" value={f.density ?? ""} onChange={(e) => set("density", e.target.value)} /></Field></div>}
      <div className="row"><button className="primary" onClick={save}>Enregistrer</button><button onClick={onCancel}>Annuler</button></div>
    </div>
  );
}

export default function MealAdder({ date, defaultCategory, onClose, onAdded }: { date: string; defaultCategory?: string; onClose: () => void; onAdded: () => void }) {
  const [tab, setTab] = useState<"fav" | "recent" | "search" | "recipes" | "new">("fav");
  const [q, setQ] = useState(""), [foods, setFoods] = useState<Food[]>([]), [recipes, setRecipes] = useState<any[]>([]);
  const [sel, setSel] = useState<{ kind: "food" | "recipe"; item: any } | null>(null);
  const [cat, setCat] = useState(defaultCategory ?? CATEGORIES[0]), [qty, setQty] = useState("1"), [unit, setUnit] = useState("portion"), [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null), [ext, setExt] = useState<{ products: any[]; unavailable?: boolean; message?: string } | null>(null), [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tab === "recipes") { api("/recipes").then((r) => setRecipes(r.recipes)); return; }
    if (tab === "new") return;
    const scope = tab === "fav" ? "fav" : tab === "recent" ? "recent" : "all";
    const t = setTimeout(() => api(`/foods?scope=${scope}&q=${encodeURIComponent(q)}`).then((r) => setFoods(r.foods)).catch(() => {}), 150);
    return () => clearTimeout(t);
  }, [tab, q]);

  function pick(kind: "food" | "recipe", item: any) {
    setSel({ kind, item }); setErr(null);
    if (kind === "recipe") { setUnit("portion"); setQty("1"); return; }
    const hasPortion = item.basis === "portion" || (item.basis === "100g" ? item.portion_g : item.portion_ml);
    if (hasPortion) { setUnit("portion"); setQty("1"); } else { setUnit(item.basis === "100ml" ? "ml" : "g"); setQty("100"); }
  }
  const preview = useMemo(() => {
    if (!sel) return null;
    const n = parseNum(qty);
    if (n == null || n <= 0) return { error: "Saisissez une quantité positive." };
    try {
      if (sel.kind === "food") return { c: computeFood(sel.item, n, unit as any) };
      const r = sel.item;
      return { c: recipePortion({ servings: r.servings, finalWeight: r.final_weight, totals: { ...r.totals, estimated: false } }, unit === "portion" ? { mode: "portion", fraction: n } : { mode: "grams", grams: n }) };
    } catch (e) { return { error: e instanceof CalcError ? e.message : "Calcul impossible." }; }
  }, [sel, qty, unit]);

  async function save() {
    if (!sel) return; setBusy(true); setErr(null);
    try {
      await api("/meals", { body: { date, category: cat, kind: sel.kind, food_id: sel.kind === "food" ? sel.item.id : undefined, recipe_id: sel.kind === "recipe" ? sel.item.id : undefined, qty: parseNum(qty), unit, note } });
      toast("Repas enregistré"); onAdded(); onClose();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  async function searchExt() { setExt(null); setExt(await api(`/foods-external?q=${encodeURIComponent(q)}`).catch((e) => ({ products: [], unavailable: true, message: e.message }))); }
  async function importExt(p: any) { try { const r = await api("/foods-import", { body: { product: p } }); const l = await api(`/foods?q=${encodeURIComponent(p.name)}`); const f = l.foods.find((x: Food) => x.food_key === r.food_key); if (f) pick("food", f); setExt(null); setTab("search"); } catch (e: any) { setErr(e.message); } }

  const unitOpts = sel?.kind === "food" ? [sel.item.basis === "100ml" ? "ml" : sel.item.basis === "portion" ? null : "g", sel.item.basis === "100g" && sel.item.density ? "ml" : sel.item.basis === "100ml" && sel.item.density ? "g" : null, "portion"].filter(Boolean) as string[] : ["portion", "g"];

  return (
    <Modal title={sel ? "Quantité" : "Ajouter un repas"} onClose={onClose}>
      {!sel ? <>
        <Tabs tabs={[["fav", "Favoris"], ["recent", "Récents"], ["search", "Rechercher"], ["recipes", "Recettes"], ["new", "Nouvel aliment"]]} value={tab} onChange={setTab} />
        {(tab === "search") && <div className="row"><input style={{ flex: 1 }} type="search" placeholder="Rechercher un aliment…" aria-label="Rechercher un aliment" value={q} onChange={(e) => setQ(e.target.value)} /><button onClick={searchExt} disabled={q.length < 2} title="Interroge Open Food Facts avec ce seul terme">Source externe</button></div>}
        {ext && <div className="stack" style={{ marginTop: 8 }}>{ext.unavailable ? <Notice>{ext.message}</Notice> : ext.products.length === 0 ? <p className="muted">Aucun résultat externe.</p> : ext.products.map((p, i) => <div className="item" key={i}><div className="grow"><b>{p.name}</b> <span className="muted small">{p.brand}</span><div className="small muted">{nf(p.kcal, 0)} kcal/100 g · Open Food Facts</div></div><button onClick={() => importExt(p)}>Copier</button></div>)}<p className="small muted">Seul le terme recherché est transmis à Open Food Facts (licence ODbL).</p></div>}
        {tab === "new" ? <FoodForm onCancel={() => setTab("search")} onSaved={async (key) => { const l = await api(`/foods?q=`); const f = l.foods.find((x: Food) => x.food_key === key); if (f) pick("food", f); }} />
          : tab === "recipes" ? (recipes.length ? recipes.map((r) => <div className="item" key={r.id}><div className="grow"><b>{r.title}</b><div className="small muted">{r.servings} portion(s){r.perServing?.kcal != null ? ` · ${nf(r.perServing.kcal, 0)} kcal/portion` : ""}</div></div><button onClick={() => pick("recipe", r)}>Choisir</button></div>) : <p className="empty">Aucune recette. Créez-en une depuis Alimentation → Recettes.</p>)
            : foods.length ? foods.map((f) => <div className="item" key={f.id}><div className="grow"><b>{f.name}</b> {f.brand && <span className="muted small">{f.brand}</span>}<div className="small muted">{nf(f.kcal, 0)} kcal/{f.basis === "portion" ? "portion" : f.basis === "100ml" ? "100 ml" : "100 g"}{f.incomplete ? " · macros incomplètes" : ""}{f.public ? "" : " · privé"}</div></div><button onClick={() => pick("food", f)}>Choisir</button></div>)
              : <p className="empty">{tab === "fav" ? "Aucun favori. Cherchez un aliment et ajoutez-le aux favoris depuis Alimentation → Aliments." : tab === "recent" ? "Aucun aliment récent." : "Aucun résultat. Créez un aliment privé avec « Nouvel aliment »."}</p>}
      </> : <>
        <p><b>{sel.item.name ?? sel.item.title}</b></p>
        {err && <Notice kind="err">{err}</Notice>}
        <div className="inline"><Field label="Quantité"><input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus /></Field>
          <Field label="Unité"><select value={unit} onChange={(e) => setUnit(e.target.value)}>{unitOpts.map((u) => <option key={u} value={u}>{u === "portion" ? (sel.item.portion_label ? `portion (${sel.item.portion_label})` : "portion") : u}</option>)}</select></Field></div>
        <Field label="Repas"><select value={cat} onChange={(e) => setCat(e.target.value)}>{[...new Set([cat, ...CATEGORIES])].map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Commentaire" hint="facultatif"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></Field>
        {preview && ("error" in preview ? <Notice>{preview.error}</Notice> : <div className="card" aria-live="polite"><b>{nf(preview.c!.kcal, 0)} kcal</b><span className="muted"> · P {nf(preview.c!.protein)} g · G {nf(preview.c!.carbs)} g · L {nf(preview.c!.fat)} g{preview.c!.fiber != null ? ` · fibres ${nf(preview.c!.fiber)} g` : ""}</span>{preview.c!.incomplete && <div><span className="badge warn">macros incomplètes</span></div>}{preview.c!.estimated && <div><span className="badge warn">énergie estimée (4P+4G+9L)</span></div>}</div>)}
        <div className="row" style={{ marginTop: 10 }}><button className="primary" onClick={save} disabled={busy || !preview || "error" in preview}>Enregistrer</button><button onClick={() => setSel(null)}>Retour</button></div>
      </>}
    </Modal>
  );
}
