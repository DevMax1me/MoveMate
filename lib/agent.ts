// Agent personnalisé V1 (cahier §15–17). Les chiffres viennent de fonctions déterministes ; l'agent ne produit que des
// propositions structurées, revalidées côté serveur avant affichage et avant application. Aucun id utilisateur ne vient du modèle.
import { all, get, run, uid, nowIso } from "./db";
import { P, J, todayIn } from "./http";
import { compatible } from "./equipment";
import { weekData } from "./api/stats";
import { currentLifestyle } from "./api/body";
import { latestFood, foodById } from "./api/nutrition";

export const RULES_VERSION = "agent-rules-1.0";
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe");

// Groupes d'exclusion : une exclusion explicite est une contrainte stricte (PRO 02).
const GROUPS: Record<string, string[]> = {
  viande: ["poulet", "boeuf", "jambon", "porc", "agneau", "dinde", "veau", "steak"], porc: ["porc", "jambon", "lard"], poisson: ["saumon", "thon", "cabillaud", "poisson"],
  laitage: ["lait", "yaourt", "fromage", "skyr", "beurre", "whey", "emmental"], lactose: ["lait", "yaourt", "fromage", "skyr", "whey", "emmental", "fromage blanc"],
  oeuf: ["oeuf"], oeufs: ["oeuf"], gluten: ["pates", "pain", "avoine", "ble", "farine", "flocons"], "fruits a coque": ["amande", "noix", "noisette", "cacahuete", "arachide"],
  arachide: ["cacahuete", "arachide"], soja: ["soja", "tofu"], vegetarien: ["poulet", "boeuf", "jambon", "porc", "saumon", "thon"], vegan: ["poulet", "boeuf", "jambon", "porc", "saumon", "thon", "oeuf", "lait", "yaourt", "fromage", "skyr", "whey", "beurre", "miel"],
};
export function matchesTerm(text: string, term: string): boolean {
  const t = norm(term).trim(), x = norm(text);
  if (!t) return false;
  if (x.includes(t)) return true;
  return (GROUPS[t] ?? []).some((w) => x.includes(w));
}
export const strictExclusions = (ls: any): string[] => [...(ls.excluded_foods ?? []), ...(ls.allergies ?? [])];
const isExcluded = (name: string, ls: any) => strictExclusions(ls).some((t) => matchesTerm(name, t));
const isDisliked = (name: string, ls: any) => (ls.disliked_foods ?? []).some((t: string) => matchesTerm(name, t));
const isLiked = (name: string, ls: any) => (ls.liked_foods ?? []).some((t: string) => matchesTerm(name, t));

