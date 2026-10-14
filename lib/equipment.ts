// Profil de matériel (ROU 06) : vocabulaire utilisateur et compatibilité exercice ↔ matériel.
export const EQUIPMENT = ["élastiques", "haltères", "banc", "barre", "rack", "machines", "barre de traction", "vélo"] as const;
const ALIAS: Record<string, string> = { élastique: "élastiques", kettlebell: "haltères", machine: "machines", "vélo": "vélo" };
// Éléments domestiques supposés disponibles à la maison.
const HOUSEHOLD = new Set(["marche", "surface surélevée", "corde", "bâton"]);
const norm = (t: string) => ALIAS[t] ?? t;

/** Chaque entrée est requise ; « a|b » signifie a ou b. Salle = accès aux machines et au matériel. */
export function compatible(required: string[], profile: string[], gymAccess = false): boolean {
  const have = new Set(profile.map(norm));
  if (gymAccess) for (const e of EQUIPMENT) have.add(e);
  return required.every((r) => r.split("|").some((t) => HOUSEHOLD.has(t) || have.has(norm(t))));
}
export function missing(required: string[], profile: string[], gymAccess = false): string[] {
  const have = new Set(profile.map(norm));
  if (gymAccess) for (const e of EQUIPMENT) have.add(e);
  return required.filter((r) => !r.split("|").some((t) => HOUSEHOLD.has(t) || have.has(norm(t)))).map((r) => r.split("|").join(" ou "));
}
