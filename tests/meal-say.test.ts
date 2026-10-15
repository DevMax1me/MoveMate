import { describe, it, expect } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { openDb } from "@/lib/db";
import { splitMealText, extractUrls, detectCategory } from "@/lib/meal-say";
import { parseIngredient } from "@/lib/recipe-parse";
import { buildIndex, matchIngredient } from "@/lib/recipe-match";
import { toAmount, lineNutrients, type FoodLite } from "@/lib/recipe-amount";
import { DISHES } from "@/lib/dishes";
import { INGREDIENTS } from "@/lib/ingredients";

describe("dire ce que j'ai mangé : découpe de la phrase", () => {
  it("virgules, « et », « avec », points-virgules, lignes ; décimales intactes ; formules d'introduction retirées", () => {
    expect(splitMealText("2 œufs, du pain et un café")).toEqual(["2 œufs", "du pain", "un café"]);
    expect(splitMealText("j'ai mangé 2 oeufs au plat, 2 tranches de pain complet, un café et une pomme")).toEqual(["2 oeufs au plat", "2 tranches de pain complet", "un café", "une pomme"]);
    expect(splitMealText("Ce midi : des pâtes bolognaise ; une salade avec du fromage")).toEqual(["des pâtes bolognaise", "une salade", "du fromage"]);
    expect(splitMealText("1,5 l d'eau, 2,5 kg de pommes\nun yaourt + une banane")).toEqual(["1,5 l d'eau", "2,5 kg de pommes", "un yaourt", "une banane"]);
    expect(splitMealText("au petit déjeuner j'ai pris un croissant & un café au lait.")).toEqual(["un croissant", "un café au lait"]);
    expect(splitMealText("sel et poivre")).toEqual(["sel", "poivre"]);
    expect(splitMealText("")).toEqual([]); expect(splitMealText("  ,  ; ")).toEqual([]); expect(splitMealText(Array.from({ length: 100 }, (_, i) => `pomme ${i}`).join(", "))).toHaveLength(40);
  });
  it("adresses web retirées du texte et repérées ; repas deviné d'après la phrase", () => {
    expect(splitMealText("une pomme https://exemple.fr/recette?x=1 et un café")).toEqual(["une pomme", "un café"]);
    expect(extractUrls("regarde https://exemple.fr/recette?x=1. et http://a.fr/b) puis https://exemple.fr/recette?x=1")).toEqual(["https://exemple.fr/recette?x=1", "http://a.fr/b"]);
    expect(extractUrls("rien ici")).toEqual([]);
    expect(detectCategory("ce midi : des pâtes")).toBe("Déjeuner"); expect(detectCategory("au petit-déj un café")).toBe("Petit-déjeuner"); expect(detectCategory("ce soir une pizza")).toBe("Dîner"); expect(detectCategory("un goûter : un cookie")).toBe("Collation"); expect(detectCategory("une pomme")).toBeNull();
  });
});

