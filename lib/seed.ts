import type { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";
import { buildCatalog } from "./catalog-exercises";

const id = () => crypto.randomBytes(12).toString("base64url");
const now = () => new Date().toISOString();

// Aliments génériques : valeurs indicatives pour 100 g/100 ml (kcal, P, G, L, fibres). À relire avant ouverture (cahier §4).
// [nom, base, kcal, P, G, L, fibres, portion_g, libellé portion, densité]
type F = [string, "100g" | "100ml", number, number, number, number, number | null, number | null, string | null, number | null];
const FOODS: F[] = [
  ["Riz blanc cuit", "100g", 130, 2.7, 28, 0.3, 0.4, 150, "1 assiette", null],
  ["Riz complet cuit", "100g", 123, 2.7, 25.6, 1, 1.8, 150, "1 assiette", null],
  ["Pâtes cuites", "100g", 158, 5.8, 30.9, 0.9, 1.8, 180, "1 assiette", null],
  ["Pommes de terre cuites à l'eau", "100g", 86, 1.8, 19, 0.1, 1.8, 150, "1 portion", null],
  ["Pain complet", "100g", 247, 9, 41, 3.4, 7, 30, "1 tranche", null],
  ["Flocons d'avoine", "100g", 372, 13.5, 58.7, 7, 10, 40, "1 bol", null],
  ["Lentilles cuites", "100g", 116, 9, 20, 0.4, 7.9, 150, "1 portion", null],
  ["Pois chiches cuits", "100g", 164, 8.9, 27, 2.6, 7.6, 150, "1 portion", null],
  ["Poulet (blanc) cuit", "100g", 165, 31, 0, 3.6, 0, 120, "1 filet", null],
  ["Bœuf haché 5 % cuit", "100g", 170, 26, 0, 7, 0, 125, "1 steak", null],
  ["Saumon cuit", "100g", 206, 22, 0, 12, 0, 120, "1 pavé", null],
  ["Thon au naturel (égoutté)", "100g", 116, 26, 0, 1, 0, 110, "1 boîte", null],
  ["Œuf entier", "100g", 143, 12.6, 0.7, 9.5, 0, 55, "1 œuf", null],
  ["Jambon blanc", "100g", 107, 18, 1, 3.5, 0, 45, "1 tranche", null],
  ["Tofu nature", "100g", 144, 15.8, 2.3, 8.7, 1.9, 100, "1 portion", null],
  ["Yaourt nature", "100g", 59, 3.8, 4.7, 3.3, 0, 125, "1 pot", null],
  ["Fromage blanc 0 %", "100g", 46, 8, 4, 0.2, 0, 100, "1 portion", null],
  ["Skyr nature", "100g", 63, 11, 4, 0.2, 0, 150, "1 pot", null],
  ["Emmental", "100g", 380, 28, 0.4, 29, 0, 30, "1 portion", null],
  ["Lait demi-écrémé", "100ml", 46, 3.2, 4.8, 1.6, 0, 250, "1 verre", 1.03],
  ["Boisson soja nature", "100ml", 39, 3.3, 2.5, 1.8, 0.5, 250, "1 verre", 1.03],
  ["Pomme", "100g", 52, 0.3, 13.8, 0.2, 2.4, 150, "1 pomme", null],
  ["Banane", "100g", 89, 1.1, 22.8, 0.3, 2.6, 120, "1 banane", null],
  ["Orange", "100g", 47, 0.9, 11.8, 0.1, 2.4, 150, "1 orange", null],
  ["Fraises", "100g", 32, 0.7, 7.7, 0.3, 2, 100, "1 portion", null],
  ["Brocoli cuit", "100g", 35, 2.4, 7.2, 0.4, 3.3, 150, "1 portion", null],
  ["Carottes crues", "100g", 41, 0.9, 9.6, 0.2, 2.8, 80, "1 carotte", null],
  ["Tomates", "100g", 18, 0.9, 3.9, 0.2, 1.2, 120, "1 tomate", null],
  ["Haricots verts cuits", "100g", 35, 1.9, 7.9, 0.3, 3.2, 150, "1 portion", null],
  ["Salade verte", "100g", 15, 1.4, 2.9, 0.2, 1.3, 50, "1 portion", null],
  ["Avocat", "100g", 160, 2, 8.5, 14.7, 6.7, 100, "½ avocat", null],
  ["Huile d'olive", "100ml", 824, 0, 0, 91.6, 0, 10, "1 c. à soupe", 0.92],
  ["Beurre", "100g", 717, 0.9, 0.1, 81, 0, 10, "1 noix", null],
  ["Amandes", "100g", 579, 21.2, 21.6, 49.9, 12.5, 30, "1 poignée", null],
  ["Beurre de cacahuète", "100g", 588, 25, 20, 50, 6, 15, "1 c. à soupe", null],
  ["Chocolat noir 70 %", "100g", 598, 7.8, 46, 43, 11, 10, "2 carrés", null],
  ["Sucre", "100g", 400, 0, 100, 0, 0, 5, "1 c. à café", null],
  ["Miel", "100g", 304, 0.3, 82.4, 0, 0.2, 20, "1 c. à soupe", null],
  ["Café noir", "100ml", 2, 0.1, 0, 0, 0, 120, "1 tasse", 1],
  ["Whey (poudre)", "100g", 380, 78, 8, 5, 0, 30, "1 dose", null],
];

// [slug, nom, alias, mouvement, muscles principaux, secondaires, lieu, matériel, niveau, métrique, étapes, erreurs, plus simple, alternative]
type E = [string, string, string | null, string, string, string, "home" | "gym" | "both", string, string, "reps_load" | "time" | "distance", string, string, string | null, string | null];
const EXOS: E[] = [
  // Poussée (8)
  ["pompes", "Pompes classiques", "Push-up", "poussée", "pectoraux", "triceps,épaules", "both", "", "débutant", "reps_load", "Mains sous les épaules, corps gainé, descendre poitrine vers le sol, remonter en poussant.", "Bassin qui s'affaisse; coudes trop ouverts.", "pompes-inclinees", "developpe-couche-halteres"],
  ["pompes-inclinees", "Pompes inclinées", "Incline push-up", "poussée", "pectoraux", "triceps,épaules", "home", "surface surélevée", "débutant", "reps_load", "Mains sur un support stable, corps aligné, pousser.", "Cou en avant; amplitude réduite.", null, "pompes"],
  ["pompes-genoux", "Pompes sur genoux", "Knee push-up", "poussée", "pectoraux", "triceps,épaules", "home", "", "débutant", "reps_load", "Genoux au sol, dos aligné de la tête aux genoux.", "Fesses en arrière.", null, "pompes-inclinees"],
  ["developpe-couche-barre", "Développé couché barre", "Bench press", "poussée", "pectoraux", "triceps,épaules", "gym", "barre,banc", "intermédiaire", "reps_load", "Omoplates serrées, descente contrôlée vers le bas des pectoraux, poussée verticale.", "Rebond sur la poitrine; fesses décollées.", "developpe-couche-halteres", "pompes"],
  ["developpe-couche-halteres", "Développé couché haltères", "Dumbbell bench press", "poussée", "pectoraux", "triceps,épaules", "both", "haltères,banc", "débutant", "reps_load", "Haltères au niveau des pectoraux, pousser en rapprochant légèrement.", "Amplitude trop courte; poignets cassés.", null, "pompes"],
  ["developpe-incline-halteres", "Développé incliné haltères", "Incline dumbbell press", "poussée", "pectoraux (haut)", "épaules,triceps", "both", "haltères,banc", "intermédiaire", "reps_load", "Banc incliné ~30°, pousser au-dessus du haut de la poitrine.", "Inclinaison excessive.", "developpe-couche-halteres", null],
  ["developpe-epaules-halteres", "Développé épaules haltères", "Shoulder press", "poussée", "épaules", "triceps", "both", "haltères", "débutant", "reps_load", "Assis ou debout, pousser au-dessus de la tête sans cambrer.", "Dos cambré; charge trop lourde.", null, null],
  ["elevations-laterales", "Élévations latérales", "Lateral raise", "poussée", "épaules", "", "both", "haltères", "débutant", "reps_load", "Bras légèrement fléchis, monter jusqu'à l'horizontale.", "Élan du buste; épaules haussées.", null, null],
  // Tirage (8)
  ["tractions-assistees", "Tractions assistées", "Assisted pull-up", "tirage", "dos", "biceps", "both", "barre de traction|machine", "débutant", "reps_load", "Prise pronation, tirer le menton au-dessus de la barre avec assistance.", "Élan; amplitude partielle.", null, "tirage-vertical"],
  ["tractions", "Tractions", "Pull-up", "tirage", "dos", "biceps", "both", "barre de traction", "avancé", "reps_load", "Suspension, tirer coudes vers les hanches, menton au-dessus de la barre.", "Balancement; descente non contrôlée.", "tractions-assistees", "tirage-vertical"],
  ["tirage-vertical", "Tirage vertical", "Lat pulldown", "tirage", "dos", "biceps", "gym", "machine", "débutant", "reps_load", "Poitrine sortie, tirer la barre vers le haut de la poitrine.", "Dos qui bascule; barre derrière la nuque.", null, "tractions-assistees"],
  ["rowing-poulie", "Rowing poulie basse", "Seated cable row", "tirage", "dos", "biceps", "gym", "machine", "débutant", "reps_load", "Dos droit, tirer vers le nombril en serrant les omoplates.", "Buste qui se balance.", null, "rowing-elastique"],
  ["rowing-haltere", "Rowing haltère unilatéral", "One-arm dumbbell row", "tirage", "dos", "biceps", "both", "haltères,banc", "débutant", "reps_load", "Main et genou sur le banc, tirer le coude vers la hanche.", "Rotation du tronc.", null, "rowing-elastique"],
  ["rowing-barre", "Rowing barre", "Barbell row", "tirage", "dos", "biceps,lombaires", "gym", "barre", "intermédiaire", "reps_load", "Buste incliné dos plat, tirer la barre vers le bas du ventre.", "Dos arrondi; élan.", "rowing-haltere", null],
  ["rowing-elastique", "Rowing élastique", "Band row", "tirage", "dos", "biceps", "home", "élastique", "débutant", "reps_load", "Élastique ancré devant, tirer coudes le long du corps.", "Épaules haussées.", null, null],
  ["face-pull", "Face pull", null, "tirage", "arrière d'épaule", "dos haut", "both", "élastique|machine", "débutant", "reps_load", "Tirer vers le visage, coudes hauts, rotation externe.", "Charge trop lourde.", null, null],
  // Jambes (10)
  ["squat-poids-corps", "Squat au poids du corps", "Bodyweight squat", "jambes", "quadriceps,fessiers", "ischio-jambiers", "both", "", "débutant", "reps_load", "Pieds largeur d'épaules, descendre hanches en arrière, genoux dans l'axe des pieds.", "Talons qui décollent; genoux vers l'intérieur.", null, "goblet-squat"],
  ["goblet-squat", "Goblet squat", null, "jambes", "quadriceps,fessiers", "tronc", "both", "haltères|kettlebell", "débutant", "reps_load", "Charge contre la poitrine, descendre buste droit.", "Buste qui s'effondre.", "squat-poids-corps", null],
  ["squat-barre", "Squat barre", "Back squat", "jambes", "quadriceps,fessiers", "ischio-jambiers,lombaires", "gym", "barre,rack", "intermédiaire", "reps_load", "Barre sur les trapèzes, descente contrôlée, poussée dans les talons.", "Dos arrondi; profondeur incohérente.", "goblet-squat", "presse-cuisses"],
  ["presse-cuisses", "Presse à cuisses", "Leg press", "jambes", "quadriceps,fessiers", "", "gym", "machine", "débutant", "reps_load", "Dos plaqué, descente contrôlée sans décoller le bassin.", "Verrouillage brutal des genoux.", null, "squat-poids-corps"],
  ["fentes-arriere", "Fentes arrière", "Reverse lunge", "jambes", "quadriceps,fessiers", "ischio-jambiers", "both", "", "débutant", "reps_load", "Grand pas en arrière, genou avant stable, remonter.", "Pas trop court; buste penché.", null, "step-up"],
  ["squat-bulgare", "Squat bulgare", "Bulgarian split squat", "jambes", "quadriceps,fessiers", "", "both", "banc,haltères", "intermédiaire", "reps_load", "Pied arrière surélevé, descendre à la verticale.", "Genou avant qui part en dedans.", "fentes-arriere", null],
  ["step-up", "Step-up", null, "jambes", "quadriceps,fessiers", "", "both", "banc|marche", "débutant", "reps_load", "Pied entier sur la marche, monter sans élan.", "Pousser avec le pied arrière.", null, "fentes-arriere"],
  ["souleve-terre-roumain", "Soulevé de terre roumain", "Romanian deadlift", "jambes", "ischio-jambiers,fessiers", "lombaires", "both", "haltères|barre", "intermédiaire", "reps_load", "Charge près des jambes, hanches en arrière, dos plat.", "Dos arrondi; genoux trop fléchis.", null, "pont-fessier"],
  ["pont-fessier", "Pont fessier", "Glute bridge", "jambes", "fessiers", "ischio-jambiers", "home", "", "débutant", "reps_load", "Dos au sol, pousser les hanches jusqu'à l'alignement, serrer les fessiers.", "Lombaires cambrées.", null, null],
  ["mollets-debout", "Mollets debout", "Standing calf raise", "jambes", "mollets", "", "both", "marche", "débutant", "reps_load", "Monter sur la pointe, pause, descendre lentement.", "Rebond; amplitude réduite.", null, null],
  // Tronc (6)
  ["planche", "Planche", "Plank", "tronc", "abdominaux", "épaules,fessiers", "both", "", "débutant", "time", "Avant-bras au sol, corps aligné, gainage serré.", "Bassin trop haut ou trop bas.", null, "dead-bug"],
  ["planche-laterale", "Planche latérale", "Side plank", "tronc", "obliques", "fessiers moyens", "both", "", "intermédiaire", "time", "Appui sur l'avant-bras, corps aligné sur le côté.", "Bassin qui s'affaisse.", "planche", null],
  ["dead-bug", "Dead bug", null, "tronc", "abdominaux", "", "home", "", "débutant", "reps_load", "Dos plaqué, bras et jambes opposés tendus lentement.", "Lombaires décollées.", null, null],
  ["bird-dog", "Bird dog", null, "tronc", "lombaires,fessiers", "abdominaux", "home", "", "débutant", "reps_load", "À quatre pattes, tendre bras et jambe opposés, bassin stable.", "Rotation du bassin.", null, null],
  ["crunch", "Crunch", null, "tronc", "abdominaux", "", "home", "", "débutant", "reps_load", "Dos au sol, enrouler les épaules, expirer en montant.", "Tirer sur la nuque.", null, "dead-bug"],
  ["pallof-press", "Pallof press", null, "tronc", "obliques", "abdominaux", "both", "élastique|machine", "intermédiaire", "reps_load", "De profil à la poulie, pousser devant soi sans tourner.", "Rotation du buste.", null, "planche-laterale"],
  // Cardio (5)
  ["marche", "Marche", "Walking", "cardio", "cardio", "", "home", "", "débutant", "distance", "Allure confortable permettant de parler.", "—", null, null],
  ["course", "Course", "Running", "cardio", "cardio", "jambes", "both", "", "intermédiaire", "distance", "Foulée relâchée, allure progressive.", "Départ trop rapide.", "marche", null],
  ["velo", "Vélo", "Cycling", "cardio", "cardio", "jambes", "both", "vélo", "débutant", "distance", "Cadence régulière, selle réglée.", "Selle trop basse.", null, "marche"],
  ["rameur", "Rameur", "Rowing machine", "cardio", "cardio", "dos,jambes", "gym", "machine", "intermédiaire", "distance", "Jambes, puis buste, puis bras; retour inverse.", "Tirer avec les bras en premier.", null, "velo"],
  ["corde-a-sauter", "Corde à sauter", "Jump rope", "cardio", "cardio", "mollets", "home", "corde", "intermédiaire", "time", "Petits sauts, poignets actifs.", "Sauts trop hauts.", "marche", null],
  // Mobilité (3)
  ["mobilite-cheville", "Mobilité de cheville", null, "mobilité", "chevilles", "", "home", "", "débutant", "time", "Genou vers l'avant au-dessus du pied, talon au sol.", "Talon qui décolle.", null, null],
  ["rotation-thoracique", "Rotation thoracique", null, "mobilité", "dos haut", "", "home", "", "débutant", "reps_load", "À quatre pattes, main derrière la tête, ouvrir le coude vers le plafond.", "Bassin qui suit.", null, null],
  ["mobilite-epaules", "Mobilité des épaules", null, "mobilité", "épaules", "", "home", "bâton|élastique", "débutant", "reps_load", "Passer le bâton de l'avant vers l'arrière bras tendus.", "Forcer l'amplitude.", null, null],
];

const csv = (s: string) => JSON.stringify(s ? s.split(",") : []);

export function seedCatalog(db: DatabaseSync) {
  // Fiches de base (texte rédigé à la main) + catalogue étendu. On n'insère que ce qui manque : les bases existantes sont complétées sans doublon.
  const have = new Set((db.prepare("SELECT ex_key FROM exercises WHERE user_id IS NULL").all() as { ex_key: string }[]).map((r) => r.ex_key));
  const ins = db.prepare(`INSERT INTO exercises(id,ex_key,version,user_id,name,alias,movement,primary_muscles,secondary_muscles,place,equipment,level,metric,steps,mistakes,easier,alternative,status,reviewed_at)
    VALUES(?,?,?,NULL,?,?,?,?,?,?,?,?,?,?,?,?,?,'published',NULL)`);
  db.exec("BEGIN");
  try {
    for (const e of EXOS) if (!have.has(e[0])) { ins.run(id(), e[0], 1, e[1], e[2], e[3], csv(e[4]), csv(e[5]), e[6], csv(e[7]), e[8], e[9], e[10], e[11], e[12], e[13]); have.add(e[0]); }
    for (const e of buildCatalog()) if (!have.has(e.slug)) { ins.run(id(), e.slug, 1, e.name, e.alias, e.movement, JSON.stringify(e.primary), JSON.stringify(e.secondary), e.place, JSON.stringify(e.equipment), e.level, e.metric, e.steps, e.mistakes, e.easier, e.alternative); have.add(e.slug); }
    db.exec("COMMIT");
  } catch (err) { db.exec("ROLLBACK"); throw err; }
  const nf = (db.prepare("SELECT COUNT(*) c FROM foods WHERE user_id IS NULL").get() as { c: number }).c;
  if (nf === 0) {
    const ins = db.prepare(`INSERT INTO foods(id,food_key,version,user_id,name,basis,portion_g,portion_ml,portion_label,density,kcal,protein,carbs,fat,fiber,source,license,created_at)
      VALUES(?,?,1,NULL,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const f of FOODS) {
      const key = "gen-" + f[0].toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-");
      const isMl = f[1] === "100ml";
      ins.run(id(), key, f[0], f[1], isMl ? null : f[7], isMl ? f[7] : null, f[8], f[9], f[2], f[3], f[4], f[5], f[6],
        "Catalogue générique Terminator (valeurs indicatives, à valider)", "À valider avant diffusion", now());
    }
  }
  const nr = (db.prepare("SELECT COUNT(*) c FROM routines WHERE demo=1").get() as { c: number }).c;
  if (nr === 0) {
    const ins = db.prepare("INSERT INTO routines(id,routine_key,version,user_id,name,place,items,demo,created_at) VALUES(?,?,1,NULL,?,?,?,1,?)");
    const it = (slug: string, sets: number, reps: string, rest: number) => ({ slug, sets, reps, rest, load: null, notes: "" });
    ins.run(id(), "demo-decouverte", "Démo — Découverte sans matériel", "home", JSON.stringify([
      it("squat-poids-corps", 3, "", 60), it("pompes-inclinees", 3, "", 60), it("pont-fessier", 3, "", 45), it("dead-bug", 2, "", 45), it("planche", 2, "", 45)]), now());
    ins.run(id(), "demo-haltères", "Démo — Maison avec haltères", "home", JSON.stringify([
      it("goblet-squat", 3, "", 90), it("developpe-couche-halteres", 3, "", 90), it("rowing-haltere", 3, "", 90), it("souleve-terre-roumain", 3, "", 90), it("elevations-laterales", 2, "", 60)]), now());
    ins.run(id(), "demo-salle", "Démo — Structure de séance en salle", "gym", JSON.stringify([
      it("squat-barre", 3, "", 120), it("developpe-couche-barre", 3, "", 120), it("tirage-vertical", 3, "", 90), it("presse-cuisses", 2, "", 90), it("pallof-press", 2, "", 60)]), now());
  }
}
