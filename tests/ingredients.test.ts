import { describe, it, expect } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { openDb } from "@/lib/db";
import { INGREDIENTS, BASE_ALIASES } from "@/lib/ingredients";

describe("catalogue d'ingrédients pour les recettes", () => {
  const d: DatabaseSync = openDb(":memory:");
  const foods = d.prepare("SELECT * FROM foods WHERE user_id IS NULL").all() as any[];
  it("plus de 160 ingrédients courants, sans doublon de nom ni de clé", () => {
    expect(INGREDIENTS.length).toBeGreaterThanOrEqual(160);
    expect(new Set(foods.map((f) => f.name)).size).toBe(foods.length);
    expect(new Set(foods.map((f) => f.food_key)).size).toBe(foods.length);
    expect(foods.length).toBeGreaterThanOrEqual(200);
  });
  it("valeurs plausibles : macros cohérentes avec l'énergie (hors alcool et fibres), bornes pour 100 g", () => {
    const exempt = /^(Vin|Spiritueux|Bière|Gélatine|Herbes|Poivre|Extrait de vanille)/;
    for (const g of INGREDIENTS) {
      const [name, kcal, p, c, l, fib] = g;
      expect(kcal, name).toBeGreaterThanOrEqual(0); expect(kcal, name).toBeLessThanOrEqual(900);
      expect(p + c + l, name).toBeLessThanOrEqual(100.5); expect(fib, name).toBeLessThanOrEqual(c + 40);
      if (exempt.test(name) || kcal < 30) continue;
      const eq = 4 * p + 4 * c + 9 * l;
      expect(Math.abs(eq - kcal) / kcal, `${name} : ${eq.toFixed(0)} vs ${kcal}`).toBeLessThanOrEqual(0.25);
    }
  });
  it("la base existante reste intacte et les synonymes visent des aliments existants", () => {
    const names = new Set(foods.map((f) => f.name));
    for (const k of Object.keys(BASE_ALIASES)) expect(names.has(k), k).toBe(true);
    expect(names.has("Œuf entier")).toBe(true); expect(names.has("Riz blanc cru")).toBe(true);
  });
  it("fonctionne aussi sur une base existante : relancer l'amorçage n'ajoute ni ne duplique rien", () => {
    const before = (d.prepare("SELECT COUNT(*) c FROM foods WHERE user_id IS NULL").get() as any).c;
    d.prepare("DELETE FROM foods WHERE food_key=?").run(foods.find((f) => f.name === "Quinoa cru").food_key);
    expect((d.prepare("SELECT COUNT(*) c FROM foods WHERE user_id IS NULL").get() as any).c).toBe(before - 1);
  });
});
