// Groupes musculaires : un identifiant stable pour l'interface (carte du corps, filtres) et la correspondance avec les libellés des fiches.
export type MuscleGroup = { id: string; label: string; tokens: string[]; map: boolean };
export const MUSCLE_GROUPS: MuscleGroup[] = [
  { id: "pectoraux", label: "Pectoraux", tokens: ["pectoraux"], map: true },
  { id: "epaules", label: "Épaules", tokens: ["épaules", "deltoïdes"], map: true },
  { id: "dos", label: "Dos", tokens: ["dos"], map: true },
  { id: "trapezes", label: "Trapèzes", tokens: ["trapèzes"], map: true },
  { id: "biceps", label: "Biceps", tokens: ["biceps"], map: true },
  { id: "triceps", label: "Triceps", tokens: ["triceps"], map: true },
  { id: "avant-bras", label: "Avant-bras", tokens: ["avant-bras"], map: true },
  { id: "abdominaux", label: "Abdominaux", tokens: ["abdominaux"], map: true },
  { id: "obliques", label: "Obliques", tokens: ["obliques"], map: true },
  { id: "lombaires", label: "Lombaires", tokens: ["lombaires"], map: true },
  { id: "fessiers", label: "Fessiers", tokens: ["fessiers", "abducteurs"], map: true },
  { id: "quadriceps", label: "Quadriceps", tokens: ["quadriceps"], map: true },
  { id: "ischio", label: "Ischio-jambiers", tokens: ["ischio-jambiers"], map: true },
  { id: "adducteurs", label: "Adducteurs", tokens: ["adducteurs"], map: true },
  { id: "mollets", label: "Mollets", tokens: ["mollets", "jambier", "chevilles"], map: true },
  { id: "hanches", label: "Hanches", tokens: ["hanches"], map: false },
  { id: "cardio", label: "Cardio", tokens: ["cardio"], map: false },
  { id: "corps", label: "Corps entier", tokens: ["corps entier"], map: false },
];
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const TOK = MUSCLE_GROUPS.map((g) => ({ id: g.id, tokens: g.tokens.map(norm) }));

/** Identifiants des groupes qui correspondent à une liste de libellés de muscles (« pectoraux (haut) » → pectoraux). */
export function groupsOf(muscles: string[]): string[] {
  const out = new Set<string>();
  for (const m of muscles) { const n = norm(m); for (const g of TOK) if (g.tokens.some((t) => n.includes(t))) out.add(g.id); }
  return [...out];
}
export const groupById = (id: string) => MUSCLE_GROUPS.find((g) => g.id === id);
/** Accepte l'identifiant ou l'ancien libellé (ex. « épaules »). */
export function resolveGroup(v: string): string | null {
  const n = norm(v);
  return MUSCLE_GROUPS.find((g) => g.id === n || norm(g.label) === n || g.tokens.map(norm).includes(n))?.id ?? null;
}
