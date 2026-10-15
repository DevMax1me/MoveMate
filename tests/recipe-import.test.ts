import { describe, it, expect } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { openDb } from "@/lib/db";
import { extractRecipe, parseDuration, parseYield, parseNutrition } from "@/lib/recipe-extract";
import { parseIngredient, decodeEntities } from "@/lib/recipe-parse";
import { buildIndex, matchIngredient } from "@/lib/recipe-match";
import { toAmount, lineNutrients, isNegligible, type FoodLite } from "@/lib/recipe-amount";
import { sumNutrients } from "@/lib/calc";

const ld = (o: unknown) => `<html><head><title>t</title><script type="application/ld+json">${JSON.stringify(o)}</script></head><body></body></html>`;

describe("extraction d'une recette depuis une page", () => {
  it("JSON-LD simple (structure de Marmiton) : titre, portions, durée, ingrédients, étapes, nutrition du site", () => {
    const r = extractRecipe(ld({ "@context": "https://schema.org", "@type": "Recipe", name: "Pâte à crêpes", totalTime: "PT40M", recipeYield: "15 crêpes",
      recipeIngredient: ["300 g de farine", "3 oeufs entiers", "60 cl de lait"], recipeInstructions: [{ "@type": "HowToStep", text: "Mélanger." }, { "@type": "HowToStep", text: "Cuire &amp; servir." }],
      nutrition: { "@type": "NutritionInformation", calories: "167 calories", servingSize: "83.3 grams", carbohydrateContent: "18 g", fatContent: "6.9 g", proteinContent: "5.6 g" } }))!;
    expect(r.title).toBe("Pâte à crêpes"); expect(r.servings).toBe(15); expect(r.timeMin).toBe(40); expect(r.ingredients).toHaveLength(3); expect(r.via).toBe("json-ld");
    expect(r.steps).toBe("1. Mélanger.\n2. Cuire & servir."); expect(r.reported).toEqual({ kcal: 167, protein: 5.6, carbs: 18, fat: 6.9, fiber: null, servingG: 83.3 });
  });
  it("JSON-LD dans un @graph, types multiples, sections d'étapes, tabulations et entités (structure de Ricardo)", () => {
    const r = extractRecipe(ld({ "@context": "https://schema.org", "@graph": [{ "@type": "WebSite", name: "Site" }, { "@type": ["Recipe", "Thing"], name: "Gnocchis &amp; champignons", prepTime: "PT10M", cookTime: "PT15M", recipeYield: ["4", "4 portion(s)"],
      recipeIngredient: ["1 \t\tpaquet de 500 g de gnocchis", "½ \t\tfromage"], recipeInstructions: [{ "@type": "HowToSection", name: "Préparation", itemListElement: [{ "@type": "HowToStep", text: "Cuire" }, { "@type": "HowToStep", text: "Servir" }] }] }] }))!;
    expect(r.title).toBe("Gnocchis & champignons"); expect(r.servings).toBe(4); expect(r.timeMin).toBe(25); expect(r.steps.split("\n")).toHaveLength(2); expect(r.ingredients[0]).toContain("paquet");
  });
  it("durées, portions et nutrition : formats variés", () => {
    expect(parseDuration("PT1H30M")).toBe(90); expect(parseDuration("PT45M")).toBe(45); expect(parseDuration("P0DT0H20M")).toBe(20); expect(parseDuration("PT0S")).toBeNull(); expect(parseDuration("n'importe quoi")).toBeNull(); expect(parseDuration(30)).toBe(30);
    expect(parseYield("4 personnes").n).toBe(4); expect(parseYield("Makes 12").n).toBe(12); expect(parseYield(["6", "6 portions"]).n).toBe(6); expect(parseYield("4-6 parts").n).toBe(5); expect(parseYield("Pour un grand saladier").n).toBeNull(); expect(parseYield(9999).n).toBeNull(); expect(parseYield(undefined).n).toBeNull();
    expect(parseNutrition({ calories: "1046 kJ" })!.kcal).toBeCloseTo(250, 0); expect(parseNutrition({ calories: "61 calories", fatContent: "2 grams fat" })).toMatchObject({ kcal: 61, fat: 2 }); expect(parseNutrition({})).toBeNull(); expect(parseNutrition("x")).toBeNull();
  });
  it("microdonnées en dernier recours ; JSON-LD invalide ignoré ; aucune recette → null", () => {
    const micro = `<html><body><div itemscope itemtype="https://schema.org/Recipe"><h1 itemprop="name">Houmous</h1><span itemprop="recipeYield">6 personnes</span><ul><li itemprop="recipeIngredient">1 boîte de pois chiches</li><li itemprop="recipeIngredient">3 c. à soupe d'huile d'olive</li></ul></div></body></html>`;
    const r = extractRecipe(micro)!; expect(r.via).toBe("microdata"); expect(r.title).toBe("Houmous"); expect(r.servings).toBe(6); expect(r.ingredients).toHaveLength(2);
    expect(extractRecipe(`<script type="application/ld+json">{ceci n'est pas du json</script>${micro}`)!.via).toBe("microdata");
    expect(extractRecipe("<html><body><p>Un article de blog sans recette.</p></body></html>")).toBeNull();
    expect(extractRecipe(ld({ "@type": "Recipe", name: "Vide", recipeIngredient: [] }))).toBeNull(); // sans ingrédient : rien à calculer
    expect(extractRecipe(ld({ "@type": "Article", name: "x" }))).toBeNull();
  });
  it("pages piégées : pas de coût quadratique (milliers de balises jamais fermées) et ingrédients bornés", () => {
    const t0 = Date.now();
    expect(extractRecipe('<script type="application/ld+json">'.repeat(60_000))).toBeNull();
    expect(extractRecipe('<b itemprop="recipeIngredient">'.repeat(60_000))).toBeNull();
    expect(extractRecipe('<p itemprop="name">'.repeat(60_000) + "<li itemprop=\"recipeIngredient\">x</li>")!.ingredients).toEqual(["x"]);
    expect(extractRecipe("<script>".repeat(60_000))).toBeNull();
    expect(Date.now() - t0).toBeLessThan(3000);
    const r = extractRecipe(ld({ "@type": "Recipe", name: "Long", recipeIngredient: Array.from({ length: 300 }, () => "x".repeat(2000)) }))!; expect(r.ingredients).toHaveLength(80); expect(r.ingredients[0].length).toBe(300);
  });
  it("entités HTML", () => { expect(decodeEntities("cr&egrave;me &amp; &#233;pices &#x27;ok&#x27; &laquo;x&raquo; &inconnue;")).toBe("crème & épices 'ok' «x» &inconnue;"); });
});

