"use client";
import { useState } from "react";
import { api, useApi, fmtDate, shiftDate, nf } from "@/lib/client";
import { useMe } from "@/components/Shell";
import { DayCard } from "@/components/DayMeals";
import MealAdder, { FoodForm } from "@/components/MealAdder";
import { ErrorBox, Empty, Field, Loading, Modal, Notice, Tabs, toast } from "@/components/ui";
import { computeFood, sumNutrients, recipePortion, parseNum } from "@/lib/calc";

export default function Food() {
  const [tab, setTab] = useState<"journal" | "foods" | "recipes">("journal");
  return <div><h1>Alimentation</h1><Tabs tabs={[["journal", "Journal"], ["foods", "Aliments"], ["recipes", "Recettes"]]} value={tab} onChange={setTab} />
    {tab === "journal" ? <Journal /> : tab === "foods" ? <Foods /> : <Recipes />}</div>;
}

function Journal() {
  const me = useMe();
  const [date, setDate] = useState(me.today);
  const { data, error, loading, reload } = useApi<any>(`/meals?date=${date}`);
  const [adding, setAdding] = useState<string | null | undefined>(undefined);
  return <div>
    <div className="row spread"><input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ width: "auto" }} aria-label="Date du journal" />
      <div className="row"><button onClick={() => setDate(shiftDate(date, -1))} aria-label="Jour précédent">‹</button><button onClick={() => setDate(me.today)}>Aujourd’hui</button><button onClick={() => setDate(shiftDate(date, 1))} aria-label="Jour suivant">›</button></div></div>
    <p className="muted cap">{fmtDate(date)}</p>
    {error && <ErrorBox error={error} retry={reload} />}
    {data ? <DayCard day={data} date={date} reload={reload} onAdd={(c) => setAdding(c ?? null)} /> : loading ? <Loading /> : null}
    {adding !== undefined && <MealAdder date={date} defaultCategory={adding ?? undefined} onClose={() => setAdding(undefined)} onAdded={reload} />}
  </div>;
}

function Foods() {
  const [q, setQ] = useState(""), [scope, setScope] = useState("all");
  const { data, error, reload } = useApi<any>(`/foods?scope=${scope}&q=${encodeURIComponent(q)}`);
  const [form, setForm] = useState<any | null | false>(false);
  async function act(fn: () => Promise<any>, msg: string) { try { await fn(); toast(msg); reload(); } catch (e: any) { toast(e.message); } }
  return <div>
    <div className="row"><input style={{ flex: 1 }} type="search" placeholder="Rechercher…" aria-label="Rechercher un aliment" value={q} onChange={(e) => setQ(e.target.value)} />
      <select style={{ width: "auto" }} value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Filtre"><option value="all">Tous</option><option value="mine">Mes aliments</option><option value="fav">Favoris</option></select>
      <button className="primary" onClick={() => setForm(null)}>＋ Aliment</button></div>
    {error && <ErrorBox error={error} retry={reload} />}
    <div className="card" style={{ marginTop: 10 }}>
      {data?.foods.length === 0 && <Empty>Aucun aliment trouvé.</Empty>}
      {data?.foods.map((f: any) => <div className="item" key={f.id}>
        <button className="ghost" aria-pressed={f.favorite} aria-label={f.favorite ? "Retirer des favoris" : "Ajouter aux favoris"} onClick={() => act(() => api(`/foods/${f.food_key}/favorite`, { body: { favorite: !f.favorite } }), f.favorite ? "Retiré des favoris" : "Ajouté aux favoris")}>{f.favorite ? "★" : "☆"}</button>
        <div className="grow"><b>{f.name}</b> <span className="muted small">{f.brand}</span>
          <div className="small muted">{nf(f.kcal, 0)} kcal · P {nf(f.protein)} · G {nf(f.carbs)} · L {nf(f.fat)} /{f.basis === "portion" ? "portion" : f.basis === "100ml" ? "100 ml" : "100 g"} · v{f.version}</div>
          <div className="small muted">{f.public ? "Catalogue public" : "Privé"} — {f.source}</div></div>
        {f.public ? <button onClick={() => act(() => api(`/foods/${f.food_key}/copy`, { body: {} }), "Copie privée créée : vous pouvez la corriger")}>Copie privée</button> : <><button onClick={() => setForm(f)}>Modifier</button><button className="danger" onClick={() => act(() => api(`/foods/${f.food_key}`, { method: "DELETE" }), "Archivé")} aria-label="Archiver">✕</button></>}
      </div>)}
    </div>
    {form !== false && <Modal title={form ? "Modifier l’aliment" : "Nouvel aliment privé"} onClose={() => setForm(false)}>
      {form && <Notice kind="info">La modification crée une nouvelle version : vos repas déjà enregistrés gardent leurs valeurs.</Notice>}
      <FoodForm initial={form ?? undefined} onCancel={() => setForm(false)} onSaved={() => { setForm(false); reload(); }} /></Modal>}
  </div>;
}

