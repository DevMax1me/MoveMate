// Profil de matériel (ROU 06) : vocabulaire utilisateur et compatibilité exercice ↔ matériel.
export const EQUIPMENT = ["élastiques", "haltères", "kettlebell", "banc", "barre", "rack", "smith", "poulie", "machines", "barre de traction", "barres parallèles", "anneaux", "swiss ball", "medecine ball", "roue abdominale", "step", "vélo", "rameur", "tapis", "battle ropes", "sac de frappe", "traîneau", "corde"] as const;
const ALIAS: Record<string, string> = { "élastique": "élastiques", machine: "machines", disques: "barre", "disque": "barre" };
// Éléments de la maison supposés disponibles : une chaise, un mur, un sac à dos chargé, une serviette… (version « sans matériel »).
const HOUSEHOLD = new Set(["marche", "surface surélevée", "bâton", "chaise", "mur", "table", "sac à dos", "serviette", "porte", "canapé", "escalier", "bouteilles"]);
const norm = (t: string) => ALIAS[t] ?? t;

/** Chaque entrée est requise ; « a|b » signifie a ou b. Un accès salle donne tout le matériel. */
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
/** Vrai si le jeton de matériel d'une fiche est connu (profil, alias ou élément domestique). Sert aux tests de cohérence du catalogue. */
export const isKnownToken = (t: string) => (EQUIPMENT as readonly string[]).includes(norm(t)) || HOUSEHOLD.has(t);