// ---------- Recettes ----------
type Role = { cands: string[]; qty: number; unit?: "g" | "ml"; optional?: boolean };
type Tpl = { title: string; /* libellé neutre : jamais un nom d'aliment (les ingrédients sont substituables) */ time: number; budget: 1 | 2 | 3; tags: string[]; steps: string; roles: Role[] };
const TEMPLATES: Tpl[] = [
  { title: "Bol complet", time: 25, budget: 2, tags: ["plat complet"], steps: "Cuire le riz. Cuire la protéine à la poêle. Cuire les légumes à la vapeur. Assaisonner avec un filet d'huile.",
    roles: [{ cands: ["Poulet", "Thon", "Tofu", "Œuf", "Lentilles"], qty: 120 }, { cands: ["Riz blanc", "Pâtes", "Pommes de terre", "Riz complet"], qty: 150 }, { cands: ["Brocoli", "Haricots verts", "Carottes", "Tomates"], qty: 150 }, { cands: ["Huile d'olive"], qty: 5, unit: "ml", optional: true }] },
  { title: "Repas express", time: 10, budget: 1, tags: ["rapide"], steps: "Battre les œufs, cuire à feu moyen. Servir avec la salade et du pain.",
    roles: [{ cands: ["Œuf"], qty: 110 }, { cands: ["Salade verte", "Tomates"], qty: 100 }, { cands: ["Pain complet", "Pommes de terre"], qty: 60 }, { cands: ["Huile d'olive"], qty: 5, unit: "ml", optional: true }] },
  { title: "Plat de féculents", time: 15, budget: 1, tags: ["rapide", "petit budget"], steps: "Cuire les pâtes. Mélanger avec le thon égoutté et les tomates coupées.",
    roles: [{ cands: ["Pâtes", "Riz blanc"], qty: 180 }, { cands: ["Thon", "Œuf", "Tofu", "Pois chiches"], qty: 110 }, { cands: ["Tomates", "Haricots verts"], qty: 120 }, { cands: ["Huile d'olive"], qty: 5, unit: "ml", optional: true }] },
  { title: "Petit-déjeuner", time: 5, budget: 1, tags: ["petit-déjeuner", "rapide"], steps: "Chauffer les flocons avec la boisson 3 minutes. Ajouter les fruits.",
    roles: [{ cands: ["Flocons d'avoine"], qty: 50 }, { cands: ["Lait demi", "Boisson soja"], qty: 200, unit: "ml" }, { cands: ["Banane", "Pomme", "Fraises"], qty: 100 }] },
  { title: "Assiette de légumineuses", time: 30, budget: 3, tags: ["plat complet"], steps: "Réchauffer les lentilles. Cuire la protéine. Servir avec les légumes.",
    roles: [{ cands: ["Lentilles", "Pois chiches"], qty: 150 }, { cands: ["Saumon", "Poulet", "Tofu", "Œuf"], qty: 120 }, { cands: ["Brocoli", "Carottes", "Haricots verts"], qty: 150 }] },
  { title: "Salade composée", time: 10, budget: 1, tags: ["rapide", "froid", "petit budget"], steps: "Rincer les pois chiches, mélanger avec les légumes coupés et l'huile.",
    roles: [{ cands: ["Pois chiches", "Lentilles"], qty: 150 }, { cands: ["Tomates", "Carottes", "Salade verte"], qty: 120 }, { cands: ["Huile d'olive"], qty: 8, unit: "ml" }] },
  { title: "Assiette simple", time: 25, budget: 1, tags: ["petit budget"], steps: "Cuire les pommes de terre et les haricots. Cuire les œufs. Assembler.",
    roles: [{ cands: ["Pommes de terre"], qty: 200 }, { cands: ["Œuf", "Thon", "Tofu"], qty: 110 }, { cands: ["Haricots verts", "Brocoli"], qty: 150 }] },
  { title: "Collation", time: 3, budget: 1, tags: ["collation", "rapide", "emporter"], steps: "Mélanger.",
    roles: [{ cands: ["Skyr", "Fromage blanc", "Yaourt", "Boisson soja"], qty: 150 }, { cands: ["Pomme", "Banane", "Fraises", "Orange"], qty: 100 }] },
];

export type RecipeDraft = { title: string; servings: number; time_min: number; tags: string[]; steps: string; ingredients: { key: string; name: string; qty: number; unit: "g" | "ml" }[] };
export type Gen<T> = { ok: true; draft: T; uses: string[]; rationale: string } | { ok: false; conflict: string };

const BUDGET: Record<string, number> = { "serré": 1, moyen: 2, "souple": 3 };

