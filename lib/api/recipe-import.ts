import { Router, bad, str, numOrNull } from "../http";
import { all } from "../db";
import { ApiError } from "../auth";
import { fetchPage, validateUrl, FetchRefused } from "../safe-fetch";
import { extractRecipe, type Extracted } from "../recipe-extract";
import { parseIngredient } from "../recipe-parse";
import { buildIndex, matchIngredient } from "../recipe-match";
import { toAmount, lineNutrients, type FoodLite } from "../recipe-amount";
import { sumNutrients } from "../calc";
import type { FoodRow } from "./nutrition";

// Importer une recette depuis une adresse web : le serveur télécharge la page À LA DEMANDE de l'utilisateur, lit les ingrédients,
// les rapproche des aliments et calcule. Rien n'est enregistré avant la validation de l'aperçu par l'utilisateur.
const LIMIT = 12, WINDOW_MS = 10 * 60 * 1000, MAX_PARALLEL = 4;
const hits = new Map<string, number[]>();
let inflight = 0;
function throttle(userId: string) {
  const now = Date.now(), list = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= LIMIT) throw new ApiError(429, "Trop d'imports en peu de temps : patientez quelques minutes.");
  list.push(now); hits.set(userId, list);
}

export const foodLite = (f: FoodRow): FoodLite => ({ food_key: f.food_key, name: f.name, brand: f.brand, basis: f.basis, portion_g: f.portion_g, portion_ml: f.portion_ml, portion_label: f.portion_label, density: f.density, kcal: f.kcal, kj: f.kj, kcal_kj_only: f.kj, protein: f.protein, carbs: f.carbs, fat: f.fat, fiber: f.fiber, user_id: f.user_id });

/** Aperçu à partir des lignes d'ingrédients : une entrée par ligne avec aliment proposé, quantité convertie et apport calculé. */
export function previewLines(userId: string, ingredients: string[]) {
  const rows = all<FoodRow>(`SELECT * FROM foods f WHERE (user_id IS NULL OR user_id=?) AND archived=0
    AND version=(SELECT MAX(version) FROM foods x WHERE x.food_key=f.food_key AND (x.user_id IS NULL OR x.user_id=?))`, userId, userId);
  const foods = rows.map(foodLite), idx = buildIndex(foods), byKey = new Map(foods.map((f) => [f.food_key, f]));
  const lines = ingredients.map((raw) => {
    const parsed = parseIngredient(raw);
    const m = matchIngredient(parsed.name, idx, 5, parsed.unit);
    const cands = m.candidates.map((c) => { const f = byKey.get(c.food_key)!; return { food_key: c.food_key, score: c.score, food: { food_key: f.food_key, name: f.name, brand: f.brand ?? null, basis: f.basis, portion_g: f.portion_g ?? null, portion_ml: f.portion_ml ?? null, portion_label: f.portion_label ?? null, density: f.density ?? null, kcal: f.kcal, kj: f.kj ?? null, protein: f.protein, carbs: f.carbs, fat: f.fat, fiber: f.fiber, private: !!f.user_id } }; });
    const top = cands[0] ? byKey.get(cands[0].food_key)! : null;
    const amount = top ? toAmount(parsed, top) : null;
    const n = top && amount && !amount.negligible ? lineNutrients(top, amount) : null;
    return { raw: parsed.raw, parsed, candidates: cands, chosen: top && m.confidence !== "none" ? top.food_key : null, confidence: m.confidence, amount, nutrients: n };
  });
  const totals = sumNutrients(lines.flatMap((l) => (l.nutrients ? [l.nutrients] : [])));
  return { lines, totals };
}

export function mountRecipeImport(r: Router) {
  r.post("/recipes/import/preview", async ({ user, body }) => {
    const text: string = typeof body.text === "string" ? body.text.trim() : "";
    let ex: Extracted, sourceUrl: string | null = null;
    if (text) {
      const lines = text.split(/\r?\n/).map((l: string) => l.replace(/\s+/g, " ").trim().replace(/^[-•*·]\s*/, "")).filter((l: string) => l.length > 1).map((l: string) => l.slice(0, 300));
      if (!lines.length) throw bad("Collez au moins un ingrédient par ligne.");
      if (lines.length > 80) throw bad("Trop de lignes (80 au maximum).");
      ex = { title: str(body.title, "Titre", 120, false) || "Recette collée", servings: numOrNull(body.servings, "Portions", { min: 0.5, max: 100 }), servingsLabel: null, timeMin: null, ingredients: lines, steps: "", reported: null, via: "json-ld" };
    } else {
      const url = str(body.url, "Adresse", 2000);
      const allow = (process.env.RECIPE_IMPORT_ALLOW ?? "").split(",").map((x) => x.trim()).filter(Boolean);
      try { validateUrl(url, allow); } catch (e) { if (e instanceof FetchRefused) throw bad(e.message); throw e; } // une adresse refusée ne coûte rien : elle ne compte pas dans la limite
      throttle(user.id);
      if (inflight >= MAX_PARALLEL) throw new ApiError(429, "Le serveur est occupé : réessayez dans un instant.");
      inflight++;
      try {
        const page = await fetchPage(url, { allow });
        sourceUrl = page.url;
        const found = extractRecipe(page.html);
        if (!found) throw bad("Aucune recette détectée sur cette page. Certains sites ne publient pas leurs ingrédients de façon lisible : copiez la liste des ingrédients et collez-la dans l'onglet « Coller le texte ».");
        ex = found;
      } catch (e) {
        if (e instanceof FetchRefused) throw bad(e.message);
        throw e;
      } finally { inflight--; }
    }
    const { lines, totals } = previewLines(user.id, ex.ingredients);
    let host: string | null = null; try { host = sourceUrl ? new URL(sourceUrl).hostname.replace(/^www\./, "") : null; } catch { /* sans objet */ }
    return {
      title: ex.title, servings: ex.servings ?? 4, servings_guess: ex.servings == null, servings_label: ex.servingsLabel, time_min: ex.timeMin, steps: ex.steps,
      source_url: sourceUrl, source_host: host, via: text ? "texte" : ex.via, reported: ex.reported, lines, totals,
    };
  });
}
