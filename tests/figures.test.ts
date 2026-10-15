import { describe, it, expect } from "vitest";
import { buildCatalog } from "@/lib/catalog-exercises";
import { ARCHETYPES, PATTERN_CHOICES, figureSvg, specById, specFor } from "@/lib/figures";
import { MUSCLE_GROUPS, groupsOf, resolveGroup } from "@/lib/muscles";

const cat = buildCatalog();
const asLike = (c: (typeof cat)[number]) => ({ name: c.name, pattern: c.pattern, equipment: c.equipment, primary_muscles: c.primary, movement: c.movement });
const numbers = (s: string) => [...s.matchAll(/-?\d+(?:\.\d+)?(?:e-?\d+)?/gi)].map((m) => Number(m[0]));

describe("schémas de mouvement", () => {
  it("chaque archétype se dessine, au départ comme à la fin, avec des coordonnées finies", () => {
    expect(ARCHETYPES.length).toBeGreaterThanOrEqual(55);
    for (const id of ARCHETYPES) for (const t of [0, 0.5, 1]) {
      const r = figureSvg(specById(id), t);
      expect(r.inner, id).toContain("<");
      expect(r.viewBox.split(" ").length, id).toBe(4);
      for (const n of numbers(r.viewBox + " " + r.inner.replace(/class="[^"]*"/g, ""))) expect(Number.isFinite(n), `${id} t=${t}`).toBe(true);
    }
  });
  it("toutes les fiches du catalogue obtiennent un schéma valide", () => {
    for (const c of cat) { const s = specFor(asLike(c)); expect(ARCHETYPES, c.name).toContain(s.id); const r = figureSvg(s, 0); expect(r.inner.length, c.name).toBeGreaterThan(50); }
  });
  it("le schéma de repli (respiration) reste réservé à la mobilité", () => {
    const wrong = cat.filter((c) => specFor(asLike(c)).id === "breathe" && !["mob", "stretch"].includes(c.pattern)).map((c) => `${c.name} [${c.pattern}]`);
    expect(wrong).toEqual([]);
  });
  it("un exercice dont le nom précise l'appareil a un schéma cohérent", () => {
    const id = (name: string, pattern: string, equipment: string[] = []) => specFor({ name, pattern, equipment }).id;
    expect(id("Pompes", "pushUp")).toBe("pushup");
    expect(id("Tirage horizontal à la poulie basse", "pullH", ["poulie"])).toBe("seatedRow");
    expect(id("Tractions", "pullV", ["barre de traction"])).toBe("pullup");
    expect(id("Élévations latérales", "lateral", ["haltères"])).toBe("lateral");
    expect(id("Presse à cuisses", "squat", ["machine"])).toBe("legPress");
    expect(id("Planche", "plank")).toBe("plankFore"); // appui sur les avant-bras, comme la fiche le décrit
    expect(id("Planche haute", "plank")).toBe("plank");
  });
  it("chaque type de mouvement proposé pour un exercice privé donne un schéma", () => {
    expect(PATTERN_CHOICES.length).toBeGreaterThanOrEqual(25);
    for (const [p, label] of PATTERN_CHOICES) { expect(label.length).toBeGreaterThan(3); expect(ARCHETYPES).toContain(specFor({ name: "Exercice privé", pattern: p }).id); }
  });
  it("toutes les fiches ont un type de mouvement, et un nom de type connu", () => {
    const known = new Set(PATTERN_CHOICES.map(([p]) => p));
    const unknown = [...new Set(cat.map((c) => c.pattern).filter((p) => !known.has(p)))];
    // les modèles internes absents de la liste proposée aux utilisateurs restent autorisés mais doivent être peu nombreux
    expect(unknown.length, unknown.join(",")).toBeLessThanOrEqual(8);
    for (const c of cat) expect(c.pattern, c.name).toBeTruthy();
  });
});

describe("groupes musculaires", () => {
  it("les libellés du catalogue tombent dans un groupe de la carte (aucune fiche introuvable par muscle)", () => {
    const orphan = cat.filter((c) => groupsOf(c.primary).length === 0).map((c) => `${c.name} : ${c.primary.join("/")}`);
    expect(orphan).toEqual([]);
  });
  it("chaque groupe de la carte a des exercices, et les ids sont uniques", () => {
    expect(new Set(MUSCLE_GROUPS.map((g) => g.id)).size).toBe(MUSCLE_GROUPS.length);
    for (const g of MUSCLE_GROUPS) expect(cat.filter((c) => groupsOf(c.primary).includes(g.id)).length, g.id).toBeGreaterThanOrEqual(g.map && g.id !== "adducteurs" && g.id !== "trapezes" ? 8 : 3);
  });
  it("accepte l'identifiant comme l'ancien libellé", () => {
    expect(resolveGroup("épaules")).toBe("epaules"); expect(resolveGroup("Ischio-jambiers")).toBe("ischio"); expect(resolveGroup("pectoraux")).toBe("pectoraux"); expect(resolveGroup("n'importe quoi")).toBeNull();
    expect(groupsOf(["pectoraux (haut)", "deltoïdes antérieurs"])).toEqual(expect.arrayContaining(["pectoraux", "epaules"]));
  });
});
