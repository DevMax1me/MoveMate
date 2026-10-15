import { describe, it, expect } from "vitest";
import { buildCatalog } from "@/lib/catalog-exercises";
import { explain } from "@/lib/explain";
import { eqLabel } from "@/lib/equipment";

const cat = buildCatalog();
const ex = (c: (typeof cat)[number]) => explain({ name: c.name, alias: c.alias, pattern: c.pattern, equipment: c.equipment, primary_muscles: c.primary, movement: c.movement });
const byName = (re: RegExp) => cat.filter((c) => re.test(c.name));

describe("explications en langage courant", () => {
  it("chaque fiche du catalogue a une explication complète (phrase, matériel, muscles)", () => {
    for (const c of cat) {
      const x = ex(c);
      expect(x.summary.length, c.name).toBeGreaterThan(30); expect(x.summary, c.name).toMatch(/[.!]$/); expect(x.summary, c.name).not.toContain("undefined");
      expect(x.how, c.name).toContain("Travaille surtout"); expect(x.terms.length, c.name).toBeLessThanOrEqual(5);
    }
  });
  it("les mots de salle sont expliqués quand ils figurent dans le nom", () => {
    const isoLat = byName(/iso-?lat[ée]ral/i); expect(isoLat.length).toBeGreaterThan(10);
    for (const c of isoLat) expect(ex(c).terms.map((t) => t.term), c.name).toContain("Iso-latéral");
    const marteau = byName(/marteau/i); expect(marteau.length).toBeGreaterThan(3);
    for (const c of marteau) expect(ex(c).terms.some((t) => /marteau/i.test(t.term)), c.name).toBe(true);
    for (const c of byName(/smith/i)) expect(ex(c).terms.map((t) => t.term), c.name).toContain("Smith machine");
    for (const c of byName(/hip thrust/i)) expect(ex(c).terms.map((t) => t.term), c.name).toContain("Hip thrust");
    expect(cat.filter((c) => ex(c).terms.length > 0).length).toBeGreaterThanOrEqual(300);
  });
  it("le matériel est décrit sans confondre barre libre et barre de traction", () => {
    const t = byName(/^Tractions/)[0]; expect(ex(t).how).toContain("suspendu"); expect(ex(t).how).not.toContain("disques");
    const hip = byName(/^Hip thrust barre/)[0]; expect(ex(hip).how).toContain("barre longue");
    const pompes = byName(/^Pompes diamant/)[0]; expect(ex(pompes).how).toContain("Sans matériel");
  });
  it("« a|b » se lit « a ou b » : le matériel alternatif n'est pas présenté comme cumulatif", () => {
    const x = explain({ name: "Goblet squat", pattern: "squat", equipment: ["haltères|kettlebell"] });
    expect(x.how).toMatch(/haltères.* ou .*kettlebell/); expect(eqLabel(["haltères|kettlebell", "banc"])).toBe("haltères ou kettlebell, banc"); expect(eqLabel([])).toBe("sans matériel");
  });
  it("phrases propres au nom quand il le permet", () => {
    expect(ex(byName(/^Tractions/)[0]).summary).toMatch(/hisse/);
    expect(ex(byName(/^Presse à cuisses/i)[0]).summary).toMatch(/plateforme/);
    expect(explain({ name: "Exercice inconnu" }).summary.length).toBeGreaterThan(20); // jamais vide
  });
});