describe("lecture d'une ligne d'ingrédient", () => {
  const P = (s: string) => { const p = parseIngredient(s); return [p.qty, p.unit, p.name]; };
  it("quantités, unités, noms (français)", () => {
    expect(P("300 g de farine")).toEqual([300, "g", "farine"]); expect(P("500g de fraises")).toEqual([500, "g", "fraises"]); expect(P("1l d'eau")).toEqual([1, "l", "eau"]);
    expect(P("60 cl de lait")).toEqual([60, "cl", "lait"]); expect(P("3 cuillères à soupe de sucre")).toEqual([3, "cs", "sucre"]); expect(P("2 c. à s. de crème fraîche")).toEqual([2, "cs", "crème fraîche"]);
    expect(P("5 c. à soupe Purée de sésame")).toEqual([5, "cs", "Purée de sésame"]); expect(P("1 càc de levure chimique")).toEqual([1, "cc", "levure chimique"]); expect(P("2 à 3 c. à café de curry")).toEqual([2.5, "cc", "curry"]);
    expect(P("1 boîte(s) Pois chiches")).toEqual([1, "boite", "Pois chiches"]); expect(P("1 pincée(s) Sel")).toEqual([1, "pincee", "Sel"]); expect(P("Une pincée de sel")).toEqual([1, "pincee", "sel"]);
    expect(P("1/2 citron vert non traité")).toEqual([0.5, null, "citron vert non traité"]); expect(P("½ citron")).toEqual([0.5, null, "citron"]); expect(P("1 1/2 tasse de riz")).toEqual([1.5, "tasse", "riz"]); expect(P("1,5 kg de pommes de terre")).toEqual([1.5, "kg", "pommes de terre"]);
    expect(P("un demi citron")).toEqual([0.5, null, "citron"]); expect(P("2 gousses d'ail")).toEqual([2, "gousse", "ail"]); expect(P("3 carottes")).toEqual([3, null, "carottes"]); expect(P("4 filets de poulet")).toEqual([4, null, "filets de poulet"]);
    expect(P("2 x 400 g de tomates concassées")).toEqual([800, "g", "tomates concassées"]); expect(P("1 noix de beurre")).toEqual([1, "noix", "beurre"]); expect(P("50 g de noix de cajou")).toEqual([50, "g", "noix de cajou"]);
    expect(P("1 cube de bouillon de volaille")).toEqual([1, "cube", "cube de bouillon"]); expect(P("Sel, poivre")).toEqual([null, null, "Sel"]); expect(P("5 tranches de bacon, coupées en lardons")).toEqual([5, "tranche", "bacon"]);
  });
  it("poids indiqués entre parenthèses ou après le conditionnement, alternatives en onces ignorées", () => {
    expect(parseIngredient("1 oignon (environ 150 g)")).toMatchObject({ qty: 1, hintG: 150, name: "oignon" });
    expect(parseIngredient("1 paquet de 500 g de gnocchis du commerce")).toMatchObject({ qty: 1, unit: "paquet", hintG: 500, name: "gnocchis du commerce" });
    expect(parseIngredient("227 g \t(8 oz) de champignons blancs tranchés")).toMatchObject({ qty: 227, unit: "g", name: "champignons blancs tranchés", hintG: null });
    expect(parseIngredient("180 ml (¾ tasse) de bouillon de poulet")).toMatchObject({ qty: 180, unit: "ml", name: "bouillon de poulet" });
  });
  it("anglais courant, facultatif, vague", () => {
    expect(P("100g plain flour")).toEqual([100, "g", "plain flour"]); expect(P("300ml milk")).toEqual([300, "ml", "milk"]); expect(P("2 large eggs")).toEqual([2, null, "large eggs"]); expect(P("1 tbsp sunflower or vegetable oil plus a little extra for frying")).toEqual([1, "cs", "sunflower or vegetable oil"]);
    expect(parseIngredient("lemon wedges to serve (optional)")).toMatchObject({ optional: true, qty: null }); expect(parseIngredient("Persil haché, facultatif").optional).toBe(true);
    expect(parseIngredient("quelques feuilles de basilic")).toMatchObject({ vague: true, unit: "feuille", name: "basilic" }); expect(parseIngredient("").name).toBe(""); expect(() => parseIngredient(undefined as any)).not.toThrow();
  });
});