describe("dire ce que j'ai mangé : estimation sur le catalogue", () => {
  const d: DatabaseSync = openDb(":memory:");
  const foods = d.prepare("SELECT * FROM foods WHERE user_id IS NULL").all() as any[] as FoodLite[];
  const idx = buildIndex(foods), by = new Map(foods.map((f) => [f.food_key, f]));
  const est = (line: string) => { const p = parseIngredient(line), m = matchIngredient(p.name, idx, 5, p.unit, "cuit"), f = m.candidates[0] && m.confidence !== "none" ? by.get(m.candidates[0].food_key)! : null, a = f ? toAmount(p, f, { meal: true }) : null; return { f, a, m, n: f && a && !a.negligible ? lineNutrients(f, a) : null }; };
  const case_ = (line: string, name: RegExp | string, grams: number | null, kcal?: [number, number]) => { const r = est(line); expect(r.f?.name, line).toMatch(name instanceof RegExp ? name : new RegExp("^" + name.replace(/[()|[\]]/g, "\\$&") + "$")); if (grams != null) expect(Math.round(r.a?.grams ?? -1), line).toBe(grams); if (kcal) { expect(r.n!.kcal!, line).toBeGreaterThanOrEqual(kcal[0]); expect(r.n!.kcal!, line).toBeLessThanOrEqual(kcal[1]); } };
  it("aliments reconnus et quantités estimées : pièces, portions usuelles, verres, tranches, parts, tailles", () => {
    case_("2 oeufs au plat", "Œuf au plat", 120); case_("2 tranches de pain complet", "Pain complet", 60); case_("une pomme", "Pomme", 150); case_("une petite pomme", "Pomme", 105); case_("un croissant", "Croissant au beurre", 60, [230, 260]);
    case_("une pizza", "Pizza", 350, [800, 950]); case_("une part de pizza", "Pizza", 120, [280, 320]); case_("un sandwich jambon beurre", "Sandwich jambon-beurre", 150, [380, 430]); case_("un kebab", "Kebab (sandwich)", 350); case_("un burger", "Hamburger", 200);
    case_("un café", "Café noir", 120); case_("un café au lait", /Café au lait/, 200); case_("un verre de vin", /^Vin/, 125, [85, 105]); case_("un grand verre de lait", "Lait demi-écrémé", null); expect(est("un grand verre de lait").a).toMatchObject({ unit: "ml", qty: 325 }); // 1 verre = 250 ml × 1,3 case_("un coca", /^Soda \(cola/, 330, [130, 150]); case_("un coca zéro", /Soda zéro/, 330);
    case_("100 g de riz", "Riz blanc cuit", 100); case_("des pâtes", "Pâtes cuites", 180); case_("150 g de poulet", "Poulet (blanc) cuit", 150); case_("du poulet", "Poulet (blanc) cuit", null); case_("des haricots verts", "Haricots verts cuits", 150);
    case_("un yaourt", "Yaourt nature", 125); case_("un yaourt aux fruits", /Yaourt aux fruits/, 125); case_("du fromage", /^Fromage râpé/, 30); case_("un peu de fromage", /^Fromage râpé/, 15); case_("2 carrés de chocolat noir", /^Chocolat noir/, 12); case_("une glace", "Glace", 50);
    case_("une part de tarte tatin", "Tarte aux fruits", 120); case_("des frites", "Frites", 150); case_("de la chantilly", "Chantilly", 30); case_("une baguette", /baguette/, 250); case_("2 c. à soupe d'huile d'olive", "Huile d'olive", 28);
  });
  it("sans quantité : une portion usuelle, marquée comme estimée ; quantité dite : pas d'estimation de poids", () => {
    expect(est("des pâtes").a).toMatchObject({ approx: true }); expect(est("100 g de riz").a).toMatchObject({ approx: false, unit: "g", qty: 100 });
    expect(est("un steak").a!.approx).toBe(true); expect(est("200 ml de lait").a).toMatchObject({ approx: false, unit: "ml" });
  });
  it("aliment inconnu : aucune proposition, jamais un aliment au hasard ; l'aliment ajouté à la main (portion) est ensuite reconnu et compté en portions", () => {
    expect(est("zzqx flurbo").f).toBeNull();
    const mine = { food_key: "u-tt", name: "Tarte au maroilles", basis: "portion", portion_g: null, portion_ml: null, portion_label: "1 portion", density: null, kcal: 450, kj: null, protein: null, carbs: null, fat: null, fiber: null, user_id: "x" } as unknown as FoodLite;
    const i2 = buildIndex([...foods, mine]);
    const p = parseIngredient("2 parts de tarte au maroilles"), m = matchIngredient(p.name, i2, 3, p.unit, "cuit");
    expect(m.candidates[0].food_key).toBe("u-tt");
    const a = toAmount(p, mine, { meal: true })!; expect(a).toMatchObject({ qty: 2, unit: "portion" }); expect(lineNutrients(mine, a)!.kcal).toBe(900);
    expect(toAmount(parseIngredient("la tarte au maroilles"), mine, { meal: true })).toMatchObject({ qty: 1, unit: "portion", approx: true }); // 1 portion par défaut
  });
  it("repas complet : ordre de grandeur plausible", () => {
    const kcal = ["des pâtes bolognaise", "une salade verte", "du fromage", "un yaourt", "un verre de vin"].reduce((a, l) => a + est(l).n!.kcal!, 0);
    expect(kcal).toBeGreaterThan(650); expect(kcal).toBeLessThan(900);
  });
  it("chaque aliment générique est retrouvé par son propre nom (aucun synonyme ne le détourne)", () => {
    const dishes = new Set(DISHES.map((x) => x[0]));
    for (const f of foods) { const m = matchIngredient(f.name, idx, 3, null, dishes.has(f.name) ? "cuit" : "cru"); expect(m.candidates[0]?.food_key, f.name).toBe(f.food_key); }
  });
});

describe("catalogue de plats et d'encas", () => {
  it("une soixantaine de plats, valeurs plausibles et portions renseignées", () => {
    expect(DISHES.length).toBeGreaterThanOrEqual(60);
    const names = new Set([...INGREDIENTS, ...DISHES].map((x) => x[0])); expect(names.size).toBe(INGREDIENTS.length + DISHES.length);
    const exempt = /^(Soda|Smoothie|Café|Chocolat chaud|Thé|Bonbons)/;
    for (const [name, kcal, p, c, l, fib, portion, label] of DISHES) {
      expect(portion, name).toBeGreaterThan(0); expect(label, name).toBeTruthy(); expect(kcal, name).toBeLessThanOrEqual(600); expect(p + c + l, name).toBeLessThanOrEqual(100.5);
      if (exempt.test(name) || kcal < 30) continue;
      const eq = 4 * p + 4 * c + 9 * l; expect(Math.abs(eq - kcal) / kcal, `${name} : ${eq.toFixed(0)} vs ${kcal}`).toBeLessThanOrEqual(0.3); expect(fib).toBeLessThanOrEqual(c + 12);
    }
  });
});