export function proposeRecipe(userId: string, opts: { query?: string } = {}): Gen<RecipeDraft> {
  const ls = currentLifestyle(userId);
  const maxTime: number | null = ls.cook_time_max_min ?? null;
  const budget = BUDGET[ls.budget] ?? 3;
  const people = Math.max(1, ls.people ?? 1);
  const q = norm(opts.query ?? "");
  const wantQuick = /rapide|vite|15 min/.test(q);
  let best: { tpl: Tpl; ings: RecipeDraft["ingredients"]; score: number } | null = null;
  let reasonsOut: string[] = [];
  for (const tpl of TEMPLATES) {
    if (maxTime != null && tpl.time > maxTime) { reasonsOut.push(`« ${tpl.title} » dépasse ${maxTime} min`); continue; }
    if (tpl.budget > budget) { reasonsOut.push(`« ${tpl.title} » dépasse le budget`); continue; }
    if (wantQuick && tpl.time > 15) continue;
    const ings: RecipeDraft["ingredients"] = [];
    let ok = true, score = 0;
    for (const role of tpl.roles) {
      const foods = role.cands.map((c) => all<any>("SELECT food_key,name FROM foods WHERE (user_id IS NULL OR user_id=?) AND archived=0 AND name LIKE ? GROUP BY food_key", userId, `%${c}%`)).flat();
      const usable = foods.filter((f) => !isExcluded(f.name, ls));
      const soft = usable.filter((f) => !isDisliked(f.name, ls));
      const pick = (soft.length ? soft : usable).sort((a, b) => +isLiked(b.name, ls) - +isLiked(a.name, ls))[0];
      if (!pick) { if (role.optional) continue; ok = false; break; }
      if (isLiked(pick.name, ls)) score += 2;
      if (isDisliked(pick.name, ls)) score -= 1;
      ings.push({ key: pick.food_key, name: pick.name, qty: role.qty * people, unit: role.unit ?? "g" });
    }
    if (!ok) { reasonsOut.push(`« ${tpl.title} » : aucun ingrédient compatible avec vos exclusions`); continue; }
    if (q && norm(tpl.title + tpl.tags.join(" ")).split(/\W+/).some((w) => w.length > 3 && q.includes(w))) score += 3;
    score -= tpl.time / 100;
    if (!best || score > best.score) best = { tpl, ings, score };
  }
  if (!best) return { ok: false, conflict: `Aucune recette ne respecte à la fois vos contraintes (${[maxTime != null ? `${maxTime} min max` : "", ls.budget ? `budget ${ls.budget}` : "", strictExclusions(ls).length ? `exclusions : ${strictExclusions(ls).join(", ")}` : ""].filter(Boolean).join(" ; ") || "aucune"}). Je ne contourne pas vos exclusions : souhaitez-vous assouplir le temps, le budget ou une exclusion ? (${reasonsOut.slice(0, 3).join(" ; ")})` };
  const { tpl, ings } = best;
  const draft: RecipeDraft = { title: `${tpl.title} : ${ings.map((i) => i.name.toLowerCase()).join(", ")}`, servings: people, time_min: tpl.time, tags: tpl.tags, steps: tpl.steps, ingredients: ings };
  const uses = [maxTime != null ? `temps de préparation : ${maxTime} min au plus` : "temps de préparation : non renseigné (aucune limite supposée)", ls.budget ? `budget : ${ls.budget}` : "budget : non renseigné", `convives : ${people}`, strictExclusions(ls).length ? `exclusions respectées : ${strictExclusions(ls).join(", ")}` : "aucune exclusion déclarée"];
  return { ok: true, draft, uses, rationale: `Recette compatible avec votre profil. Les quantités sont des points de départ : vérifiez-les, elles ne remplacent pas votre choix. Les valeurs nutritionnelles seront calculées par le service après enregistrement.` };
}

/** Revalidation côté serveur d'un brouillon de recette (avant affichage et avant application). */
export function validateRecipeDraft(userId: string, d: any): string[] {
  const ls = currentLifestyle(userId);
  const errs: string[] = [];
  if (!d || typeof d.title !== "string" || !Array.isArray(d.ingredients) || !d.ingredients.length) return ["Proposition invalide."];
  for (const i of d.ingredients) {
    const f = latestFood(userId, String(i.key));
    if (!f) { errs.push(`Ingrédient inconnu ou non autorisé : ${String(i.key).slice(0, 30)}`); continue; }
    if (!(Number(i.qty) > 0) || !["g", "ml"].includes(i.unit)) errs.push(`Quantité ou unité invalide pour ${f.name}.`);
    if (isExcluded(f.name, ls)) errs.push(`« ${f.name} » est exclu par votre profil.`);
  }
  if (isExcluded(d.title, ls)) errs.push("Le titre contient un aliment exclu.");
  if (ls.cook_time_max_min != null && Number(d.time_min) > ls.cook_time_max_min) errs.push(`Dépasse votre temps de préparation maximal (${ls.cook_time_max_min} min).`);
  return errs;
}

// ---------- Routines ----------
export type RoutineDraft = { name: string; place: "home" | "gym"; items: { slug: string; name: string; sets: number; reps: string; rest: number; warmup_sets: number }[]; estimated_min: number };
const LEVELS = ["débutant", "intermédiaire", "avancé"];
export function estimateMinutes(items: { sets: number; rest: number }[]) { return Math.round(items.reduce((a, i) => a + i.sets * (0.75 + i.rest / 60), 0) + 3); }

