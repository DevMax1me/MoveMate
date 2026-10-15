// Rapprochement d'une ligne de recette avec un aliment, conversion en grammes ou millilitres, et calcul. Fonctions pures (utilisées côté serveur et dans l'interface).
import { INGREDIENTS, BASE_ALIASES } from "./ingredients";
import { tokens, type State } from "./recipe-parse";
import { norm, type FoodLite } from "./recipe-amount";
export type { FoodLite } from "./recipe-amount";
type Variant = { toks: Set<string>; state: State; alias: boolean };
export type Index = { foods: FoodLite[]; variants: Variant[][]; stateOf: State[] };

const ALIASES = new Map<string, string[]>();
for (const g of INGREDIENTS) ALIASES.set(norm(g[0]), g[9].split("|"));
for (const [k, v] of Object.entries(BASE_ALIASES)) ALIASES.set(norm(k), [...(ALIASES.get(norm(k)) ?? []), ...v.split("|")]);

export function buildIndex(foods: FoodLite[]): Index {
  const variants: Variant[][] = [], stateOf: State[] = [];
  for (const f of foods) {
    const t = tokens(f.name);
    const vs: Variant[] = [{ toks: new Set(t.toks), state: t.state, alias: false }];
    for (const a of ALIASES.get(norm(f.name)) ?? []) { const ta = tokens(a); if (ta.toks.length) vs.push({ toks: new Set(ta.toks), state: ta.state, alias: true }); }
    variants.push(vs); stateOf.push(t.state);
  }
  return { foods, variants, stateOf };
}

export type Candidate = { food_key: string; score: number };
export type Confidence = "high" | "medium" | "low" | "none";

export function matchIngredient(name: string, idx: Index, limit = 5, unit: string | null = null): { candidates: Candidate[]; confidence: Confidence } {
  const { toks, state: ingState } = tokens(name);
  if (!toks.length) return { candidates: [], confidence: "none" };
  const out: Candidate[] = [];
  idx.foods.forEach((f, i) => {
    let best = 0;
    for (const v of idx.variants[i]) {
      const inter = toks.filter((t) => v.toks.has(t)).length;
      if (!inter) continue;
      const prec = inter / v.toks.size, rec = inter / toks.length;
      let s = prec === 1 && rec === 1 ? 1 : 0.5 * prec + 0.5 * rec;
      const st = v.state ?? idx.stateOf[i];
      if (ingState === "cuit") s += st === "cuit" ? 0.1 : -0.15;
      else if (st === "cuit") s -= 0.25;
      if (ingState === "sec" && st === "sec") s += 0.1; else if (ingState == null && st === "sec") s -= 0.05; else if (ingState === "cru" && st === "cru") s += 0.05;
      if (v.alias) s += 0.01;
      best = Math.max(best, Math.min(1, s));
    }
    if (best > 0 && f.user_id) best += 0.03; // départage à égalité : un aliment à soi passe avant le catalogue
    if (best > 0 && unit === "tranche" && /tranche/.test(f.portion_label ?? "")) best += 0.02;
    if (best >= 0.4) out.push({ food_key: f.food_key, score: +best.toFixed(3) });
  });
  out.sort((a, b) => b.score - a.score);
  const top = out[0]?.score ?? 0;
  return { candidates: out.slice(0, limit), confidence: top >= 0.9 ? "high" : top >= 0.7 ? "medium" : top >= 0.4 ? "low" : "none" };
}
