import { it, expect } from "vitest";
import { compatible, missing } from "@/lib/equipment";
it("compatibilité matériel", () => {
  expect(compatible([], [])).toBe(true);
  expect(compatible(["haltères|kettlebell"], ["haltères"])).toBe(true);
  expect(compatible(["haltères", "banc"], ["haltères"])).toBe(false);
  expect(missing(["haltères", "banc"], ["haltères"])).toEqual(["banc"]);
  expect(compatible(["barre", "rack"], [], true)).toBe(true);
  expect(compatible(["banc|marche"], [])).toBe(true);
});
