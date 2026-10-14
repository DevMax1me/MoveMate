import { describe, it, expect } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { openDb } from "@/lib/db";

describe("T22 catalogue initial", () => {
  const d: DatabaseSync = openDb(":memory:");
  const ex = d.prepare("SELECT * FROM exercises WHERE user_id IS NULL").all() as any[];
  it("40 fiches avec répartition par famille", () => {
    expect(ex.length).toBe(40);
    const count = (m: string) => ex.filter((e) => e.movement === m).length;
    expect([count("poussée"), count("tirage"), count("jambes"), count("tronc"), count("cardio"), count("mobilité")]).toEqual([8, 8, 10, 6, 5, 3]);
  });
  it("≥15 maison dont ≥10 sans équipement, ≥15 salle", () => {
    const home = ex.filter((e) => e.place !== "gym");
    const bare = home.filter((e) => JSON.parse(e.equipment).length === 0);
    expect(home.length).toBeGreaterThanOrEqual(15); expect(bare.length).toBeGreaterThanOrEqual(10);
    expect(ex.filter((e) => e.place !== "home").length).toBeGreaterThanOrEqual(15);
  });
  it("3 routines de démonstration, aliments génériques", () => {
    expect((d.prepare("SELECT COUNT(*) c FROM routines WHERE demo=1").get() as any).c).toBe(3);
    expect((d.prepare("SELECT COUNT(*) c FROM foods WHERE user_id IS NULL").get() as any).c).toBeGreaterThanOrEqual(30);
  });
  it("alternatives et variantes pointent vers des fiches existantes", () => {
    const keys = new Set(ex.map((e) => e.ex_key));
    for (const e of ex) for (const k of [e.easier, e.alternative]) if (k) expect(keys.has(k), `${e.ex_key} → ${k}`).toBe(true);
  });
});