export function proposeRoutine(userId: string, opts: { minutes?: number; place?: "home" | "gym" } = {}): Gen<RoutineDraft> {
  const ls = currentLifestyle(userId);
  const equipment: string[] = ls.equipment ?? [];
  const place = opts.place ?? (ls.gym ? "gym" : "home");
  const gym = place === "gym" && !!ls.gym;
  const maxMin: number = opts.minutes ?? ls.max_session_min ?? 45;
  const userLevel = Math.max(0, LEVELS.indexOf(ls.level || "débutant"));
  const exs = all<any>(`SELECT * FROM exercises e WHERE (user_id IS NULL OR user_id=?) AND archived=0 AND status='published'
    AND version=(SELECT MAX(version) FROM exercises x WHERE x.ex_key=e.ex_key AND (x.user_id IS NULL OR x.user_id=?)) ORDER BY name`, userId, userId)
    .filter((e) => LEVELS.indexOf(e.level) <= userLevel && (place === "gym" ? e.place !== "home" : e.place !== "gym") && compatible(P<string[]>(e.equipment, []), equipment, gym) && !isExcluded(e.name, {})); // exercices : pas d'exclusion alimentaire
  const slots = ["jambes", "poussée", "tirage", "tronc"];
  const items: RoutineDraft["items"] = [];
  for (const s of slots) {
    const pool = exs.filter((e) => e.movement === s).sort((a, b) => P<string[]>(a.equipment, []).length - P<string[]>(b.equipment, []).length);
    const e = pool[0];
    if (e) items.push({ slug: e.ex_key, name: e.name, sets: s === "tronc" ? 2 : 3, reps: "", rest: s === "tronc" ? 45 : place === "gym" ? 90 : 60, warmup_sets: 0 });
  }
  if (items.length < 2) return { ok: false, conflict: `Avec votre matériel (${equipment.join(", ") || "aucun"}) et le lieu « ${place === "gym" ? "salle" : "maison"} », je ne trouve pas assez d'exercices compatibles. Ajoutez du matériel à votre profil ou changez de lieu : je ne propose pas d'exercice dont le matériel manque.` };
  while (items.length > 2 && estimateMinutes(items) > maxMin) items.pop();
  while (estimateMinutes(items) > maxMin && items.some((i) => i.sets > 2)) { const i = items.find((x) => x.sets > 2)!; i.sets -= 1; }
  const est = estimateMinutes(items);
  if (est > maxMin) return { ok: false, conflict: `Même une structure minimale dépasse vos ${maxMin} min. Souhaitez-vous allonger la durée ?` };
  return { ok: true, draft: { name: `Séance ${place === "gym" ? "salle" : "maison"} ${items.length} exercices`, place, items, estimated_min: est },
    uses: [`matériel : ${equipment.join(", ") || "aucun"}${gym ? " + accès salle" : ""}`, `durée de séance : ${maxMin} min au plus`, `niveau : ${LEVELS[userLevel]}`, `lieu : ${place === "gym" ? "salle" : "maison"}`],
    rationale: `Structure issue du catalogue (un mouvement jambes/poussée/tirage/tronc, durée estimée ${est} min). Les répétitions et les charges restent à définir par vous ; rien n'est prescrit.` };
}
export function validateRoutineDraft(userId: string, d: any): string[] {
  const ls = currentLifestyle(userId);
  const errs: string[] = [];
  if (!d || typeof d.name !== "string" || !Array.isArray(d.items) || !d.items.length) return ["Proposition invalide."];
  const gym = d.place === "gym" && !!ls.gym;
  for (const i of d.items) {
    const e = get<any>("SELECT * FROM exercises WHERE ex_key=? AND (user_id IS NULL OR user_id=?) ORDER BY version DESC LIMIT 1", String(i.slug), userId);
    if (!e) { errs.push(`Exercice inconnu : ${String(i.slug).slice(0, 30)}`); continue; }
    if (!compatible(P<string[]>(e.equipment, []), ls.equipment ?? [], gym)) errs.push(`« ${e.name} » nécessite du matériel absent de votre profil.`);
    if (!(Number(i.sets) >= 1 && Number(i.sets) <= 20)) errs.push(`Nombre de séries invalide pour ${e.name}.`);
  }
  const est = estimateMinutes(d.items);
  if (ls.max_session_min != null && est > ls.max_session_min) errs.push(`Durée estimée ${est} min > votre maximum (${ls.max_session_min} min).`);
  return errs;
}

