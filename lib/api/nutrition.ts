import { Router, bad, notFound, str, num, numOrNull, dateStr, J, P, checkVersion } from "../http";
import { all, get, run, tx, uid, nowIso, audit } from "../db";
import { computeFood, recipePortion, sumNutrients, dayState, validateFood, remaining, goalCoherence, CalcError, type FoodBasis, type Computed, type Unit } from "../calc";
import { ApiError, type User } from "../auth";

export type FoodRow = FoodBasis & { id: string; food_key: string; version: number; user_id: string | null; name: string; brand: string | null; kj: number | null; portion_label: string | null; source: string; license: string | null; archived: number };
export type RecipeRow = { id: string; recipe_key: string; version: number; user_id: string; title: string; servings: number; final_weight: number | null; time_min: number | null; tags: string; steps: string | null; ingredients: string; favorite: number; archived: number; source_url: string | null };
type Ing = { food_id: string; qty: number; unit: Unit };

const toBasis = (f: FoodRow): FoodBasis => ({ ...f, kcal_kj_only: f.kj });

export function latestFood(userId: string, key: string): FoodRow | undefined {
  return get<FoodRow>("SELECT * FROM foods WHERE food_key=? AND (user_id IS NULL OR user_id=?) ORDER BY version DESC LIMIT 1", key, userId);
}
export function foodById(userId: string, id: string): FoodRow | undefined {
  return get<FoodRow>("SELECT * FROM foods WHERE id=? AND (user_id IS NULL OR user_id=?)", id, userId);
}
export function latestRecipe(userId: string, key: string): RecipeRow | undefined {
  return get<RecipeRow>("SELECT * FROM recipes WHERE recipe_key=? AND user_id=? ORDER BY version DESC LIMIT 1", key, userId);
}

export function recipeTotals(userId: string, r: Pick<RecipeRow, "ingredients">): Computed & { n: number; withKcal: number } {
  const ings = P<Ing[]>(r.ingredients, []);
  const parts = ings.map((i) => {
    const f = foodById(userId, i.food_id);
    if (!f) throw bad("Ingrédient introuvable.");
    return computeFood(toBasis(f), i.qty, i.unit);
  });
  return sumNutrients(parts);
}

function foodInput(b: any, source: string): Omit<FoodRow, "id" | "food_key" | "version" | "user_id" | "archived" | "license"> & { warnings: string[] } {
  const basis = b.basis;
  if (!["100g", "100ml", "portion"].includes(basis)) throw bad("Base invalide (100 g, 100 ml ou portion).");
  const o = { min: 0 };
  const f = {
    name: str(b.name, "Nom", 120), brand: str(b.brand, "Marque", 80, false) || null, basis,
    portion_g: numOrNull(b.portion_g, "Portion (g)", { min: 0.1 }), portion_ml: numOrNull(b.portion_ml, "Portion (ml)", { min: 0.1 }),
    portion_label: str(b.portion_label, "Libellé de portion", 60, false) || null, density: numOrNull(b.density, "Densité", { min: 0.1, max: 25 }),
    kcal: numOrNull(b.kcal, "Énergie (kcal)", o), kj: numOrNull(b.kj, "Énergie (kJ)", o),
    protein: numOrNull(b.protein, "Protéines", o), carbs: numOrNull(b.carbs, "Glucides", o), fat: numOrNull(b.fat, "Lipides", o), fiber: numOrNull(b.fiber, "Fibres", o),
    source,
  };
  if (f.kcal == null && f.kj == null && (f.protein == null || f.carbs == null || f.fat == null)) throw bad("Renseignez l'énergie, ou protéines + glucides + lipides.");
  const warnings = validateFood({ ...f, kcal_kj_only: f.kj });
  return { ...f, warnings };
}

