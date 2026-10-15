// Rapprochement d'une ligne de recette avec un aliment, conversion en grammes ou millilitres, et calcul. Fonctions pures (utilisées côté serveur et dans l'interface).
import { INGREDIENTS, BASE_ALIASES } from "./ingredients";
import { DISHES } from "./dishes";
import { tokens, type State } from "./recipe-parse";
import { norm, type FoodLite } from "./recipe-amount";
export type { FoodLite } from "./recipe-amount";
type Variant = { toks: Set<string>; state: State; alias: boolean };
export type Index = { foods: FoodLite[]; variants: Variant[][]; stateOf: State[]; dish: boolean[] };

const DISH_NAMES = new Set(DISHES.map((g) => norm(g[0])));
const ALIASES = new Map<string, string[]>();
for (const g of [...INGREDIENTS, ...DISHES]) ALIASES.set(norm(g[0]), g[9].split("|"));
for (const [k, v] of Object.entries(BASE_ALIASES)) ALIASES.set(norm(k), [...(ALIASES.get(norm(k)) ?? []), ...v.split("|")]);

export function buildIndex(foods: FoodLite[]): Index {
  const variants: Variant[][] = [], stateOf: State[] = [], dish: boolean[] = [];
  for (const f of foods) {
    const t = tokens(f.name);
    const vs: Variant[] = [{ toks: new Set(t.toks), state: t.state, alias: false }];
    for (const a of ALIASES.get(norm(f.name)) ?? []) { const ta = tokens(a); if (ta.toks.length) vs.push({ toks: new Set(ta.toks), state: ta.state, alias: true }); }
    variants.push(vs); stateOf.push(t.state); dish.push(DISH_NAMES.has(norm(f.name)));
  }
  return { foods, variants, stateOf, dish };
}

/** full : tous les mots de la ligne se retrouvent dans l'aliment (sinon la proposition n'est qu'approchante : « tarte au maroilles » → « tarte »). */
export type Candidate = { food_key: string; score: number; full: boolean };
export type Confidence = "high" | "medium" | "low" | "none";

export function matchIngredient(name: string, idx: Index, limit = 5, unit: string | null = null, defaultState: "cru" | "cuit" = "cru"): { candidates: Candidate[]; confidence: Confidence } {
  const { toks, state: ingState } = tokens(name);
  if (!toks.length) return { candidates: [], confidence: "none" };
  const out: Candidate[] = [];
  idx.foods.forEach((f, i) => {
    let best = 0, full = false;
    for (const v of idx.variants[i]) {
      const inter = toks.filter((t) => v.toks.has(t)).length;
      if (!inter) continue;
      const prec = inter / v.toks.size, rec = inter / toks.length;
      let s = prec === 1 && rec === 1 ? 1 : 0.5 * prec + 0.5 * rec;
      const st = v.state ?? idx.stateOf[i];
      if (ingState === "cuit") s += st === "cuit" ? 0.1 : -0.15;
      else if (ingState == null && defaultState === "cuit") s += st === "cuit" ? 0.05 : st === "cru" ? -0.2 : st === "sec" ? -0.25 : 0; // ce qu'on mange est cuit
      else if (st === "cuit") s -= 0.25;
      if (ingState === "sec" && st === "sec") s += 0.1; else if (ingState == null && st === "sec" && defaultState !== "cuit") s -= 0.05; else if (ingState === "cru" && st === "cru") s += 0.05;
      if (v.alias) s += 0.01;
      if (Math.min(1.1, s) > best) { best = Math.min(1.1, s); full = inter === toks.length; } // les bonus d'état (cru, sec) départagent « jambon cru » de « jambon blanc »
    }
    // à égalité : un plat préparé pour « ce que j'ai mangé », un ingrédient pour une recette
    if (best > 0 && idx.dish[i] === (defaultState === "cuit")) best += 0.015;
    if (best > 0 && f.user_id) best += 0.03; // départage à égalité : un aliment à soi passe avant le catalogue
    if (best > 0 && unit === "tranche" && /tranche/.test(f.portion_label ?? "")) best += 0.02;
    if (best >= 0.4) out.push({ food_key: f.food_key, score: +best.toFixed(3), full });
  });
  out.sort((a, b) => b.score - a.score);
  const top = out[0]?.score ?? 0, partial = out[0] ? !out[0].full : false;
  // une proposition qui ne couvre pas tous les mots de la ligne reste « à vérifier », même bien notée
  return { candidates: out.slice(0, limit), confidence: top >= 0.9 && !partial ? "high" : top >= 0.7 && !partial ? "medium" : top >= 0.4 ? "low" : "none" };
}
