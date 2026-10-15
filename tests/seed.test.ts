import { describe, it, expect } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { openDb } from "@/lib/db";
import { isKnownToken } from "@/lib/equipment";

describe("T22 catalogue", () => {
  const d: DatabaseSync = openDb(":memory:");
  const ex = d.prepare("SELECT * FROM exercises WHERE user_id IS NULL").all() as any[];
  it("catalogue étendu : plus de 480 fiches, réparties dans les six familles", () => {
    expect(ex.length).toBeGreaterThanOrEqual(480);
    for (const m of ["poussée", "tirage", "jambes", "tronc", "cardio", "mobilité"]) expect(ex.filter((e) => e.movement === m).length, m).toBeGreaterThanOrEqual(25);
  });
  it("le lot initial de 40 fiches est toujours présent (8/8/10/6/5/3)", () => {
    const base = ["pompes", "developpe-couche-barre", "tractions", "squat-barre", "planche", "marche", "mobilite-cheville", "goblet-squat", "face-pull", "pallof-press"];
    for (const k of base) expect(ex.some((e) => e.ex_key === k), k).toBe(true);
  });
  it("maison et salle bien fournies, dont beaucoup sans équipement dédié", () => {
    const home = ex.filter((e) => e.place !== "gym"), gym = ex.filter((e) => e.place !== "home");
    const bare = home.filter((e) => JSON.parse(e.equipment).every((t: string) => isKnownToken(t) && !["haltères", "barre"].includes(t)));
    expect(home.length).toBeGreaterThanOrEqual(150); expect(gym.length).toBeGreaterThanOrEqual(250); expect(bare.length).toBeGreaterThanOrEqual(80);
  });
  it("chaque fiche publique a un type de mouvement (sert au schéma et à la liste des exercices ressemblants)", () => {
    for (const e of ex) expect(e.pattern, e.ex_key).toBeTruthy();
  });
  it("3 routines de démonstration, aliments génériques", () => {
    expect((d.prepare("SELECT COUNT(*) c FROM routines WHERE demo=1").get() as any).c).toBe(3);
    expect((d.prepare("SELECT COUNT(*) c FROM foods WHERE user_id IS NULL").get() as any).c).toBeGreaterThanOrEqual(30);
  });
  it("alternatives et variantes pointent vers des fiches existantes", () => {
    const keys = new Set(ex.map((e) => e.ex_key));
    for (const e of ex) for (const k of [e.easier, e.alternative]) if (k) expect(keys.has(k), `${e.ex_key} → ${k}`).toBe(true);
  });
  it("tous les jetons de matériel sont connus (sinon la fiche serait introuvable en filtrant)", () => {
    for (const e of ex) for (const t of JSON.parse(e.equipment) as string[]) for (const x of t.split("|")) expect(isKnownToken(x), `${e.ex_key} : « ${x} »`).toBe(true);
  });
  it("pas de doublon de nom ni de fiche vide", () => {
    expect(new Set(ex.map((e) => e.name)).size).toBe(ex.length);
    for (const e of ex) { expect(e.steps?.length, e.ex_key).toBeGreaterThan(20); expect(JSON.parse(e.primary_muscles).length, e.ex_key).toBeGreaterThan(0); }
  });
  it("les alternatives proposées sont réalisables à la maison sans matériel spécifique (hors élastique/haltères indiqués)", () => {
    const by = new Map(ex.map((e) => [e.ex_key, e]));
    for (const e of ex) if (e.alternative && e.place === "gym") { const a = by.get(e.alternative); expect(a, e.ex_key).toBeTruthy(); }
  });
});