// ---------- Priorités de la semaine (ADA 02) ----------
export type Priority = { action: string; effort: string; slot: string; reason: string; short_option?: string; postpone_option?: string };
export function proposeWeekPriorities(userId: string, tz: string, max = 3): Gen<{ items: Priority[] }> {
  const ls = currentLifestyle(userId);
  const today = todayIn(tz);
  const wk = weekData(userId, today);
  const goal = get<any>("SELECT phase FROM goals WHERE user_id=? AND start_date<=? AND (end_date IS NULL OR end_date>=?) ORDER BY start_date DESC LIMIT 1", userId, today, today);
  const items: Priority[] = [];
  const logged = wk.days.filter((d) => d.state !== "non_renseignee").length;
  const weighDays = wk.weight.movingAverage.days;
  if (logged < 4) items.push({ action: "Noter vos repas quelques jours cette semaine", effort: "faible (2 min par repas)", slot: "à l'heure qui vous convient", reason: `${logged} journée(s) renseignée(s) sur les 7 derniers jours.`, postpone_option: "Reporter à la semaine prochaine, sans pénalité." });
  if (weighDays < 3) items.push({ action: "Faire au moins 3 pesées de référence", effort: "faible (1 min)", slot: "le matin si cela vous convient, ou un autre moment", reason: `${weighDays} jour(s) de pesée sur 7 : il en faut 3 pour afficher une tendance.`, postpone_option: "Reporter ou ignorer : le suivi du poids est facultatif." });
  const perWeek = ls.sessions_per_week ?? null;
  const done = wk.trainings.total;
  if (goal?.phase !== "pause" && (perWeek == null ? done === 0 : done < perWeek)) {
    const dur = ls.max_session_min ?? 30;
    items.push({ action: perWeek != null ? `Faire ${Math.max(1, perWeek - done)} séance(s) d'activité` : "Faire une séance ou une activité appréciée", effort: `jusqu'à ${dur} min`, slot: "un jour où vous êtes disponible",
      reason: perWeek != null ? `Vous visez ${perWeek} séance(s) par semaine ; ${done} réalisée(s) sur 7 jours.` : "Aucune fréquence déclarée : proposition légère.", short_option: `Version courte : ${Math.min(15, dur)} min`, postpone_option: "Report possible ; une séance manquée n'entraîne jamais de rattrapage obligatoire." });
  } else if (goal?.phase === "pause") items.push({ action: "Aucune obligation cette semaine (pause)", effort: "—", slot: "—", reason: "Votre phase actuelle est une pause." });
  if (!items.length) items.push({ action: "Continuer comme vous le faites", effort: "—", slot: "—", reason: "Vos habitudes de suivi sont régulières sur les 7 derniers jours." });
  return { ok: true, draft: { items: items.slice(0, Math.max(1, Math.min(max, 3))) }, uses: [`période : ${wk.start} → ${wk.end}`, `journées renseignées : ${logged}/7`, `séances/activités : ${done}`], rationale: "Au plus trois priorités. Vous pouvez accepter, modifier, refuser ou reporter sans pénalité." };
}

