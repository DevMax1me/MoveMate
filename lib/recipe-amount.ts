// Conversion d'une quantité de recette en grammes ou millilitres, et calcul de l'apport. Fonctions pures (serveur et interface).
import { computeFood, type FoodBasis, type Computed } from "./calc";
import { PIECE_G, PACK_G, NEGLIGIBLE_RE } from "./ingredient-units";
import { fold, type Parsed } from "./recipe-parse";

export type FoodLite = FoodBasis & { food_key: string; name: string; brand?: string | null; user_id?: string | null; kj?: number | null; portion_label?: string | null };
export const norm = (s: string) => fold(s).replace(/œ/g, "oe").replace(/['’]/g, " ").replace(/\s+/g, " ").trim();

// ---- conversions ----
const G: Record<string, number> = { g: 1, kg: 1000, mg: 0.001, oz: 28.35, lb: 453.6, pincee: 0.4, poignee: 30, noix: 10, carre: 6, batonnet: 3, brin: 1, feuille: 0.5, branche: 3, bouquet: 30 };
const ML: Record<string, number> = { ml: 1, cl: 10, dl: 100, l: 1000, cs: 15, cc: 5, cd: 10, verre: 150, tasse: 250, cup: 240, mug: 300, bol: 350, filet: 8, canette: 330, bouteille: 500, louche: 150 };
const PLURAL = new Set(["tranche", "gousse", "part", "portion", "assiette", "boite", "pincee", "poignee", "canette", "bouteille", "boule", "barre", "coupe", "louche", "tasse", "verre", "bol", "pot", "carre", "noix", "batonnet", "morceau", "brin", "feuille", "branche", "bouquet", "sachet", "cube", "paquet", "rouleau"]);
const UNIT_LABEL: Record<string, string> = { cs: "c. à soupe", cc: "c. à café", cd: "c. à dessert", cl: "cl", dl: "dl", l: "l", ml: "ml", g: "g", kg: "kg", mg: "mg", pincee: "pincée", boite: "boîte", tranche: "tranche", gousse: "gousse", poignee: "poignée", batonnet: "bâtonnet", oz: "oz", lb: "lb" };

/** Densités usuelles quand l'aliment n'en porte pas (catalogue de base) : une cuillère de miel pèse plus qu'une cuillère de farine. */
const HDENS: [RegExp, number][] = [[/^miel/, 1.4], [/^sucre/, 0.85], [/^beurre de cacahuete/, 1.1], [/^beurre/, 0.95], [/^flocons/, 0.35], [/^yaourt/, 1.04], [/^whey/, 0.45], [/^amandes/, 0.55], [/^chocolat/, 0.6]];
const densityOf = (f: FoodLite): { d: number; estimated: boolean } => (f.density ? { d: f.density, estimated: false } : { d: HDENS.find(([re]) => re.test(norm(f.name)))?.[1] ?? 1, estimated: true });

export type Amount = { qty: number; unit: "g" | "ml" | "portion"; grams: number | null; approx: boolean; negligible?: boolean; how: string };
export type AmountOpts = { meal?: boolean }; // meal : saisie « ce que j'ai mangé » (portion usuelle quand rien n'est précisé)

export const isNegligible = (p: Parsed) => p.qty == null && !p.hintG && !p.hintMl && NEGLIGIBLE_RE.test(norm(p.name));

// « un verre de vin » : si l'aliment a sa propre portion nommée « verre », c'est elle qui compte ; sinon une mesure moyenne.
const LABEL_FOR: Record<string, RegExp> = { bol: /bol/, tasse: /tasse/, mug: /tasse|mug/, verre: /verre|demi/, assiette: /assiette/, part: /part/, boule: /boule/, barre: /barre/, coupe: /coupe/, pot: /pot/, tranche: /tranche/, canette: /canette|bouteille/, bouteille: /bouteille|canette/, louche: /louche/ };
const PORTION_UNITS = new Set(["part", "portion", "assiette", "boule", "barre", "coupe"]);
const portionOf = (f: FoodLite): { g: number; label: string } | null => { const g = f.basis === "100ml" ? f.portion_ml ?? f.portion_g : f.portion_g ?? f.portion_ml; return g ? { g, label: f.portion_label ?? "1 portion" } : null; };

/** Poids d'une pièce ou d'un conditionnement quand la recette ne donne ni gramme ni millilitre. */
function pieceGrams(p: Parsed, food: FoodLite, meal: boolean): { g: number; why: string; ml?: boolean } | null {
  if (p.hintG) return { g: p.hintG, why: `${p.hintG} g indiqués` };
  if (p.hintMl) return { g: p.hintMl * (food.density ?? 1), why: `${p.hintMl} ml indiqués` };
  const text = norm(`${p.unit ?? ""} de ${p.name}`);
  const por0 = portionOf(food);
  if (meal && !p.unit && por0 && !/\b(pizzas?|baguettes?)\b/.test(text)) return { g: por0.g, why: `${por0.label}`, ml: food.basis === "100ml" }; // ce qu'on mange : la portion propre à l'aliment (un sandwich, une pomme) prime
  if (p.unit && ["boite", "paquet", "sachet"].includes(p.unit)) { const k = PACK_G.find(([re]) => re.test(text)); if (k) return { g: k[1], why: `conditionnement usuel ${k[1]} g` }; }
  const k = PIECE_G.find(([re]) => re.test(text));
  if (k) return { g: k[1], why: `poids moyen ${k[1]} g` };
  if (p.unit) { const kk = PACK_G.find(([re]) => re.test(text)); if (kk) return { g: kk[1], why: `conditionnement usuel ${kk[1]} g` }; }
  const por = portionOf(food);
  if (por && (!p.unit || ["morceau", "tranche"].includes(p.unit)) && (meal || /^1 /.test(food.portion_label ?? ""))) return { g: por.g, why: `${por.label}`, ml: food.basis === "100ml" };
  if (p.unit && G[p.unit] != null) return { g: G[p.unit], why: `${UNIT_LABEL[p.unit] ?? p.unit} ≈ ${G[p.unit]} g` };
  return null;
}

/** Quantité dite → grammes (aliment défini pour 100 g), millilitres (pour 100 ml) ou portions (aliment défini par portion). null = à préciser par l'utilisateur. */
export function toAmount(p: Parsed, food: FoodLite, opts: AmountOpts = {}): Amount | null {
  const meal = !!opts.meal, size = p.size || 1;
  const sized = (a: Amount | null): Amount | null => (a && size !== 1 && !a.negligible ? { ...a, qty: a.qty * size, grams: a.grams == null ? null : a.grams * size, approx: true, how: `${a.how} × ${fmt(size)} (${size > 1 ? "grand" : "petit"})` } : a);
  let qty = p.qty;
  const por = portionOf(food);
  if (qty == null && p.vague && p.unit) qty = 3;
  if (qty == null && (p.hintG || p.hintMl)) qty = 1;
  if (qty == null && meal && !isNegligible(p)) { qty = p.vague && !p.unit ? 0.5 : 1; } // « du pain », « des pâtes » : une portion usuelle (la moitié pour « un peu de »)
  if (qty == null) return isNegligible(p) ? { qty: 0, unit: "g", grams: 0, approx: false, negligible: true, how: "quantité négligeable (assaisonnement)" } : null;
  const u = p.unit, label = `${fmt(qty)} ${u ? (UNIT_LABEL[u] ?? u) + (qty > 1 && PLURAL.has(u) && !/s$|x$/.test(UNIT_LABEL[u] ?? u) ? "s" : "") : ""}`.trim();
  const gu = food.basis === "100ml" ? "ml" : "g";
  // aliment défini par portion (aliment ajouté à la main : « 1 portion = 1 part de tarte ») : on compte des portions
  if (food.basis === "portion") return u && ["g", "kg", "mg", "ml", "cl", "dl", "l", "oz", "lb"].includes(u) ? null : sized({ qty, unit: "portion", grams: null, approx: p.qty == null, how: p.qty == null ? "1 portion par défaut" : label });
  const { d: dens, estimated } = densityOf(food);
  const finish = (grams: number | null, ml: number | null, approx: boolean, how: string): Amount | null => {
    if (food.basis === "100g") { const g = grams ?? (ml != null ? ml * dens : null); return g == null ? null : { qty: g, unit: "g", grams: g, approx: approx || (grams == null && estimated), how }; }
    const m = ml ?? (grams != null ? grams / dens : null); return m == null ? null : { qty: m, unit: "ml", grams: m * dens, approx: approx || (ml == null && estimated), how };
  };
  if (u && ["g", "kg", "mg", "oz", "lb"].includes(u)) return sized(finish(qty * G[u], null, false, label));
  // portion propre à l'aliment, nommée comme l'unité dite (« un verre » de vin, « une assiette » de pâtes) ou unité de portion générique
  if (u && por && ((LABEL_FOR[u] && LABEL_FOR[u].test(norm(food.portion_label ?? ""))) || PORTION_UNITS.has(u)))
    return sized(food.basis === "100ml" ? finish(null, qty * por.g, true, `${label} × ${fmt(por.g)} ml (${por.label})`) : finish(qty * por.g, null, true, `${label} × ${fmt(por.g)} g (${por.label})`));
  if (u && PORTION_UNITS.has(u)) { const k = PIECE_G.find(([re]) => re.test(norm(`de ${p.name}`))); if (k) return sized(finish(qty * k[1], null, true, `${label} × ${fmt(k[1])} g (poids moyen)`)); return null; }
  if (u && ML[u] != null) {
    const ml = qty * ML[u];
    const conv = ["cs", "cc", "cd", "verre", "tasse", "cup", "mug", "bol", "filet", "canette", "bouteille", "louche"].includes(u) ? `${label} = ${fmt(ml)} ml` : label;
    const how = food.basis === "100g" ? `${conv} ≈ ${fmt(Math.round(ml * dens))} g${estimated ? " (densité estimée)" : ""}` : conv;
    return sized(finish(null, ml, u !== "ml" && u !== "cl" && u !== "dl" && u !== "l", how));
  }
  const pc = pieceGrams(p, food, meal);
  if (!pc) return null;
  return sized(pc.ml ? finish(null, qty * pc.g, true, `${label || fmt(qty)} × ${fmt(pc.g)} ml (${pc.why})`) : finish(qty * pc.g, null, true, `${label || fmt(qty)} × ${fmt(pc.g)} ${gu} (${pc.why})`));
}
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(+n.toFixed(2)));

export const toBasis = (f: FoodLite): FoodBasis => ({ ...f, kcal_kj_only: f.kj ?? f.kcal_kj_only ?? null });
export function lineNutrients(food: FoodLite, a: { qty: number; unit: "g" | "ml" | "portion" }): Computed | null {
  if (!(a.qty > 0)) return null;
  try { return computeFood(toBasis(food), a.qty, a.unit); } catch { return null; }
}
