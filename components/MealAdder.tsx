"use client";
import { useEffect, useMemo, useState } from "react";
import { api, nf, fmtShort } from "@/lib/client";
import { computeFood, recipePortion, sumNutrients, CalcError, parseNum, type Computed, type FoodBasis } from "@/lib/calc";
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

type BItem = { id: string; kind: "food" | "recipe"; item: any; qty: string; unit: string };
type Tab = "fav" | "recent" | "search" | "recipes" | "new" | "reuse";
const rid = () => Math.random().toString(36).slice(2, 9);
const unitsFor = (kind: "food" | "recipe", item: any): string[] => kind === "food" ? [item.basis === "100ml" ? "ml" : item.basis === "portion" ? null : "g", item.basis === "100g" && item.density ? "ml" : item.basis === "100ml" && item.density ? "g" : null, "portion"].filter(Boolean) as string[] : ["portion", "g"];
const defaultQty = (kind: "food" | "recipe", item: any): [string, string] => {
  if (kind === "recipe") return ["1", "portion"];
  const hasPortion = item.basis === "portion" || (item.basis === "100g" ? item.portion_g : item.portion_ml);
  return hasPortion ? ["1", "portion"] : [item.basis === "100ml" ? "100" : "100", item.basis === "100ml" ? "ml" : "g"];
};
/** Même règles de calcul que le serveur (lib/calc) pour l'aperçu ; le serveur recalcule toujours à l'enregistrement. */
function compute(kind: "food" | "recipe", item: any, qty: string, unit: string): { c: Computed } | { error: string } {
  const n = parseNum(qty);
  if (n == null || n <= 0) return { error: "Saisissez une quantité positive." };
  try {
    if (kind === "food") return { c: computeFood(item, n, unit as any) };
    return { c: recipePortion({ servings: item.servings, finalWeight: item.final_weight, totals: { ...item.totals, estimated: false } }, unit === "portion" ? { mode: "portion", fraction: n } : { mode: "grams", grams: n }) };
  } catch (e) { return { error: e instanceof CalcError ? e.message : "Calcul impossible." }; }
}
const nameOf = (b: BItem) => b.item.name ?? b.item.title;
/** Aide à la saisie : repère les quantités probablement erronées (ex. 150 portions au lieu de 150 g). Ne bloque jamais l'enregistrement. */
function unusual(unit: string, qty: string, c?: Computed): string | null {
  const n = parseNum(qty);
  if (n == null) return null;
  if (unit === "portion" && n > 10) return `${nf(n)} portions : vous vouliez peut-être des grammes ?`;
  if ((unit === "g" || unit === "ml") && n > 2000) return `${nf(n)} ${unit} : quantité très élevée, vérifiez.`;
  if (c?.kcal != null && c.kcal > 3000) return `${nf(c.kcal, 0)} kcal pour un seul élément : vérifiez la quantité.`;
  return null;
}