describe("rapprochement, conversion et calcul sur le catalogue", () => {
  const d: DatabaseSync = openDb(":memory:");
  const foods = (d.prepare("SELECT * FROM foods WHERE user_id IS NULL").all() as any[]) as FoodLite[];
  const idx = buildIndex(foods), by = new Map(foods.map((f) => [f.food_key, f]));
  const calc = (line: string) => { const p = parseIngredient(line), m = matchIngredient(p.name, idx, 5, p.unit), f = m.candidates[0] ? by.get(m.candidates[0].food_key)! : null, a = f ? toAmount(p, f) : null; return { p, m, f, a, n: f && a && !a.negligible ? lineNutrients(f, a) : null }; };
  it("choisit le bon aliment, cru plutôt que cuit sauf mention contraire", () => {
    const name = (l: string) => calc(l).f?.name;
    expect(name("300 g de farine")).toBe("Farine de blé (T45/T55)"); expect(name("3 oeufs entiers")).toBe("Œuf entier"); expect(name("200 g de riz")).toBe("Riz blanc cru"); expect(name("200 g de riz cuit")).toBe("Riz blanc cuit");
    expect(name("250 g de pâtes")).toBe("Pâtes crues"); expect(name("150 g de poulet cuit")).toBe("Poulet (blanc) cuit"); expect(name("2 blancs de poulet")).toBe("Poulet blanc cru"); expect(name("3 c. à soupe d'huile d'olive")).toBe("Huile d'olive");
    expect(name("20 cl de crème liquide entière")).toBe("Crème liquide entière"); expect(name("1 boîte de tomates concassées")).toBe("Tomates concassées (conserve)"); expect(name("2 gousses d'ail")).toBe("Ail"); expect(name("1 pot de yaourt nature")).toBe("Yaourt nature");
    expect(name("60 cl de lait")).toBe("Lait demi-écrémé"); expect(name("100g plain flour")).toBe("Farine de blé (T45/T55)"); expect(name("2 large eggs")).toBe("Œuf entier"); expect(name("1 tbsp sunflower or vegetable oil")).toBe("Huile végétale (tournesol, colza…)");
    expect(calc("quelque chose d'introuvable zzqx").m.confidence).toBe("none"); expect(calc("5 tranches de bacon").f?.name).toBe("Bacon (tranche)");
  });
  it("convertit cuillères, pièces, conditionnements et volumes en grammes avec la bonne densité", () => {
    const g = (l: string) => Math.round(calc(l).a!.grams!);
    expect(g("300 g de farine")).toBe(300); expect(g("1,5 kg de pommes de terre")).toBe(1500); expect(g("3 oeufs")).toBe(165); expect(g("2 gousses d'ail")).toBe(8); expect(g("1 oignon")).toBe(110); expect(g("1 oignon (environ 150 g)")).toBe(150);
    expect(g("1 boîte de pois chiches")).toBe(400); expect(g("1 rouleau de pâte feuilletée")).toBe(230); expect(g("5 tranches de bacon")).toBe(100); expect(g("1 cube de bouillon de volaille")).toBe(10);
    expect(g("3 cuillères à soupe de sucre")).toBe(38); expect(g("2 c. à soupe de miel")).toBe(42); expect(g("2 c. à soupe d'huile d'olive")).toBe(28); // 30 ml × 0,92 (huile d'olive : base 100 ml)
    expect(calc("2 c. à soupe d'huile d'olive").a!.unit).toBe("ml"); expect(calc("60 cl de lait").a).toMatchObject({ qty: 600, unit: "ml" }); expect(g("1l d'eau")).toBe(1000);
    expect(g("1 paquet de 500 g de gnocchis")).toBe(500); expect(g("2 paquets de 250 g de gnocchis")).toBe(500);
    expect(calc("quelques feuilles de basilic").a!.grams).toBeCloseTo(1.5, 1);
  });
  it("assaisonnements négligeables ; quantité inconnue = à préciser, jamais zéro silencieux", () => {
    expect(isNegligible(parseIngredient("Sel, poivre"))).toBe(true); expect(calc("sel").a!.negligible).toBe(true); expect(isNegligible(parseIngredient("1 pincée de sel"))).toBe(false); expect(calc("1 pincée de sel").n!.kcal).toBe(0);
    expect(calc("huile pour la poêle").a).toBeNull(); expect(calc("Glace au yaourt pour servir").a).toBeNull(); expect(calc("une brique de quelque chose zzqx").a).toBeNull();
  });
  it("recette complète : le total retombe sur la valeur indiquée par le site (pâte à crêpes : 167 kcal par portion)", () => {
    const lines = ["300 g de farine", "3 oeufs entiers", "3 cuillères à soupe de sucre", "2 cuillères à soupe d'huile", "50 g de beurre fondu", "60 cl de lait", "5 cl de rhum"];
    const t = sumNutrients(lines.map((l) => calc(l).n!));
    const perServ = t.kcal! / 15; expect(perServ).toBeGreaterThan(167 * 0.9); expect(perServ).toBeLessThan(167 * 1.1);
    expect(t.protein! / 15).toBeGreaterThan(5.6 * 0.8); expect(t.protein! / 15).toBeLessThan(5.6 * 1.25);
    const bbc = sumNutrients(["100g plain flour", "2 large eggs", "300ml milk", "1 tbsp sunflower or vegetable oil plus a little extra for frying"].map((l) => calc(l).n!)); expect(bbc.kcal! / 12).toBeGreaterThan(61 * 0.85); expect(bbc.kcal! / 12).toBeLessThan(61 * 1.2);
  });
  it("un aliment privé de l'utilisateur est préféré à égalité ; un aliment compté en portions n'est pas converti en grammes", () => {
    const mine = { ...foods.find((f) => f.name === "Farine de blé (T45/T55)")!, food_key: "u-1", name: "Ma farine", user_id: "x" } as FoodLite;
    const i2 = buildIndex([...foods, { ...mine, name: "Farine", food_key: "u-2" }]); expect(matchIngredient("farine", i2).candidates[0].food_key).toBe("u-2");
    const portionFood = { ...mine, basis: "portion" } as FoodLite;
    expect(toAmount(parseIngredient("2 parts de tarte"), portionFood)).toMatchObject({ qty: 2, unit: "portion" }); expect(toAmount(parseIngredient("200 g de tarte"), portionFood)).toBeNull(); // un aliment compté en portions ne se convertit pas en grammes
  });
});