// ---------- Bilan expliqué (AGT 02) ----------
export function weekReport(userId: string, tz: string) {
  const wk = weekData(userId, todayIn(tz));
  const s = wk.summary, w = wk.weight;
  const lines: string[] = [];
  lines.push(`Période analysée : du ${wk.start} au ${wk.end}.`);
  lines.push(`Journées clôturées : ${s.closedDays} sur 7.`);
  lines.push(s.kcalAvg == null ? "Moyenne calorique : indisponible (aucune journée clôturée avec énergie complète)." : `Moyenne calorique : ${Math.round(s.kcalAvg)} kcal sur ${s.kcalDays} journée(s) complète(s) — couverture ${s.kcalCoverage}.`);
  lines.push(s.proteinAvg == null ? "Protéines : couverture insuffisante pour une moyenne." : `Protéines : ${Math.round(s.proteinAvg)} g en moyenne — couverture ${s.proteinCoverage}.`);
  lines.push(`Séances terminées : ${wk.trainings.completed}${wk.trainings.interrupted ? ` (+${wk.trainings.interrupted} interrompue(s))` : ""} ; autres activités : ${wk.trainings.activities}.`);
  lines.push(wk.adherence ? `Assiduité : ${wk.adherence.done}/${wk.adherence.planned} occurrences prévues.` : "Assiduité : aucune séance planifiée cette semaine (pas de pourcentage).");
  lines.push(w.movingAverage.insufficient ? `Poids : données insuffisantes pour la tendance (${w.movingAverage.days} jour(s) mesuré(s) sur 7).` : `Poids : moyenne mobile 7 jours ${w.movingAverage.avg!.toFixed(1)} kg sur ${w.movingAverage.days} jour(s) mesuré(s).`);
  const goal = get<any>("SELECT kcal FROM goals WHERE user_id=? AND start_date<=? AND (end_date IS NULL OR end_date>=?) ORDER BY start_date DESC LIMIT 1", userId, wk.end, wk.end);
  if (goal?.kcal == null) lines.push("Aucune cible calorique active : je n'en invente pas.");
  lines.push("Ce bilan est descriptif : il ne prouve pas de lien de cause entre alimentation et variation du poids, et ne déclenche aucune modification calorique.");
  return { text: lines.join("\n"), uses: [`période ${wk.start} → ${wk.end}`, "journal alimentaire", "pesées", "séances"], week: wk };
}

