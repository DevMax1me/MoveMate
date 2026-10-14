// Règles de calcul déterministes (cahier des charges §6, §7, §11, §13). Aucune dépendance serveur.

export type Nutrients = { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null };
export type FoodBasis = {
  basis: "100g" | "100ml" | "portion";
  portion_g?: number | null; // équivalent connu d'une portion (en g)
  portion_ml?: number | null;
  density?: number | null; // g/ml
  kcal: number | null; kcal_kj_only?: number | null;
  protein: number | null; carbs: number | null; fat: number | null; fiber: number | null;
};
export type Unit = "g" | "ml" | "portion";
export class CalcError extends Error {}

export const KJ_PER_KCAL = 4.184;
export const round1 = (n: number) => Math.round(n * 10) / 10;
export const roundKcal = (n: number) => Math.round(n);

/** CAL 03/04 : énergie source > kJ converti > estimation 4P+4G+9L (marquée). */
export function resolveEnergy(f: Pick<FoodBasis, "kcal" | "kcal_kj_only" | "protein" | "carbs" | "fat">): { kcal: number | null; estimated: boolean } {
  if (f.kcal != null) return { kcal: f.kcal, estimated: false };
  if (f.kcal_kj_only != null) return { kcal: f.kcal_kj_only / KJ_PER_KCAL, estimated: false };
  if (f.protein != null && f.carbs != null && f.fat != null) return { kcal: 4 * f.protein + 4 * f.carbs + 9 * f.fat, estimated: true };
  return { kcal: null, estimated: false };
}

export function validateFood(f: FoodBasis): string[] {
  const w: string[] = [];
  for (const k of ["kcal", "protein", "carbs", "fat", "fiber"] as const) if (f[k] != null && f[k]! < 0) throw new CalcError(`Valeur négative interdite (${k}).`);
  if (f.basis !== "portion") for (const k of ["protein", "carbs", "fat"] as const) if (f[k] != null && f[k]! > 100) w.push(`${k} > 100 g pour une base de 100.`);
  if (f.protein != null && f.carbs != null && f.fat != null && f.kcal != null) {
    const eq = 4 * f.protein + 4 * f.carbs + 9 * f.fat;
    if (f.kcal > 0 && Math.abs(eq - f.kcal) / f.kcal > 0.1) w.push("Énergie et macros incohérentes (écart > 10 %). Fibres, polyols ou alcool possibles.");
  }
  return w;
}

/** CAL 01/02 : quantité de référence en unité de base du produit. Retourne la quantité équivalente à la base. */
export function baseFactor(f: FoodBasis, qty: number, unit: Unit): number {
  if (!(qty > 0)) throw new CalcError("La quantité doit être strictement positive.");
  if (f.basis === "portion") {
    if (unit === "portion") return qty;
    throw new CalcError("Cet aliment est défini par portion : saisissez un nombre de portions.");
  }
  const ref = 100;
  if (unit === "portion") {
    const g = f.basis === "100g" ? f.portion_g : f.portion_ml;
    if (!g) throw new CalcError("Aucune portion connue pour cet aliment.");
    return (qty * g) / ref;
  }
  if (f.basis === "100g") {
    if (unit === "g") return qty / ref;
    if (!f.density) throw new CalcError("Conversion ml → g impossible sans densité explicite.");
    return (qty * f.density) / ref;
  }
  if (unit === "ml") return qty / ref;
  if (!f.density) throw new CalcError("Conversion g → ml impossible sans densité explicite.");
  return qty / f.density / ref;
}

export type Computed = { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null; incomplete: boolean; estimated: boolean };

/** Calcul décimal non arrondi ; les arrondis relèvent de l'affichage (CAL 05). */
export function computeFood(f: FoodBasis, qty: number, unit: Unit): Computed {
  const k = baseFactor(f, qty, unit);
  const { kcal, estimated } = resolveEnergy(f);
  const m = (v: number | null) => (v == null ? null : v * k);
  const out = { kcal: kcal == null ? null : kcal * k, protein: m(f.protein), carbs: m(f.carbs), fat: m(f.fat), fiber: m(f.fiber) };
  return { ...out, estimated, incomplete: out.protein == null || out.carbs == null || out.fat == null };
}

/** Somme sans remplacer l'inconnu par zéro (CAL 08). */
export function sumNutrients(items: Computed[]): Computed & { n: number; withKcal: number } {
  const acc = { kcal: null as number | null, protein: null as number | null, carbs: null as number | null, fat: null as number | null, fiber: null as number | null };
  const add = (a: number | null, b: number | null) => (b == null ? a : (a ?? 0) + b);
  let incomplete = false, estimated = false, withKcal = 0;
  for (const i of items) {
    for (const k of Object.keys(acc) as (keyof typeof acc)[]) acc[k] = add(acc[k], i[k]);
    if (i.incomplete) incomplete = true;
    if (i.estimated) estimated = true;
    if (i.kcal != null) withKcal++;
  }
  return { ...acc, incomplete, estimated, n: items.length, withKcal };
}

/** CAL 06 : reste = cible − calories connues ; négatif = dépassement. */
export function remaining(target: number | null | undefined, consumed: number | null): number | null {
  if (target == null) return null;
  return target - (consumed ?? 0);
}

/** Cohérence des objectifs : 4P+4G+9L vs cible, seuil configurable (défaut 10 %). */
export function goalCoherence(g: { kcal?: number | null; protein?: number | null; carbs?: number | null; fat?: number | null }, threshold = 0.1) {
  if (g.protein == null || g.carbs == null || g.fat == null) return null;
  const eq = 4 * g.protein + 4 * g.carbs + 9 * g.fat;
  const gap = g.kcal ? Math.abs(eq - g.kcal) / g.kcal : 0;
  return { equivalent: eq, gap, warning: g.kcal != null && gap > threshold };
}