type Ing = { food: any; qty: string; unit: string };
function Recipes() {
  const { data, error, reload } = useApi<any>("/recipes");
  const [edit, setEdit] = useState<any | null | false>(false);
  return <div>
    <div className="row spread"><p className="muted">Les recettes sont privées. Modifier une recette crée une nouvelle version pour les usages futurs.</p><button className="primary" onClick={() => setEdit(null)}>＋ Recette</button></div>
    {error && <ErrorBox error={error} retry={reload} />}
    {data?.recipes.length === 0 && <Empty>Aucune recette. Créez-en une à partir de vos aliments.</Empty>}
    <div className="grid g2">{data?.recipes.map((r: any) => <div className="card" key={r.id}>
      <div className="row spread"><b>{r.title}</b><span className="badge">v{r.version}</span></div>
      <p className="small muted">{r.servings} portion(s){r.time_min ? ` · ${r.time_min} min` : ""}{r.tags.length ? ` · ${r.tags.join(", ")}` : ""}</p>
      <p>{r.perServing?.kcal != null ? <><b>{nf(r.perServing.kcal, 0)} kcal</b> / portion · P {nf(r.perServing.protein)} g</> : "—"}{r.totals.incomplete && <> <span className="badge warn">macros incomplètes</span></>}</p>
      <div className="row"><button onClick={() => setEdit(r)}>Modifier</button><button className="danger" onClick={async () => { await api(`/recipes/${r.recipe_key}`, { method: "DELETE" }); toast("Archivée"); reload(); }}>Archiver</button></div></div>)}</div>
    {edit !== false && <Modal title={edit ? "Modifier la recette" : "Nouvelle recette"} onClose={() => setEdit(false)}><RecipeEditor recipe={edit} onDone={() => { setEdit(false); reload(); }} /></Modal>}
  </div>;
}