export default function MealAdder({ date, defaultCategory, onClose, onAdded }: { date: string; defaultCategory?: string; onClose: () => void; onAdded: () => void }) {
  const [cat, setCat] = useState(defaultCategory ?? CATEGORIES[0]), [custom, setCustom] = useState(false);
  const [basket, setBasket] = useState<BItem[]>([]);
  const [tab, setTab] = useState<Tab>("fav");
  const [q, setQ] = useState(""), [foods, setFoods] = useState<Food[]>([]), [recipes, setRecipes] = useState<any[]>([]);
  const [sel, setSel] = useState<{ kind: "food" | "recipe"; item: any } | null>(null), [qty, setQty] = useState("1"), [unit, setUnit] = useState("portion");
  const [tpls, setTpls] = useState<any[] | null>(null), [recents, setRecents] = useState<any[] | null>(null);
  const [saveTpl, setSaveTpl] = useState(false), [tplName, setTplName] = useState("");
  const [err, setErr] = useState<string | null>(null), [ext, setExt] = useState<{ products: any[]; unavailable?: boolean; message?: string } | null>(null), [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tab === "recipes") { api("/recipes").then((r) => setRecipes(r.recipes)); return; }
    if (tab === "reuse") { api("/meal-templates").then((r) => setTpls(r.templates)).catch(() => setTpls([])); api("/meals-recent").then((r) => setRecents(r.meals)).catch(() => setRecents([])); return; }
    if (tab === "new") return;
    const scope = tab === "fav" ? "fav" : tab === "recent" ? "recent" : "all";
    const t = setTimeout(() => api(`/foods?scope=${scope}&q=${encodeURIComponent(q)}`).then((r) => setFoods(r.foods)).catch(() => {}), 150);
    return () => clearTimeout(t);
  }, [tab, q]);

  function pick(kind: "food" | "recipe", item: any) { setSel({ kind, item }); setErr(null); const [dq, du] = defaultQty(kind, item); setQty(dq); setUnit(du); }
  const preview = useMemo(() => (sel ? compute(sel.kind, sel.item, qty, unit) : null), [sel, qty, unit]);
  function addToBasket() { if (!sel || !preview || "error" in preview) return; setBasket([...basket, { id: rid(), kind: sel.kind, item: sel.item, qty, unit }]); setSel(null); toast(`${sel.item.name ?? sel.item.title} ajouté au repas`); }
  function loadItems(items: any[], category?: string) {
    const add: BItem[] = items.filter((i) => i.food || i.recipe).map((i) => ({ id: rid(), kind: i.kind, item: i.food ?? i.recipe, qty: String(i.qty), unit: i.unit }));
    if (!add.length) return setErr("Les éléments de ce repas ne sont plus disponibles.");
    if (!basket.length && category) { setCat(category); setCustom(!CATEGORIES.includes(category)); }
    setBasket([...basket, ...add]); setErr(null); toast(`${add.length} élément${add.length > 1 ? "s" : ""} ajouté${add.length > 1 ? "s" : ""} : ajustez les quantités si besoin`);
  }
  const rows = basket.map((b) => ({ b, r: compute(b.kind, b.item, b.qty, b.unit) }));
  const bad = rows.some((x) => "error" in x.r);
  const tot = sumNutrients(rows.filter((x): x is { b: BItem; r: { c: Computed } } => "c" in x.r).map((x) => x.r.c));

  async function save() {
    if (!basket.length || bad) return; setBusy(true); setErr(null);
    try {
      await api("/meals-batch", { body: { date, category: cat.trim() || "Repas", template_name: saveTpl ? (tplName.trim() || cat) : undefined, items: basket.map((b) => ({ kind: b.kind, food_id: b.kind === "food" ? b.item.id : undefined, recipe_id: b.kind === "recipe" ? b.item.id : undefined, qty: parseNum(b.qty), unit: b.unit })) } });
      toast(`${cat} enregistré${saveTpl ? " et mémorisé comme repas type" : ""}`); onAdded(); onClose();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  async function searchExt() { setExt(null); setExt(await api(`/foods-external?q=${encodeURIComponent(q)}`).catch((e) => ({ products: [], unavailable: true, message: e.message }))); }
  async function importExt(p: any) { try { const r = await api("/foods-import", { body: { product: p } }); const l = await api(`/foods?q=${encodeURIComponent(p.name)}`); const f = l.foods.find((x: Food) => x.food_key === r.food_key); if (f) pick("food", f); setExt(null); setTab("search"); } catch (e: any) { setErr(e.message); } }

  return (
    <Modal title="Ajouter un repas" onClose={onClose}>
      {err && <Notice kind="err">{err}</Notice>}
      <div className="field"><label>Quel repas ?</label>
        <div className="chips" role="radiogroup" aria-label="Catégorie du repas">
          {CATEGORIES.map((c) => <button type="button" key={c} role="radio" aria-checked={!custom && cat === c} className="chip-b" onClick={() => { setCat(c); setCustom(false); }}>{c}</button>)}
          <button type="button" role="radio" aria-checked={custom} className="chip-b" onClick={() => { setCustom(true); setCat(""); }}>Autre…</button>
        </div>
        {custom && <input style={{ marginTop: 8 }} aria-label="Nom du repas" placeholder="Repas de nuit, Avant l’entraînement…" value={cat} onChange={(e) => setCat(e.target.value)} maxLength={40} autoFocus />}
      </div>

      <div className="card basket" style={{ margin: "6px 0 14px" }}>
        <div className="row spread"><b>Dans ce repas</b><span className="small muted">{basket.length ? `${basket.length} élément${basket.length > 1 ? "s" : ""}` : "vide"}</span></div>
        {!basket.length && <p className="small muted" style={{ marginTop: 6 }}>Ajoutez vos aliments et recettes un par un, ou reprenez un repas déjà fait (onglet « Repas déjà faits »).</p>}
        {rows.map(({ b, r }) => (
          <div className="item" key={b.id} style={{ display: "block" }}>
            <div className="row spread" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
              <b style={{ minWidth: 0 }}>{nameOf(b)}</b>
              <button className="ghost" style={{ minHeight: 34, minWidth: 34, padding: 0 }} aria-label={`Retirer ${nameOf(b)}`} onClick={() => setBasket(basket.filter((x) => x.id !== b.id))}>✕</button>
            </div>
            <div className="row" style={{ gap: ".5rem", marginTop: 2 }}>
              <input style={{ width: 88, minHeight: 42, padding: ".3rem .7rem" }} inputMode="decimal" aria-label={`Quantité de ${nameOf(b)}`} value={b.qty} onChange={(e) => setBasket(basket.map((x) => (x.id === b.id ? { ...x, qty: e.target.value } : x)))} />
              <select style={{ width: 118, minHeight: 42, padding: ".3rem .7rem" }} aria-label={`Unité de ${nameOf(b)}`} value={b.unit} onChange={(e) => setBasket(basket.map((x) => (x.id === b.id ? { ...x, unit: e.target.value } : x)))}>{unitsFor(b.kind, b.item).map((u) => <option key={u} value={u}>{u === "portion" ? (b.item.portion_label ? `portion (${b.item.portion_label})` : "portion") : u}</option>)}</select>
              <span className="small muted">{"c" in r ? <>{nf(r.c.kcal, 0)} kcal{r.c.incomplete ? " · macros incomplètes" : ""}</> : r.error}</span>
            </div>
            {"c" in r && unusual(b.unit, b.qty, r.c) && <div className="small" style={{ color: "var(--warn)", fontWeight: 650, marginTop: 4 }}>⚠ {unusual(b.unit, b.qty, r.c)}</div>}
          </div>))}
        {basket.length > 0 && <div style={{ marginTop: 8 }}><b>{nf(tot.kcal, 0)} kcal</b><span className="muted"> · P {nf(tot.protein)} g · G {nf(tot.carbs)} g · L {nf(tot.fat)} g</span>{tot.incomplete && <> <span className="badge warn">macros incomplètes</span></>}</div>}
      </div>

      {!sel ? <>
        <h3 style={{ marginTop: 0 }}>Ajouter à ce repas</h3>
        <Tabs tabs={[["fav", "Favoris"], ["recent", "Récents"], ["search", "Rechercher"], ["recipes", "Recettes"], ["reuse", "Repas déjà faits"], ["new", "Nouvel aliment"]]} value={tab} onChange={setTab} />
        {(tab === "search") && <div className="row"><input style={{ flex: 1 }} type="search" placeholder="Rechercher un aliment…" aria-label="Rechercher un aliment" value={q} onChange={(e) => setQ(e.target.value)} /><button onClick={searchExt} disabled={q.length < 2} title="Interroge Open Food Facts avec ce seul terme">Source externe</button></div>}
        {ext && <div className="stack" style={{ marginTop: 8 }}>{ext.unavailable ? <Notice>{ext.message}</Notice> : ext.products.length === 0 ? <p className="muted">Aucun résultat externe.</p> : ext.products.map((p, i) => <div className="item" key={i}><div className="grow"><b>{p.name}</b> <span className="muted small">{p.brand}</span><div className="small muted">{nf(p.kcal, 0)} kcal/100 g · Open Food Facts</div></div><button onClick={() => importExt(p)}>Copier</button></div>)}<p className="small muted">Seul le terme recherché est transmis à Open Food Facts (licence ODbL).</p></div>}
        {tab === "new" ? <FoodForm onCancel={() => setTab("search")} onSaved={async (key) => { const l = await api(`/foods?q=`); const f = l.foods.find((x: Food) => x.food_key === key); if (f) pick("food", f); }} />
          : tab === "reuse" ? <div>
              <h3>Mes repas types</h3>
              {tpls === null ? <p className="muted">Chargement…</p> : tpls.length === 0 ? <p className="small muted">Aucun repas type pour l’instant. Cochez « Mémoriser comme repas type » en enregistrant un repas, ou mémorisez-en un depuis le journal.</p> : tpls.map((t) => <div className="item" key={t.id}><div className="grow"><b>{t.name}</b> <span className="badge">{t.category}</span><div className="small muted">{t.count} élément{t.count > 1 ? "s" : ""}{t.kcal != null ? ` · ${nf(t.kcal, 0)} kcal` : ""}{t.missing ? ` · ${t.missing} indisponible(s)` : ""}</div></div><button onClick={() => loadItems(t.items, t.category)}>Utiliser</button><button className="ghost" aria-label={`Supprimer le repas type ${t.name}`} onClick={async () => { await api(`/meal-templates/${t.id}`, { method: "DELETE" }); setTpls(tpls.filter((x) => x.id !== t.id)); }}>✕</button></div>)}
              <h3>Repas récents</h3>
              {recents === null ? <p className="muted">Chargement…</p> : recents.length === 0 ? <p className="small muted">Vos prochains repas apparaîtront ici pour être repris en un geste.</p> : recents.map((m, i) => <div className="item" key={i}><div className="grow"><b>{m.category}</b> <span className="small muted">{fmtShort(m.date)}{m.kcal != null ? ` · ${nf(m.kcal, 0)} kcal` : ""}</span><div className="small muted">{m.label}</div></div><button onClick={() => loadItems(m.items, m.category)}>Reprendre</button></div>)}
              <p className="small muted">Les aliments reprennent leurs valeurs actuelles ; les quantités d’origine restent modifiables avant d’enregistrer.</p>
            </div>
          : tab === "recipes" ? (recipes.length ? recipes.map((r) => <div className="item" key={r.id}><div className="grow"><b>{r.title}</b><div className="small muted">{r.servings} portion(s){r.perServing?.kcal != null ? ` · ${nf(r.perServing.kcal, 0)} kcal/portion` : ""}</div></div><button onClick={() => pick("recipe", r)}>Choisir</button></div>) : <p className="empty">Aucune recette. Créez-en une depuis Alimentation → Recettes.</p>)
            : foods.length ? foods.map((f) => <div className="item" key={f.id}><div className="grow"><b>{f.name}</b> {f.brand && <span className="muted small">{f.brand}</span>}<div className="small muted">{nf(f.kcal, 0)} kcal/{f.basis === "portion" ? "portion" : f.basis === "100ml" ? "100 ml" : "100 g"}{f.incomplete ? " · macros incomplètes" : ""}{f.public ? "" : " · privé"}</div></div><button onClick={() => pick("food", f)}>Choisir</button></div>)
              : <p className="empty">{tab === "fav" ? "Aucun favori. Cherchez un aliment et ajoutez-le aux favoris depuis Alimentation → Aliments." : tab === "recent" ? "Aucun aliment récent." : "Aucun résultat. Créez un aliment privé avec « Nouvel aliment »."}</p>}
      </> : <>
        <h3 style={{ marginTop: 0 }}>{sel.item.name ?? sel.item.title}</h3>
        <div className="inline num"><Field label="Quantité"><input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus /></Field>
          <Field label="Unité"><select value={unit} onChange={(e) => setUnit(e.target.value)}>{unitsFor(sel.kind, sel.item).map((u) => <option key={u} value={u}>{u === "portion" ? (sel.item.portion_label ? `portion (${sel.item.portion_label})` : "portion") : u}</option>)}</select></Field></div>
        {preview && "c" in preview && unusual(unit, qty, preview.c) && <Notice>{unusual(unit, qty, preview.c)}</Notice>}
        {preview && ("error" in preview ? <Notice>{preview.error}</Notice> : <div className="card" aria-live="polite"><b>{nf(preview.c.kcal, 0)} kcal</b><span className="muted"> · P {nf(preview.c.protein)} g · G {nf(preview.c.carbs)} g · L {nf(preview.c.fat)} g{preview.c.fiber != null ? ` · fibres ${nf(preview.c.fiber)} g` : ""}</span>{preview.c.incomplete && <div><span className="badge warn">macros incomplètes</span></div>}{preview.c.estimated && <div><span className="badge warn">énergie estimée (4P+4G+9L)</span></div>}</div>)}
        <div className="row" style={{ marginTop: 10 }}><button className="primary" onClick={addToBasket} disabled={!preview || "error" in preview}>Ajouter au repas</button><button onClick={() => setSel(null)}>Annuler</button></div>
      </>}

      <div className="savebar" style={{ marginTop: 18, bottom: 0, borderRadius: 26, padding: "10px 10px 10px 16px", flexDirection: "column", alignItems: "stretch", gap: 6 }}>
        {saveTpl && <input aria-label="Nom du repas type" placeholder={`Nom, par ex. « ${cat || "Déjeuner"} habituel »`} value={tplName} onChange={(e) => setTplName(e.target.value)} maxLength={80} />}
        <div className="row spread" style={{ flexWrap: "nowrap" }}>
          <label className="chk" style={{ minHeight: 40, flex: "1 1 auto", fontSize: ".9rem", fontWeight: 600 }}><input type="checkbox" checked={saveTpl} onChange={(e) => setSaveTpl(e.target.checked)} />Repas type</label>
          <button className="primary" style={{ flex: "none" }} onClick={save} disabled={busy || !basket.length || bad || !cat.trim()}>{busy ? "Enregistrement…" : basket.length ? `Enregistrer · ${basket.length}` : "Ajoutez un élément"}</button>
        </div>
      </div>
    </Modal>
  );
}