function insertFood(userId: string, key: string, version: number, f: ReturnType<typeof foodInput>, license: string | null) {
  const id = uid();
  run(`INSERT INTO foods(id,food_key,version,user_id,name,brand,basis,portion_g,portion_ml,portion_label,density,kcal,kj,protein,carbs,fat,fiber,source,license,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, key, version, userId, f.name, f.brand, f.basis, f.portion_g, f.portion_ml, f.portion_label, f.density, f.kcal, f.kj, f.protein, f.carbs, f.fat, f.fiber, f.source, license, nowIso());
  return id;
}

const recipeOut = (user: User, rr: RecipeRow) => {
  const ings = P<Ing[]>(rr.ingredients, []).map((i) => { const f = foodById(user.id, i.food_id); return { ...i, name: f?.name ?? "?" }; });
  const totals = recipeTotals(user.id, rr);
  return { ...rr, tags: P(rr.tags, []), ingredients: ings, totals: { kcal: totals.kcal, protein: totals.protein, carbs: totals.carbs, fat: totals.fat, fiber: totals.fiber, incomplete: totals.incomplete },
    perServing: rr.servings ? { kcal: totals.kcal == null ? null : totals.kcal / rr.servings, protein: totals.protein == null ? null : totals.protein / rr.servings } : null };
};

const foodOut = (f: FoodRow & { favorite?: number | null }) => ({ ...f, public: f.user_id == null, incomplete: f.protein == null || f.carbs == null || f.fat == null });

// ---------- Journée ----------
export function activeGoal(userId: string, date: string) {
  return get<any>("SELECT * FROM goals WHERE user_id=? AND start_date<=? AND (end_date IS NULL OR end_date>=?) ORDER BY start_date DESC LIMIT 1", userId, date, date);
}
export function dayInfo(userId: string, date: string) {
  const entries = all<any>("SELECT * FROM meals WHERE user_id=? AND date=? ORDER BY created_at", userId, date);
  const closed = !!get<any>("SELECT closed FROM day_status WHERE user_id=? AND date=?", userId, date)?.closed;
  const comps: Computed[] = entries.map((e) => ({ kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat, fiber: e.fiber, incomplete: !!e.incomplete, estimated: !!e.estimated }));
  const t = sumNutrients(comps);
  const goal = activeGoal(userId, date);
  const state = dayState(entries.length, closed);
  return {
    date, entries, state, closed,
    totals: { kcal: t.kcal, protein: t.protein, carbs: t.carbs, fat: t.fat, fiber: t.fiber },
    kcalComplete: entries.length > 0 && entries.every((e) => e.kcal != null),
    proteinComplete: entries.length > 0 && entries.every((e) => e.protein != null),
    macrosIncomplete: t.incomplete, estimated: t.estimated,
    goal, remaining: goal?.kcal != null ? remaining(goal.kcal, t.kcal) : null,
  };
}


type TItem = { kind: "food" | "recipe"; key: string; qty: number; unit: Unit; label: string };
const templateItem = (s: { kind: "food" | "recipe"; ref_id: string; qty: number; unit: Unit; label: string }): TItem => ({
  kind: s.kind, key: s.kind === "food" ? get<any>("SELECT food_key k FROM foods WHERE id=?", s.ref_id)?.k : get<any>("SELECT recipe_key k FROM recipes WHERE id=?", s.ref_id)?.k, qty: s.qty, unit: s.unit, label: s.label });
/** Entrée de journal → élément réutilisable (par clé : on repart des dernières versions de l'aliment ou de la recette). */
const entryItem = (m: any): TItem | null => { const t = templateItem({ kind: m.kind, ref_id: m.ref_id, qty: m.qty, unit: m.unit, label: m.label }); return t.key ? t : null; };
/** Éléments résolus avec l'aliment ou la recette actuels : le client calcule l'aperçu avec les mêmes règles que le serveur. */
function expandItems(user: User, items: TItem[]) {
  const out: (TItem & { food?: any; recipe?: any })[] = [];
  for (const it of items) {
    if (it.kind === "food") { const f = latestFood(user.id, it.key); if (f) out.push({ ...it, food: { ...f, public: f.user_id == null, incomplete: f.protein == null || f.carbs == null || f.fat == null } }); }
    else { const r = latestRecipe(user.id, it.key); if (r && !r.archived) out.push({ ...it, recipe: recipeOut(user, r) }); }
  }
  return out;
}

function snapshot(user: User, b: any) {
  const kind: "food" | "recipe" = b.kind === "recipe" ? "recipe" : "food";
  const qty = num(b.qty, "Quantité", { min: 0.0001 });
  const unit = (b.unit ?? "g") as Unit;
  if (!["g", "ml", "portion"].includes(unit)) throw bad("Unité invalide.");
  if (kind === "food") {
    const f = b.food_id ? foodById(user.id, str(b.food_id, "Aliment")) : latestFood(user.id, str(b.key, "Aliment"));
    if (!f) throw notFound("Aliment introuvable.");
    const c = computeFood(toBasis(f), qty, unit);
    return { kind, ref_id: f.id, label: f.name + (f.brand ? ` (${f.brand})` : ""), qty, unit, c: b.approx === true ? { ...c, estimated: true } : c }; // approx : quantité estimée (saisie libre) → énergie marquée « estimée »
  }
  const r = b.recipe_id ? get<RecipeRow>("SELECT * FROM recipes WHERE id=? AND user_id=?", str(b.recipe_id, "Recette"), user.id) : latestRecipe(user.id, str(b.key, "Recette"));
  if (!r) throw notFound("Recette introuvable.");
  const totals = recipeTotals(user.id, r);
  const c = recipePortion({ servings: r.servings, finalWeight: r.final_weight, totals }, unit === "portion" ? { mode: "portion", fraction: qty } : { mode: "grams", grams: qty });
  return { kind, ref_id: r.id, label: r.title, qty, unit, c: b.approx === true ? { ...c, estimated: true } : c };
}

const sourceUrl = (v: unknown): string | null => { if (!v) return null; try { const u = new URL(String(v)); return /^https?:$/.test(u.protocol) && !u.username && !u.password ? u.toString().slice(0, 500) : null; } catch { return null; } };
export const recipeInput = (user: User, b: any) => {
  const ings = (Array.isArray(b.ingredients) ? b.ingredients : []).map((i: any) => {
    const f = i.food_id ? foodById(user.id, String(i.food_id)) : latestFood(user.id, String(i.key ?? ""));
    if (!f) throw bad("Ingrédient introuvable.");
    const unit = (i.unit ?? "g") as Unit;
    computeFood(toBasis(f), num(i.qty, "Quantité d'ingrédient", { min: 0.0001 }), unit); // valide l'unité
    return { food_id: f.id, qty: num(i.qty, "Quantité d'ingrédient"), unit };
  });
  if (!ings.length) throw bad("Ajoutez au moins un ingrédient.");
  return {
    title: str(b.title, "Titre", 120), servings: num(b.servings ?? 1, "Portions", { min: 0.5, max: 100 }), final_weight: numOrNull(b.final_weight, "Poids final", { min: 1 }),
    time_min: numOrNull(b.time_min, "Temps", { min: 0, max: 1440 }), tags: J((Array.isArray(b.tags) ? b.tags : []).slice(0, 12).map((t: unknown) => String(t).slice(0, 30))),
    steps: str(b.steps, "Étapes", 5000, false) || null, ingredients: J(ings), source_url: sourceUrl(b.source_url),
  };
};

export function mountNutrition(r: Router) {
  // --- aliments ---
  r.get("/foods", ({ user, query }) => {
    const q = (query.get("q") ?? "").trim().toLowerCase();
    const scope = query.get("scope") ?? "all";
    const rows = all<FoodRow & { favorite: number | null; last_used: string | null }>(
      `SELECT f.*, p.favorite, p.last_used FROM foods f
       LEFT JOIN food_prefs p ON p.food_key=f.food_key AND p.user_id=?
       WHERE (f.user_id IS NULL OR f.user_id=?) AND f.archived=0
         AND f.version=(SELECT MAX(version) FROM foods x WHERE x.food_key=f.food_key AND (x.user_id IS NULL OR x.user_id=?))
       ORDER BY f.name`, user.id, user.id, user.id);
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    let out = rows.filter((f) => !q || norm(f.name + " " + (f.brand ?? "")).includes(norm(q)));
    if (scope === "mine") out = out.filter((f) => f.user_id === user.id);
    if (scope === "fav") out = out.filter((f) => f.favorite);
    if (scope === "recent") out = out.filter((f) => f.last_used).sort((a, b) => (b.last_used! > a.last_used! ? 1 : -1));
    return { foods: out.slice(0, 100).map((f) => ({ ...foodOut(f), favorite: !!f.favorite })) };
  });
  r.post("/foods", ({ user, body }) => {
    const f = foodInput(body, "Saisie manuelle");
    const key = "u-" + uid();
    const id = insertFood(user.id, key, 1, f, null);
    return { id, food_key: key, warnings: f.warnings };
  });
  r.put("/foods/:key", ({ user, params, body }) => {
    const cur = latestFood(user.id, params[0]);
    if (!cur) throw notFound();
    if (cur.user_id !== user.id) throw bad("Aliment public : créez une copie privée pour le corriger.");
    checkVersion(body, cur.version);
    const f = foodInput(body, cur.source);
    const id = insertFood(user.id, cur.food_key, cur.version + 1, f, cur.license);
    return { id, version: cur.version + 1, warnings: f.warnings }; // version immuable : les anciennes entrées gardent leurs valeurs
  });
  r.post("/foods/:key/copy", ({ user, params }) => {
    const cur = latestFood(user.id, params[0]);
    if (!cur) throw notFound();
    const key = "u-" + uid();
    const id = uid();
    run(`INSERT INTO foods(id,food_key,version,user_id,name,brand,basis,portion_g,portion_ml,portion_label,density,kcal,kj,protein,carbs,fat,fiber,source,license,created_at)
      SELECT ?,?,1,?,name,brand,basis,portion_g,portion_ml,portion_label,density,kcal,kj,protein,carbs,fat,fiber,?,license,? FROM foods WHERE id=?`,
      id, key, user.id, `Copie privée de « ${cur.name} » (${cur.source})`, nowIso(), cur.id);
    return { id, food_key: key };
  });
  r.post("/foods/:key/favorite", ({ user, params, body }) => {
    if (!latestFood(user.id, params[0])) throw notFound();
    run(`INSERT INTO food_prefs(user_id,food_key,favorite) VALUES(?,?,?) ON CONFLICT(user_id,food_key) DO UPDATE SET favorite=excluded.favorite`, user.id, params[0], body.favorite === false ? 0 : 1);
  });
  r.del("/foods/:key", ({ user, params }) => {
    const cur = latestFood(user.id, params[0]);
    if (!cur || cur.user_id !== user.id) throw notFound();
    run("UPDATE foods SET archived=1 WHERE food_key=? AND user_id=?", params[0], user.id); // archivé : reste référencé par l'historique
  });
  // Source externe : déclenchée explicitement, seul le terme recherché est transmis (NUT 01).
  r.get("/foods-external", async ({ query }) => {
    const q = (query.get("q") ?? "").trim();
    if (q.length < 2) throw bad("Saisissez au moins 2 caractères.");
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 6000);
      const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=15&fields=code,product_name,brands,nutriments`, { signal: ctl.signal, headers: { "User-Agent": "Terminator/1.1 (suivi alimentaire)" } });
      clearTimeout(t);
      if (!res.ok) throw new Error("status " + res.status);
      const data: any = await res.json();
      const products = (data.products ?? []).filter((p: any) => p.product_name).map((p: any) => {
        const n = p.nutriments ?? {};
        return { code: p.code, name: p.product_name, brand: p.brands ?? null, kcal: n["energy-kcal_100g"] ?? null, kj: n["energy-kj_100g"] ?? null, protein: n.proteins_100g ?? null, carbs: n.carbohydrates_100g ?? null, fat: n.fat_100g ?? null, fiber: n.fiber_100g ?? null };
      });
      return { products, source: "Open Food Facts (ODbL)" };
    } catch {
      return { products: [], unavailable: true, message: "Source externe indisponible ou limitée. Vos aliments enregistrés et la saisie manuelle restent utilisables." };
    }
  });
  r.post("/foods-import", ({ user, body }) => {
    const p = body.product ?? {};
    const f = foodInput({ basis: "100g", name: p.name, brand: p.brand, kcal: p.kcal, kj: p.kcal == null ? p.kj : null, protein: p.protein, carbs: p.carbs, fat: p.fat, fiber: p.fiber }, `Open Food Facts${p.code ? " #" + String(p.code).slice(0, 20) : ""}`);
    const key = "u-" + uid();
    const id = insertFood(user.id, key, 1, f, "ODbL / DbCL (Open Food Facts)");
    return { id, food_key: key, warnings: f.warnings };
  });

  // --- repas ---
  r.get("/meals", ({ user, query }) => dayInfo(user.id, dateStr(query.get("date"))));
  r.post("/meals", ({ user, body }) => {
    const date = dateStr(body.date);
    const cat = str(body.category, "Catégorie", 40);
    const s = snapshot(user, body);
    const id = uid();
    tx(() => {
      run(`INSERT INTO meals(id,user_id,date,category,kind,ref_id,label,qty,unit,note,kcal,protein,carbs,fat,fiber,incomplete,estimated,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, user.id, date, cat, s.kind, s.ref_id, s.label, s.qty, s.unit, str(body.note, "Commentaire", 300, false) || null,
        s.c.kcal, s.c.protein, s.c.carbs, s.c.fat, s.c.fiber, +s.c.incomplete, +s.c.estimated, nowIso());
      // Modifier une journée clôturée lui rend le statut partiel (NUT 04).
      run("UPDATE day_status SET closed=0 WHERE user_id=? AND date=?", user.id, date);
      if (s.kind === "food") {
        const f = foodById(user.id, s.ref_id)!;
        run(`INSERT INTO food_prefs(user_id,food_key,last_used) VALUES(?,?,?) ON CONFLICT(user_id,food_key) DO UPDATE SET last_used=excluded.last_used`, user.id, f.food_key, nowIso());
      }
    });
    return { id };
  });
  r.put("/meals/:id", ({ user, params, body }) => {
    const m = get<any>("SELECT * FROM meals WHERE id=? AND user_id=?", params[0], user.id);
    if (!m) throw notFound();
    const s = snapshot(user, { kind: m.kind, food_id: m.kind === "food" ? m.ref_id : undefined, recipe_id: m.kind === "recipe" ? m.ref_id : undefined, qty: body.qty ?? m.qty, unit: body.unit ?? m.unit });
    const date = body.date ? dateStr(body.date) : m.date;
    run("UPDATE meals SET qty=?,unit=?,kcal=?,protein=?,carbs=?,fat=?,fiber=?,incomplete=?,estimated=?,category=?,note=?,date=? WHERE id=?",
      s.qty, s.unit, s.c.kcal, s.c.protein, s.c.carbs, s.c.fat, s.c.fiber, +s.c.incomplete, +s.c.estimated, body.category ? str(body.category, "Catégorie", 40) : m.category, body.note !== undefined ? str(body.note, "Commentaire", 300, false) || null : m.note, date, m.id);
    run("UPDATE day_status SET closed=0 WHERE user_id=? AND date IN (?,?)", user.id, m.date, date);
  });
  r.del("/meals/:id", ({ user, params }) => {
    const m = get<any>("SELECT date FROM meals WHERE id=? AND user_id=?", params[0], user.id);
    if (!m) throw notFound();
    run("DELETE FROM meals WHERE id=?", params[0]);
    run("UPDATE day_status SET closed=0 WHERE user_id=? AND date=?", user.id, m.date);
  });
  r.post("/meals/:id/duplicate", ({ user, params, body }) => {
    const m = get<any>("SELECT * FROM meals WHERE id=? AND user_id=?", params[0], user.id);
    if (!m) throw notFound();
    const id = uid();
    run(`INSERT INTO meals(id,user_id,date,category,kind,ref_id,label,qty,unit,note,kcal,protein,carbs,fat,fiber,incomplete,estimated,created_at)
      SELECT ?,user_id,?,category,kind,ref_id,label,qty,unit,note,kcal,protein,carbs,fat,fiber,incomplete,estimated,? FROM meals WHERE id=?`, id, dateStr(body.date), nowIso(), m.id);
    return { id };
  });
  r.post("/meals-copy", ({ user, body }) => {
    const from = dateStr(body.from), to = dateStr(body.to);
    const cat = body.category ? str(body.category, "Catégorie", 40) : null;
    const toCat = body.to_category ? str(body.to_category, "Catégorie", 40) : null; // réutiliser un « déjeuner » complet comme « dîner », par exemple
    const rows = all<any>(`SELECT id FROM meals WHERE user_id=? AND date=? ${cat ? "AND category=?" : ""}`, ...(cat ? [user.id, from, cat] : [user.id, from]));
    tx(() => { rows.forEach((x) => run(`INSERT INTO meals(id,user_id,date,category,kind,ref_id,label,qty,unit,note,kcal,protein,carbs,fat,fiber,incomplete,estimated,created_at)
      SELECT ?,user_id,?,COALESCE(?,category),kind,ref_id,label,qty,unit,note,kcal,protein,carbs,fat,fiber,incomplete,estimated,? FROM meals WHERE id=?`, uid(), to, toCat, nowIso(), x.id)); run("UPDATE day_status SET closed=0 WHERE user_id=? AND date=?", user.id, to); });
    return { copied: rows.length };
  });
  // Recalcul explicite et tracé avec la dernière version (REC 03).
  r.post("/meals/:id/recalc", ({ user, params }) => {
    const m = get<any>("SELECT * FROM meals WHERE id=? AND user_id=?", params[0], user.id);
    if (!m) throw notFound();
    let key: string | undefined;
    if (m.kind === "food") key = get<any>("SELECT food_key k FROM foods WHERE id=?", m.ref_id)?.k;
    else key = get<any>("SELECT recipe_key k FROM recipes WHERE id=?", m.ref_id)?.k;
    if (!key) throw notFound();
    const s = snapshot(user, { kind: m.kind, key, qty: m.qty, unit: m.unit });
    run("UPDATE meals SET ref_id=?,label=?,kcal=?,protein=?,carbs=?,fat=?,fiber=?,incomplete=?,estimated=?,recalculated_at=? WHERE id=?",
      s.ref_id, s.label, s.c.kcal, s.c.protein, s.c.carbs, s.c.fat, s.c.fiber, +s.c.incomplete, +s.c.estimated, nowIso(), m.id);
    audit(user.id, user.id, "meal_recalculated", m.id);
  });

  // ---------- repas composés (une catégorie, plusieurs aliments) ----------
  // Un « repas » = une date + une catégorie. On y ajoute plusieurs aliments ou recettes d'un seul geste ; tout est calculé côté serveur.
  r.post("/meals-batch", ({ user, body }) => {
    const date = dateStr(body.date);
    const cat = str(body.category, "Catégorie", 40);
    const raw = Array.isArray(body.items) ? body.items.slice(0, 60) : [];
    if (!raw.length) throw bad("Ajoutez au moins un aliment ou une recette au repas.");
    const snaps: { s: ReturnType<typeof snapshot>; note: string | null }[] = raw.map((it: any) => ({ s: snapshot(user, it), note: str(it.note, "Commentaire", 300, false) || null })); // tout est validé avant d'écrire
    let templateId: string | null = null;
    tx(() => {
      for (const { s, note } of snaps) {
        run(`INSERT INTO meals(id,user_id,date,category,kind,ref_id,label,qty,unit,note,kcal,protein,carbs,fat,fiber,incomplete,estimated,created_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, uid(), user.id, date, cat, s.kind, s.ref_id, s.label, s.qty, s.unit, note, s.c.kcal, s.c.protein, s.c.carbs, s.c.fat, s.c.fiber, +s.c.incomplete, +s.c.estimated, nowIso());
        if (s.kind === "food") { const f = foodById(user.id, s.ref_id)!; run(`INSERT INTO food_prefs(user_id,food_key,last_used) VALUES(?,?,?) ON CONFLICT(user_id,food_key) DO UPDATE SET last_used=excluded.last_used`, user.id, f.food_key, nowIso()); }
      }
      run("UPDATE day_status SET closed=0 WHERE user_id=? AND date=?", user.id, date); // modifier une journée close la rend partielle
      if (body.template_name) { templateId = uid(); run("INSERT INTO meal_templates(id,user_id,name,category,items,created_at) VALUES(?,?,?,?,?,?)", templateId, user.id, str(body.template_name, "Nom du repas type", 80), cat, J(snaps.map((x: { s: ReturnType<typeof snapshot> }) => templateItem(x.s))), nowIso()); }
    });
    return { count: snaps.length, template_id: templateId };
  });
  r.post("/meals-delete", ({ user, body }) => {
    const date = dateStr(body.date), cat = str(body.category, "Catégorie", 40);
    const n = run("DELETE FROM meals WHERE user_id=? AND date=? AND category=?", user.id, date, cat).changes;
    run("UPDATE day_status SET closed=0 WHERE user_id=? AND date=?", user.id, date);
    return { deleted: Number(n) };
  });
  // Repas récents : les derniers « déjeuners complets » à reprendre tels quels ou à ajuster.
  r.get("/meals-recent", ({ user }) => {
    const rows = all<any>("SELECT * FROM meals WHERE user_id=? ORDER BY date DESC, created_at DESC LIMIT 400", user.id);
    const groups = new Map<string, any[]>();
    for (const m of rows) { const k = `${m.date}|${m.category}`; groups.set(k, [...(groups.get(k) ?? []), m]); }
    const out = [...groups.entries()].slice(0, 14).map(([k, ms]) => {
      const items = ms.reverse().map(entryItem).filter(Boolean) as any[];
      return { date: ms[0].date, category: ms[0].category, count: ms.length, kcal: ms.every((m) => m.kcal == null) ? null : ms.reduce((a, m) => a + (m.kcal ?? 0), 0), label: ms.slice(0, 3).map((m) => m.label).join(", ") + (ms.length > 3 ? "…" : ""), items: expandItems(user, items) };
    });
    return { meals: out };
  });
  r.get("/meal-templates", ({ user }) => {
    const rows = all<any>("SELECT * FROM meal_templates WHERE user_id=? ORDER BY created_at DESC", user.id);
    return { templates: rows.map((t) => { const items = P<any[]>(t.items, []); const exp = expandItems(user, items); const kc = exp.map((e) => { try { return snapshot(user, { kind: e.kind, key: e.key, qty: e.qty, unit: e.unit }).c.kcal; } catch { return null; } }); return { id: t.id, name: t.name, category: t.category, count: items.length, missing: items.length - exp.length, kcal: kc.some((x) => x != null) ? kc.reduce((a: number, x) => a + (x ?? 0), 0) : null, items: exp }; }) };
  });
  r.post("/meal-templates", ({ user, body }) => {
    const name = str(body.name, "Nom du repas type", 80);
    let items: any[];
    let cat = str(body.category, "Catégorie", 40, false) || "Repas";
    if (body.from) { // à partir d'un repas déjà noté (date + catégorie)
      const date = dateStr(body.from.date); cat = str(body.from.category, "Catégorie", 40);
      items = all<any>("SELECT * FROM meals WHERE user_id=? AND date=? AND category=? ORDER BY created_at", user.id, date, cat).map(entryItem).filter(Boolean) as any[];
    } else items = (Array.isArray(body.items) ? body.items : []).slice(0, 60).map((it: any) => templateItem(snapshot(user, it)));
    if (!items.length) throw bad("Ce repas est vide.");
    const id = uid();
    run("INSERT INTO meal_templates(id,user_id,name,category,items,created_at) VALUES(?,?,?,?,?,?)", id, user.id, name, cat, J(items), nowIso());
    return { id };
  });
  r.del("/meal-templates/:id", ({ user, params }) => { run("DELETE FROM meal_templates WHERE id=? AND user_id=?", params[0], user.id); });
  // Réutiliser un repas type : valeurs actuelles des aliments, quantités d'origine.
  r.post("/meal-templates/:id/use", ({ user, params, body }) => {
    const t = get<any>("SELECT * FROM meal_templates WHERE id=? AND user_id=?", params[0], user.id);
    if (!t) throw notFound();
    const date = dateStr(body.date), cat = body.category ? str(body.category, "Catégorie", 40) : t.category;
    const items = P<any[]>(t.items, []).map((it) => { try { return snapshot(user, { kind: it.kind, key: it.key, qty: it.qty, unit: it.unit }); } catch { return null; } }).filter(Boolean) as ReturnType<typeof snapshot>[];
    if (!items.length) throw bad("Les aliments de ce repas type ne sont plus disponibles.");
    tx(() => {
      for (const s of items) run(`INSERT INTO meals(id,user_id,date,category,kind,ref_id,label,qty,unit,note,kcal,protein,carbs,fat,fiber,incomplete,estimated,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,NULL,?,?,?,?,?,?,?,?)`, uid(), user.id, date, cat, s.kind, s.ref_id, s.label, s.qty, s.unit, s.c.kcal, s.c.protein, s.c.carbs, s.c.fat, s.c.fiber, +s.c.incomplete, +s.c.estimated, nowIso());
      run("UPDATE day_status SET closed=0 WHERE user_id=? AND date=?", user.id, date);
    });
    return { count: items.length };
  });
  r.post("/days/:date/close", ({ user, params, body }) => {
    const date = dateStr(params[0]);
    const closed = body.closed === false ? 0 : 1;
    run("INSERT INTO day_status(user_id,date,closed) VALUES(?,?,?) ON CONFLICT(user_id,date) DO UPDATE SET closed=excluded.closed", user.id, date, closed);
    return dayInfo(user.id, date);
  });

  // --- recettes ---
  r.get("/recipes", ({ user, query }) => {
    const q = (query.get("q") ?? "").toLowerCase();
    const rows = all<RecipeRow>(`SELECT * FROM recipes r WHERE user_id=? AND archived=0 AND version=(SELECT MAX(version) FROM recipes x WHERE x.recipe_key=r.recipe_key AND x.user_id=r.user_id) ORDER BY title`, user.id);
    return { recipes: rows.filter((x) => !q || x.title.toLowerCase().includes(q)).map((x) => recipeOut(user, x)) };
  });
  r.post("/recipes", ({ user, body }) => createRecipe(user, body));
  r.put("/recipes/:key", ({ user, params, body }) => {
    const cur = latestRecipe(user.id, params[0]);
    if (!cur) throw notFound();
    checkVersion(body, cur.version);
    const v = recipeInput(user, body);
    const id = uid();
    run("INSERT INTO recipes(id,recipe_key,version,user_id,title,servings,final_weight,time_min,tags,steps,ingredients,favorite,created_at,source_url) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)", id, cur.recipe_key, cur.version + 1, user.id, v.title, v.servings, v.final_weight, v.time_min, v.tags, v.steps, v.ingredients, cur.favorite, nowIso(), body.source_url === undefined ? cur.source_url : v.source_url);
    return { id, version: cur.version + 1 };
  });
  r.post("/recipes/:key/favorite", ({ user, params, body }) => {
    if (!latestRecipe(user.id, params[0])) throw notFound();
    run("UPDATE recipes SET favorite=? WHERE recipe_key=? AND user_id=?", body.favorite === false ? 0 : 1, params[0], user.id);
  });
  r.del("/recipes/:key", ({ user, params }) => {
    if (!latestRecipe(user.id, params[0])) throw notFound();
    run("UPDATE recipes SET archived=1 WHERE recipe_key=? AND user_id=?", params[0], user.id);
  });

  // --- objectifs datés ---
  r.get("/goals", ({ user }) => ({ goals: all("SELECT * FROM goals WHERE user_id=? ORDER BY start_date DESC", user.id) }));
  r.post("/goals", ({ user, body }) => {
    const start = dateStr(body.start_date, "Date d'effet");
    const phase = ["perte", "maintien", "progression", "habitudes", "pause"].includes(body.phase) ? body.phase : (() => { throw bad("Phase invalide."); })();
    const g = { kcal: numOrNull(body.kcal, "Cible calorique", { min: 500, max: 10000 }), protein: numOrNull(body.protein, "Protéines", { min: 0, max: 600 }), carbs: numOrNull(body.carbs, "Glucides", { min: 0, max: 1500 }),
      fat: numOrNull(body.fat, "Lipides", { min: 0, max: 500 }), weight_target: numOrNull(body.weight_target, "Poids cible", { min: 20, max: 400 }), start_weight: numOrNull(body.start_weight, "Poids de départ", { min: 20, max: 400 }) };
    const coherence = goalCoherence(g);
    const id = uid();
    tx(() => {
      // Conserver les versions : l'objectif précédent se termine la veille de la nouvelle date d'effet.
      run("UPDATE goals SET end_date=? WHERE user_id=? AND start_date<? AND (end_date IS NULL OR end_date>=?)", ((): string => { const d = new Date(start + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); })(), user.id, start, start);
      const next = get<any>("SELECT start_date FROM goals WHERE user_id=? AND start_date>? ORDER BY start_date LIMIT 1", user.id, start);
      const end = next ? ((): string => { const d = new Date(next.start_date + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); })() : null;
      run("INSERT INTO goals(id,user_id,phase,kcal,protein,carbs,fat,weight_target,start_weight,start_date,end_date,note) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", id, user.id, phase, g.kcal, g.protein, g.carbs, g.fat, g.weight_target, g.start_weight, start, end, str(body.note, "Note", 300, false) || null);
      // Les fiches liées aux objectifs sont signalées « à revoir » sans modification de contenu (CON 03).
      run("UPDATE notes SET to_review=1 WHERE user_id=? AND topic='objectifs'", user.id);
    });
    return { id, coherence };
  });
  r.del("/goals/:id", ({ user, params }) => { run("DELETE FROM goals WHERE id=? AND user_id=?", params[0], user.id); });
}
export { ApiError, CalcError };

/** Création d'une recette pour un utilisateur (partagée avec l'application des propositions de l'agent). */
export function createRecipe(user: User, body: any) {
  const v = recipeInput(user, body);
  const id = uid(), key = "r-" + uid();
  run("INSERT INTO recipes(id,recipe_key,version,user_id,title,servings,final_weight,time_min,tags,steps,ingredients,created_at,source_url) VALUES(?,?,1,?,?,?,?,?,?,?,?,?,?)", id, key, user.id, v.title, v.servings, v.final_weight, v.time_min, v.tags, v.steps, v.ingredients, nowIso(), v.source_url);
  return { id, recipe_key: key };
}