function RecipeEditor({ recipe, onDone }: { recipe: any | null; onDone: () => void }) {
  const [title, setTitle] = useState(recipe?.title ?? ""), [servings, setServings] = useState(String(recipe?.servings ?? 1)), [fw, setFw] = useState(recipe?.final_weight ? String(recipe.final_weight) : ""), [time, setTime] = useState(recipe?.time_min ? String(recipe.time_min) : "");
  const [tags, setTags] = useState((recipe?.tags ?? []).join(", ")), [steps, setSteps] = useState(recipe?.steps ?? "");
  const [ings, setIngs] = useState<Ing[]>((recipe?.ingredients ?? []).map((i: any) => ({ food: { id: i.food_id, name: i.name, loading: true }, qty: String(i.qty), unit: i.unit })));
  const [q, setQ] = useState(""), [res, setRes] = useState<any[]>([]), [err, setErr] = useState<string | null>(null);
  async function search(v: string) { setQ(v); if (v.length < 2) return setRes([]); setRes((await api(`/foods?q=${encodeURIComponent(v)}`)).foods.slice(0, 8)); }
  const totals = (() => { try { const parts = ings.filter((i) => i.food.basis && parseNum(i.qty)).map((i) => computeFood(i.food, parseNum(i.qty)!, i.unit as any)); return parts.length ? sumNutrients(parts) : null; } catch { return null; } })();
  const sv = parseNum(servings) || 1;
  async function save() {
    setErr(null);
    try {
      const body = { version: recipe?.version, title, servings: parseNum(servings), final_weight: parseNum(fw), time_min: parseNum(time), tags: tags.split(",").map((t: string) => t.trim()).filter(Boolean), steps, ingredients: ings.map((i) => ({ food_id: i.food.id, qty: parseNum(i.qty), unit: i.unit })) };
      if (recipe) await api(`/recipes/${recipe.recipe_key}`, { method: "PUT", body }); else await api("/recipes", { body });
      toast("Recette enregistrée"); onDone();
    } catch (e: any) { setErr(e.message); }
  }
  return <div>
    {err && <Notice kind="err">{err}</Notice>}
    <Field label="Titre"><input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
    <div className="inline"><Field label="Portions"><input inputMode="decimal" value={servings} onChange={(e) => setServings(e.target.value)} /></Field><Field label="Poids final cuit (g)" hint="facultatif"><input inputMode="decimal" value={fw} onChange={(e) => setFw(e.target.value)} /></Field><Field label="Temps (min)"><input inputMode="numeric" value={time} onChange={(e) => setTime(e.target.value)} /></Field></div>
    <Field label="Étiquettes" hint="séparées par des virgules : rapide, à emporter…"><input value={tags} onChange={(e) => setTags(e.target.value)} /></Field>
    <h3>Ingrédients</h3>
    {ings.map((i, k) => <div className="item" key={k}><div className="grow">{i.food.name}</div>
      <input style={{ width: 80 }} inputMode="decimal" aria-label={`Quantité ${i.food.name}`} value={i.qty} onChange={(e) => setIngs(ings.map((x, j) => (j === k ? { ...x, qty: e.target.value } : x)))} />
      <select style={{ width: 90 }} aria-label="Unité" value={i.unit} onChange={(e) => setIngs(ings.map((x, j) => (j === k ? { ...x, unit: e.target.value } : x)))}><option>g</option><option>ml</option><option value="portion">portion</option></select>
      <button className="ghost" aria-label="Retirer" onClick={() => setIngs(ings.filter((_, j) => j !== k))}>✕</button></div>)}
    <input type="search" placeholder="Ajouter un ingrédient…" aria-label="Ajouter un ingrédient" value={q} onChange={(e) => search(e.target.value)} />
    {res.map((f) => <div className="item" key={f.id}><div className="grow">{f.name} <span className="small muted">{nf(f.kcal, 0)} kcal/100</span></div><button onClick={() => { setIngs([...ings, { food: f, qty: "100", unit: f.basis === "100ml" ? "ml" : f.basis === "portion" ? "portion" : "g" }]); setQ(""); setRes([]); }}>Ajouter</button></div>)}
    <p className="small muted">Une huile, une sauce ou un accompagnement consommé doit être compté ici ou ajouté au repas : vérifiez les quantités.</p>
    {totals && <div className="card"><b>Total {nf(totals.kcal, 0)} kcal</b> · P {nf(totals.protein)} g<br /><span className="small">Par portion ({nf(sv)}) : <b>{nf(totals.kcal == null ? null : totals.kcal / sv, 0)} kcal</b>{fw && parseNum(fw) ? ` · pour 100 g cuit : ${nf(totals.kcal == null ? null : (totals.kcal / parseNum(fw)!) * 100, 0)} kcal` : " · sans poids final, la saisie en grammes sera refusée"}</span></div>}
    <Field label="Étapes" hint="facultatif"><textarea value={steps} onChange={(e) => setSteps(e.target.value)} /></Field>
    <div className="row"><button className="primary" onClick={save}>Enregistrer</button><button onClick={onDone}>Annuler</button></div>
    {void recipePortion}
  </div>;
}