// ---------- Connaissances (CON 04) ----------
export function searchKnowledge(userId: string, query: string, limit = 5) {
  const words = norm(query).split(/\W+/).filter((w) => w.length > 2 && !STOP.has(w));
  if (!words.length) return [];
  const rows = all<any>(`SELECT * FROM notes n WHERE (user_id=? OR (user_id IS NULL AND status='validee')) AND status<>'archivee'
    AND version=(SELECT MAX(version) FROM notes x WHERE x.note_key=n.note_key AND (x.user_id IS n.user_id))`, userId);
  return rows.map((n) => {
    const hay = norm(`${n.title} ${n.content} ${P<string[]>(n.tags, []).join(" ")}`);
    const score = words.reduce((a, w) => a + (hay.includes(w) ? (norm(n.title).includes(w) ? 3 : 1) : 0), 0);
    return { n, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map(({ n }) => ({ note_key: n.note_key, title: n.title, excerpt: String(n.content).slice(0, 220), source: n.source, source_date: n.source_date, status: n.status, shared: n.user_id == null }));
}
const STOP = new Set(["les", "des", "une", "dans", "pour", "avec", "sur", "mon", "mes", "que", "quoi", "retrouve", "cherche", "recherche", "note", "notes", "fiche", "connaissance", "trouve", "moi", "est", "qui", "quel", "quelle"]);

// ---------- Routage de la conversation ----------
const MEDICAL = /(douleur|symptom|blessure|diagnostic|medicament|traitement|maladie|malaise|vertige|diabet|enceinte|tension arterielle|trouble alimentaire|anorex|boulim|depress)/;
const CROSS = /(autres? comptes?|autres? utilisateurs?|tous les (comptes|utilisateurs)|compte (de |du |d'|victime)|donnees de |journal de |poids de |memoire de |notes? de |mot de passe|admin(istrateur)? |[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,})/;
const INJECT = /(ignore (toutes? )?(les |tes |vos )?(instructions|consignes|regles|filtres?)|desactive (le |les )?(filtres?|regles|exclusions)|obeis a|oublie (tes|les|vos) (instructions|regles|consignes)|system prompt|prompt systeme|cle (api|fournisseur)|revele (tes|ton|les)|nouvelles? instructions|tu es maintenant|mode developpeur)/;

export type Reply = { text: string; uses?: string[]; citations?: any[]; proposalKind?: "recipe_draft" | "routine_draft" | "week_priorities" | "memory_fact"; draft?: any; rationale?: string; refused?: boolean };

export function route(userId: string, tz: string, message: string, memoryEnabled: boolean): Reply {
  const m = norm(message);
  if (INJECT.test(m)) return { text: "Je ne peux pas modifier mes règles, révéler des éléments internes ni agir hors de votre compte. Je reste disponible pour votre suivi : bilan, recette, routine, priorités ou recherche dans vos notes.", refused: true };
  if (CROSS.test(m)) return { text: "Je n'ai accès qu'à vos propres données. Je ne peux pas consulter ni communiquer les données d'un autre compte.", refused: true };
  if (MEDICAL.test(m)) return { text: "Cette demande relève de la santé : elle sort de ce que je peux adapter. Je ne pose pas de diagnostic et ne prescris rien. Parlez-en à un professionnel de santé ; je peux continuer à vous aider sur l'organisation et le suivi.", refused: true };
  if (/(retiens|memorise|souviens[- ]toi|garde en memoire)/.test(m)) {
    if (!memoryEnabled) return { text: "La mémorisation est désactivée dans vos réglages : je ne retiens rien." };
    const fact = message.replace(/^.*?(retiens|mémorise|memorise|souviens[- ]toi|garde en mémoire)\s*(que|:)?\s*/i, "").trim().slice(0, 300);
    if (fact.length < 3) return { text: "Que souhaitez-vous que je retienne ?" };
    return { text: "Je peux mémoriser ce fait après votre confirmation.", proposalKind: "memory_fact", draft: { fact, source: "Demandé par vous dans la conversation" }, rationale: "Un fait n'est mémorisé qu'après confirmation. Vous pourrez le corriger ou l'effacer dans « Ce que mon agent connaît de moi »." };
  }
  if (/(bilan|resume|semaine ecoulee|comment s'?est passee|ou j'?en suis)/.test(m)) {
    const r = weekReport(userId, tz);
    return { text: r.text, uses: r.uses };
  }
  if (/(priorite|organis|planifi|programme de la semaine|cette semaine)/.test(m)) {
    const g = proposeWeekPriorities(userId, tz);
    if (!g.ok) return { text: g.conflict };
    return { text: "Voici au plus trois priorités pour la semaine. Vous choisissez.", uses: g.uses, proposalKind: "week_priorities", draft: g.draft, rationale: g.rationale };
  }
  if (/(routine|seance|entrainement|workout)/.test(m) && /(prepare|cree|propose|fais|construis|monte)/.test(m)) {
    const min = message.match(/(\d{2,3})\s*(min|minutes)/i);
    const g = proposeRoutine(userId, { minutes: min ? Number(min[1]) : undefined });
    if (!g.ok) return { text: g.conflict };
    return { text: `Voici une structure de routine (≈ ${g.draft.estimated_min} min). Vérifiez l'aperçu avant de l'accepter.`, uses: g.uses, proposalKind: "routine_draft", draft: g.draft, rationale: g.rationale };
  }
  if (/(recette|repas|manger|diner|dejeuner|petit[- ]dejeuner|collation|cuisine)/.test(m)) {
    const g = proposeRecipe(userId, { query: message });
    if (!g.ok) return { text: g.conflict };
    return { text: `Voici un brouillon de recette : « ${g.draft.title} » (${g.draft.time_min} min).`, uses: g.uses, proposalKind: "recipe_draft", draft: g.draft, rationale: g.rationale };
  }
  if (/(objectif|cible|kcal|calories)/.test(m) && /(change|modifi|baisse|augment|nouvel)/.test(m)) {
    return { text: "Un changement d'objectif passe par un parcours dédié, avec une date d'effet : ouvrez « Mon compte → Objectifs ». Je ne le modifie jamais directement." };
  }
  const hits = searchKnowledge(userId, message);
  if (hits.length) return { text: `J'ai retrouvé ${hits.length} fiche(s) dans votre carnet. Les anciens conseils restent des repères datés, pas des consignes actuelles.`, citations: hits };
  return { text: "Je peux : faire le bilan de votre semaine, proposer une recette adaptée à votre profil, préparer une routine, suggérer au plus trois priorités, ou retrouver une note. Que souhaitez-vous ?" };
}

export function recordProposal(userId: string, kind: string, draft: unknown, rationale: string, uses: string[]) {
  const id = uid();
  run("INSERT INTO proposals(id,user_id,kind,payload,rationale,uses,status,created_at,rules_version) VALUES(?,?,?,?,?,?,'pending',?,?)", id, userId, kind, J(draft), rationale, J(uses), nowIso(), RULES_VERSION);
  return id;
}
void foodById;