// ---------- Recettes (REC 02) ----------
export type RecipeInput = { servings: number; finalWeight?: number | null; totals: Computed };
export type Portion = { mode: "portion"; fraction: number } | { mode: "grams"; grams: number };

export function recipePortion(r: RecipeInput, p: Portion): Computed {
  let fraction: number;
  if (p.mode === "portion") {
    if (!(p.fraction > 0)) throw new CalcError("Portion invalide.");
    fraction = p.fraction / r.servings; // fraction = nombre de portions consommées
  } else {
    if (!r.finalWeight) throw new CalcError("Poids final non renseigné : saisissez une portion plutôt qu'une quantité en grammes.");
    if (!(p.grams > 0)) throw new CalcError("Quantité invalide.");
    fraction = p.grams / r.finalWeight;
  }
  const m = (v: number | null) => (v == null ? null : v * fraction);
  const t = r.totals;
  return { kcal: m(t.kcal), protein: m(t.protein), carbs: m(t.carbs), fat: m(t.fat), fiber: m(t.fiber), incomplete: t.incomplete, estimated: t.estimated };
}

// ---------- Journée / semaine (NUT 04, TDB 02) ----------
export type DayState = "non_renseignee" | "partielle" | "terminee";
export function dayState(entryCount: number, closed: boolean): DayState {
  if (entryCount === 0) return "non_renseignee";
  return closed ? "terminee" : "partielle";
}
export type DaySummary = { date: string; state: DayState; kcal: number | null; protein: number | null; kcalComplete: boolean; proteinComplete: boolean };

/** Moyenne sur les journées clôturées avec énergie complète ; jamais divisée par 7 par défaut. */
export function weekSummary(days: DaySummary[], windowDays = 7) {
  const closed = days.filter((d) => d.state === "terminee");
  const kcalDays = closed.filter((d) => d.kcalComplete && d.kcal != null);
  const proteinDays = closed.filter((d) => d.proteinComplete && d.protein != null);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  return {
    closedDays: closed.length,
    windowDays,
    kcalAvg: avg(kcalDays.map((d) => d.kcal!)),
    kcalCoverage: `${kcalDays.length}/${windowDays}`,
    kcalDays: kcalDays.length,
    proteinAvg: avg(proteinDays.map((d) => d.protein!)),
    proteinCoverage: `${proteinDays.length}/${windowDays}`,
  };
}

// ---------- Poids (POI 02, POI 03) ----------
export type WeightPoint = { date: string; kg: number };
export function addDays(date: string, n: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** Moyenne mobile 7 j sur les pesées de référence J−6..J. <3 mesures → insuffisant. */
export function movingAverage7(points: WeightPoint[], date: string) {
  const from = addDays(date, -6);
  const inWin = points.filter((p) => p.date >= from && p.date <= date);
  const days = new Set(inWin.map((p) => p.date)).size;
  if (days < 3) return { avg: null as number | null, days, insufficient: true };
  const avg = inWin.reduce((a, p) => a + p.kg, 0) / inWin.length;
  return { avg, days, insufficient: false };
}
/** Variation hebdomadaire : deux fenêtres consécutives de 7 j, chacune avec ≥3 pesées. */
export function weeklyVariation(points: WeightPoint[], date: string) {
  const cur = movingAverage7(points, date);
  const prev = movingAverage7(points, addDays(date, -7));
  if (cur.insufficient || prev.insufficient) return { delta: null as number | null, cur, prev };
  return { delta: cur.avg! - prev.avg!, cur, prev };
}
/** Progression vers l'objectif (baisse ou hausse). Null si départ = cible. Barre bornée 0–100, écart réel conservé. */
export function goalProgress(start: number, current: number, target: number) {
  if (start === target) return null;
  const pct = ((start - current) / (start - target)) * 100;
  return { pct, bar: Math.max(0, Math.min(100, pct)), gap: current - target };
}

// ---------- Séances (STA 01) ----------
export type SetLike = { kind: "warmup" | "work"; reps?: number | null; load?: number | null; bodyweight?: boolean; assisted?: boolean; bilateralDumbbells?: boolean };
/** Charge externe totale : 2 haltères de 20 kg avec répétitions bilatérales → 40 kg. */
export function externalLoad(s: SetLike): number | null {
  if (s.load == null) return null;
  return s.bilateralDumbbells ? s.load * 2 : s.load;
}
export function strengthVolume(sets: SetLike[]) {
  let external = 0;
  let bodyweightSets = 0;
  for (const s of sets) {
    if (s.kind !== "work") continue;
    if (s.bodyweight || s.assisted) { bodyweightSets++; continue; }
    const l = externalLoad(s);
    if (l == null || s.reps == null) continue; // uniquement les répétitions réellement documentées
    external += s.reps * l;
  }
  return { external, bodyweightSets };
}
/** Assiduité : prévues non annulées vs séances liées. Aucune semaine sans planning → pas de pourcentage. */
export function adherence(planned: { status: string }[]) {
  const counted = planned.filter((p) => p.status !== "annule");
  if (!counted.length) return null;
  const done = counted.filter((p) => p.status === "realise").length;
  return { done, planned: counted.length, pct: (done / counted.length) * 100 };
}

export const fmt = {
  kcal: (n: number | null | undefined) => (n == null ? "—" : String(roundKcal(n))),
  g: (n: number | null | undefined) => (n == null ? "—" : round1(n).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 1 })),
  kg: (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })),
};
/** Accepte la virgule décimale française. */
export function parseNum(s: string | number | null | undefined): number | null {
  if (s == null || s === "") return null;
  if (typeof s === "number") return Number.isFinite(s) ? s : null;
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
