import { describe, it, expect } from "vitest";
import * as c from "@/lib/calc";

const f250: c.FoodBasis = { basis: "100g", kcal: 250, protein: 20, carbs: 10, fat: 12, fiber: null };

describe("recette fonctionnelle — calculs", () => {
  it("T02 aliment 250 kcal/100 g, 150 g → 375 kcal, protéines 20 g/100 g → 30 g", () => {
    const r = c.computeFood(f250, 150, "g");
    expect(r.kcal).toBeCloseTo(375); expect(r.protein).toBeCloseTo(30);
  });
  it("T02 portion connue", () => {
    const r = c.computeFood({ ...f250, portion_g: 30 }, 2, "portion");
    expect(r.kcal).toBeCloseTo(150);
  });
  it("T03 base 100 ml : 250 ml ok ; g sans densité refusé", () => {
    const f: c.FoodBasis = { basis: "100ml", kcal: 50, protein: 1, carbs: 10, fat: 0, fiber: null };
    expect(c.computeFood(f, 250, "ml").kcal).toBeCloseTo(125);
    expect(() => c.computeFood(f, 250, "g")).toThrow(c.CalcError);
    expect(c.computeFood({ ...f, density: 1.03 }, 103, "g").kcal).toBeCloseTo(50);
  });
  it("T04 énergie seule : macros incomplètes, protéines inconnues ≠ 0", () => {
    const r = c.computeFood({ basis: "100g", kcal: 200, protein: null, carbs: null, fat: null, fiber: null }, 50, "g");
    expect(r.kcal).toBeCloseTo(100); expect(r.protein).toBeNull(); expect(r.incomplete).toBe(true);
    const s = c.sumNutrients([r]);
    expect(s.protein).toBeNull();
  });
  it("CAL 04 kJ → kcal et CAL 03 estimation marquée", () => {
    expect(c.resolveEnergy({ kcal: null, kcal_kj_only: 418.4, protein: null, carbs: null, fat: null }).kcal).toBeCloseTo(100);
    const e = c.resolveEnergy({ kcal: null, protein: 10, carbs: 10, fat: 10 });
    expect(e.kcal).toBe(170); expect(e.estimated).toBe(true);
  });
  it("T05 recette 1000 kcal, 2 portions → 500 ; poids final 800 g, 300 g → 375", () => {
    const totals: c.Computed = { kcal: 1000, protein: 80, carbs: 100, fat: 30, fiber: null, incomplete: false, estimated: false };
    expect(c.recipePortion({ servings: 2, totals }, { mode: "portion", fraction: 1 }).kcal).toBeCloseTo(500);
    expect(c.recipePortion({ servings: 2, totals }, { mode: "portion", fraction: 1 }).protein).toBeCloseTo(40);
    const g = c.recipePortion({ servings: 2, finalWeight: 800, totals }, { mode: "grams", grams: 300 });
    expect(g.kcal).toBeCloseTo(375); expect(g.protein).toBeCloseTo(30);
    expect(() => c.recipePortion({ servings: 2, totals }, { mode: "grams", grams: 300 })).toThrow(c.CalcError);
  });
  it("T07 deux journées complètes 2000/2200 → moyenne 2100, couverture 2/7", () => {
    const mk = (d: string, kcal: number | null, state: c.DayState): c.DaySummary => ({ date: d, state, kcal, protein: null, kcalComplete: kcal != null, proteinComplete: false });
    const w = c.weekSummary([mk("1", 2000, "terminee"), mk("2", 2200, "terminee"), mk("3", null, "non_renseignee")]);
    expect(w.kcalAvg).toBe(2100); expect(w.kcalCoverage).toBe("2/7");
  });
  it("T09 sept pesées 100→94 : moyenne 97 ; deux pesées : insuffisant", () => {
    const pts = [100, 99, 98, 97, 96, 95, 94].map((kg, i) => ({ date: c.addDays("2026-10-01", i), kg }));
    expect(c.movingAverage7(pts, "2026-10-07").avg).toBeCloseTo(97);
    expect(c.movingAverage7(pts.slice(0, 2), "2026-10-02").insufficient).toBe(true);
  });
  it("variation hebdo exige 2 fenêtres couvertes", () => {
    const a = [80, 80, 80].map((kg, i) => ({ date: c.addDays("2026-10-01", i), kg }));
    const b = [79, 79, 79].map((kg, i) => ({ date: c.addDays("2026-10-08", i), kg }));
    expect(c.weeklyVariation([...a, ...b], "2026-10-14").delta).toBeCloseTo(-1);
    expect(c.weeklyVariation(b, "2026-10-14").delta).toBeNull();
  });
  it("progression poids : formule du cahier, bornée, null si départ = cible", () => {
    expect(c.goalProgress(100, 90, 80)!.pct).toBe(50);
    expect(c.goalProgress(100, 110, 80)!.bar).toBe(0);
    expect(c.goalProgress(100, 110, 80)!.gap).toBe(30);
    expect(c.goalProgress(80, 80, 80)).toBeNull();
  });
  it("T12 3×6 à 50 kg → 900 ; poids du corps séparé ; haltères bilatéraux", () => {
    const sets: c.SetLike[] = [1, 2, 3].map(() => ({ kind: "work", reps: 6, load: 50 }));
    sets.push({ kind: "work", reps: 10, bodyweight: true }, { kind: "warmup", reps: 10, load: 20 });
    const v = c.strengthVolume(sets);
    expect(v.external).toBe(900); expect(v.bodyweightSets).toBe(1);
    expect(c.strengthVolume([{ kind: "work", reps: 5, load: 20, bilateralDumbbells: true }]).external).toBe(200);
  });
  it("reste calorique : négatif = dépassement, null sans cible", () => {
    expect(c.remaining(2000, 2300)).toBe(-300);
    expect(c.remaining(null, 100)).toBeNull();
  });
  it("cohérence des objectifs et état de journée", () => {
    expect(c.goalCoherence({ kcal: 2000, protein: 150, carbs: 200, fat: 60 })!.warning).toBe(false);
    expect(c.goalCoherence({ kcal: 1500, protein: 150, carbs: 200, fat: 60 })!.warning).toBe(true);
    expect(c.dayState(0, true)).toBe("non_renseignee");
    expect(c.dayState(2, false)).toBe("partielle");
  });
  it("assiduité : annulées exclues, null sans planning", () => {
    expect(c.adherence([])).toBeNull();
    expect(c.adherence([{ status: "realise" }, { status: "prevu" }, { status: "annule" }])!.pct).toBe(50);
  });
  it("virgule décimale française", () => { expect(c.parseNum("72,5")).toBe(72.5); expect(c.parseNum("abc")).toBeNull(); });
  it("validation : négatif refusé, incohérence signalée", () => {
    expect(() => c.validateFood({ ...f250, protein: -1 })).toThrow();
    expect(c.validateFood({ basis: "100g", kcal: 100, protein: 30, carbs: 30, fat: 30, fiber: null }).length).toBeGreaterThan(0);
  });
});
