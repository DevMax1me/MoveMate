// Explications en langage courant : ce que fait l'exercice, avec quoi, et le sens des mots de salle contenus dans son nom.
// Fonctions pures (utilisées côté serveur et dans l'interface), sans donnée personnelle.
export type ExplainInput = { name: string; alias?: string | null; pattern?: string | null; equipment?: string[]; primary_muscles?: string[]; movement?: string; place?: string; level?: string };
export type Explain = { summary: string; how: string; terms: { term: string; def: string }[] };

const nz = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, " ");

/** Ce que fait le mouvement, en une phrase, selon sa famille. */
const WHAT: Record<string, string> = {
  pushUp: "On pousse le sol pour décoller le corps, mains au sol, corps bien droit.",
  pushH: "On pousse une charge loin de la poitrine, devant soi, bras qui se tendent.",
  pushV: "On pousse une charge vers le haut, au-dessus de la tête, jusqu'à bras tendus.",
  fly: "Bras presque tendus, on ouvre puis on rapproche les bras devant la poitrine, comme pour serrer quelqu'un dans ses bras.",
  lateral: "On lève les bras sur les côtés (ou devant) jusqu'à hauteur d'épaules, sans se balancer.",
  rear: "On ouvre les bras vers l'arrière, les coudes hauts : on travaille l'arrière des épaules et le haut du dos.",
  tricepsExt: "On tend le coude, le haut du bras restant immobile : on travaille l'arrière du bras.",
  dip: "On se tient sur deux appuis, bras tendus, puis on descend en pliant les coudes et on remonte en poussant.",
  pullV: "On tire vers le bas une barre ou des poignées jusqu'en haut de la poitrine, assis, buste droit, en serrant les omoplates.",
  pullH: "On tire une poignée ou une charge vers le ventre ou la poitrine, coudes vers l'arrière, comme pour ramer.",
  curl: "On plie le coude pour amener la charge vers l'épaule, le haut du bras restant immobile.",
  shrug: "On monte les épaules vers les oreilles, bras tendus le long du corps, puis on redescend.",
  squat: "On plie les genoux et les hanches pour descendre comme pour s'asseoir, puis on pousse sur les pieds pour remonter.",
  lunge: "Un pied devant, l'autre derrière : on descend en pliant les deux genoux, puis on remonte.",
  hinge: "On penche le buste en reculant les fesses, dos plat et genoux à peine fléchis, puis on se redresse en poussant les hanches vers l'avant.",
  glute: "On pousse les hanches vers le haut (ou la jambe vers l'arrière) en serrant les fessiers.",
  legiso: "On plie le genou pour ramener le talon vers les fesses, contre une résistance.",
  legext: "Assis, on tend les genoux contre une résistance, puis on redescend lentement.",
  calf: "On monte sur la pointe des pieds le plus haut possible, puis on redescend lentement.",
  plank: "On tient une position, corps aligné de la tête aux talons, sans bouger : les abdominaux se contractent en continu.",
  crunch: "Allongé ou en appui, on enroule le haut du dos vers le bassin en contractant les abdominaux.",
  legraise: "On lève les jambes (tendues ou pliées) en gardant le bas du dos stable, puis on les redescend sans les poser.",
  rot: "On tourne ou on incline le tronc, bassin stable, pour travailler les côtés du ventre.",
  carry: "On marche en portant une charge, buste droit et abdominaux serrés.",
  lowback: "On redresse le buste depuis la position penchée en contractant le bas du dos et les fessiers.",
  olympic: "Mouvement explosif en un temps : on projette la charge vers le haut grâce aux jambes et aux hanches.",
  plyo: "Mouvement explosif : on saute ou on se propulse, puis on amortit la réception.",
  cardioSteady: "Effort continu à allure régulière, que l'on peut tenir longtemps en pouvant encore parler.",
  cardioHiit: "Efforts courts et intenses séparés de pauses, pour faire monter le cœur rapidement.",
  mob: "Mouvement lent et ample pour assouplir une articulation, sans douleur et sans forcer.",
  stretch: "On tient une position d'étirement, sans rebonds, en respirant calmement ; une tension douce, jamais de douleur.",
};

/** Phrases plus précises quand le nom le permet (prioritaires sur la phrase de la famille). */
const NAME_WHAT: [RegExp, string][] = [
  [/traction|pull-?up|chin-?up/, "On se suspend à une barre et on se hisse jusqu'à passer le menton au-dessus, puis on redescend lentement, bras tendus."],
  [/australienne|rowing inverse/, "Allongé sous une barre basse, corps gainé, on tire la poitrine vers la barre puis on redescend lentement."],
  [/souleve de terre|deadlift/, "On soulève une charge du sol en se redressant, dos plat, en poussant avec les jambes puis avec les hanches."],
  [/hip thrust|pont fessier/, "Dos appuyé (sur un banc ou au sol), on pousse les hanches vers le haut en serrant les fessiers, puis on redescend."],
  [/fentes? (marchees|marche)/, "On avance d'un pas à chaque répétition, en pliant les deux genoux."],
  [/presse a cuisses|leg press|presse horizontale|presse inclinee/, "On pousse une plateforme avec les pieds en tendant les jambes, dos calé, puis on revient lentement en pliant les genoux."],
  [/pull-?over/, "Bras presque tendus, on amène la charge de derrière la tête jusqu'au-dessus de la poitrine (allongé sur un banc ou à la poulie)."],
  [/face pull/, "On tire une corde vers le visage, coudes hauts, en écartant les mains à la fin."],
  [/tirage menton/, "On monte la charge le long du corps jusqu'au menton, coudes plus hauts que les mains."],
  [/pompes?/, "On pousse le sol pour décoller le corps, mains au sol, corps bien droit de la tête aux talons, puis on redescend."],
  [/planche (haute|sur bras tendus)/, "On tient la position de pompe, bras tendus, corps aligné de la tête aux talons, sans bouger."],
];

const EQ: [string, string][] = [
  ["poulie", "à la poulie : un câble relié à des plaques de poids, avec une poignée au bout"],
  ["machine", "sur une machine guidée : le trajet est imposé, plus simple à contrôler qu'une charge libre"],
  ["haltères", "avec des haltères : une charge courte dans chaque main"],
  ["barre", "avec une barre longue chargée de disques"],
  ["kettlebell", "avec une kettlebell : un poids rond avec une poignée"],
  ["élastique", "avec un élastique de résistance"],
  ["smith", "à la Smith machine : une barre guidée sur deux rails verticaux"],
  ["banc", "sur un banc"],
  ["rack", "dans un rack (cage à squat) qui règle la hauteur de la barre"],
  ["barre de traction", "suspendu à une barre fixe"],
  ["barres parallèles", "entre deux barres parallèles"],
  ["anneaux", "aux anneaux de gymnastique (suspendus à des sangles)"],
  ["swiss ball", "avec un gros ballon de gym"],
  ["medecine ball", "avec un ballon lesté"],
  ["roue abdominale", "avec une roue abdominale"],
  ["step", "avec une marche ou un step"],
  ["vélo", "sur un vélo"], ["rameur", "sur un rameur"], ["tapis", "sur un tapis de course"],
];

/** Mots de salle : (motif sur le texte normalisé, mot affiché, définition). Seuls ceux présents dans le nom sont montrés. */
const GLOSSARY: [RegExp, string, string][] = [
  [/iso-?lateral/, "Iso-latéral", "Chaque bras (ou chaque jambe) travaille séparément, avec son propre levier ou sa propre poignée. Pratique pour équilibrer les deux côtés."],
  [/unilateral|une main|un bras|une jambe|unijambiste|a une jambe/, "Unilatéral", "On travaille un seul côté à la fois (un bras ou une jambe), puis l'autre."],
  [/hammer|marteau/, "Hammer / prise marteau", "Prise neutre : les paumes se font face, pouces vers le haut, comme pour tenir un marteau. Plus confortable pour les poignets."],
  [/supination/, "Supination", "Prise paumes tournées vers soi (vers le haut), comme pour porter un plateau."],
  [/pronation/, "Pronation", "Prise paumes tournées vers le bas, vers le sol."],
  [/prise neutre/, "Prise neutre", "Les paumes se font face, pouces vers le haut."],
  [/prise large|prise ecartee/, "Prise large", "Mains plus écartées que la largeur des épaules."],
  [/prise serree|prise etroite/, "Prise serrée", "Mains rapprochées, plus étroites que la largeur des épaules."],
  [/smith/, "Smith machine", "Une barre guidée sur deux rails verticaux : plus stable qu'une barre libre, avec un trajet imposé."],
  [/pec deck|butterfly/, "Pec deck", "Machine où l'on rapproche deux bras devant la poitrine, assis, dos calé."],
  [/crossover|vis-?a-?vis/, "Crossover", "Deux poulies hautes : on ramène les poignées l'une vers l'autre devant soi, en croisant."],
  [/face pull/, "Face pull", "On tire une corde vers le visage, coudes hauts : travaille l'arrière des épaules et le haut du dos."],
  [/pull-?over/, "Pull-over", "Bras presque tendus, on amène la charge de derrière la tête vers le dessus de la poitrine."],
  [/\browing\b|\brow\b/, "Rowing", "Tirage vers soi, comme pour ramer : on rapproche les coudes du corps en serrant les omoplates."],
  [/tirage menton/, "Tirage menton", "On monte une barre ou des poignées le long du corps jusqu'au menton, coudes plus hauts que les mains."],
  [/lat pulldown|tirage vertical/, "Tirage vertical", "On tire la barre vers le haut de la poitrine, assis, comme pour faire une traction à l'envers."],
  [/bulgare/, "Squat bulgare", "Pied arrière posé sur un banc : une fente sur une jambe, très exigeante pour la cuisse et la fesse."],
  [/hip thrust/, "Hip thrust", "Haut du dos appuyé sur un banc, on pousse les hanches vers le haut avec une charge sur le bassin : fessiers."],
  [/souleve de terre|deadlift/, "Soulevé de terre", "On soulève une charge du sol en se redressant, dos plat, en poussant avec les jambes et les hanches."],
  [/roumain/, "Roumain", "Soulevé de terre jambes presque tendues : on descend la charge le long des cuisses, étirement des ischio-jambiers et des fessiers."],
  [/sumo/, "Sumo", "Pieds très écartés, pointes vers l'extérieur : sollicite plus l'intérieur des cuisses et les fessiers."],
  [/good morning/, "Good morning", "Barre posée sur les épaules : on penche le buste vers l'avant, dos plat, puis on se redresse."],
  [/kickback/, "Kickback", "On tend le bras ou la jambe vers l'arrière, buste penché ou à quatre pattes."],
  [/barre au front|skull|crushers?/, "Barre au front", "Allongé, on plie les coudes pour descendre la charge vers le front, puis on tend les bras : triceps."],
  [/landmine/, "Landmine", "Une barre dont un bout est calé dans un coin ou un support : on manipule l'autre bout comme un levier."],
  [/pendlay/, "Pendlay row", "Rowing à la barre : le buste reste à l'horizontale et la barre repart du sol à chaque répétition."],
  [/t-?bar/, "Barre en T", "Une extrémité de la barre est fixée au sol, on tire l'autre vers la poitrine."],
  [/australienne|rowing inverse/, "Tractions australiennes", "Allongé sous une barre basse, on tire la poitrine vers la barre, talons au sol : une traction horizontale plus facile."],
  [/planche haute|planche sur bras tendus/, "Planche haute", "Sur les mains, bras tendus (position de départ d'une pompe) : plus d'effort pour les épaules que sur les avant-bras."],
  [/planche basse|planche sur avant-bras/, "Planche sur avant-bras", "Appuyé sur les avant-bras et les pieds, corps aligné."],
  [/diamant/, "Pompes diamant", "Mains rapprochées en losange sous la poitrine : plus de travail des triceps."],
  [/arnold/, "Arnold press", "Développé où l'on fait tourner les paumes pendant la montée, des épaules à la position finale."],
  [/farmer/, "Farmer walk", "Marche en portant une charge lourde dans chaque main, comme deux valises."],
  [/cossack/, "Squat cosaque", "Squat latéral profond : une jambe se plie, l'autre reste tendue sur le côté."],
  [/step-?up|montee sur/, "Step-up", "On monte sur une marche ou un banc avec une jambe, puis on redescend en contrôlant."],
  [/pistol|pistolet/, "Pistol squat", "Squat sur une seule jambe, l'autre tendue devant soi. Très difficile : à réserver aux plus avancés."],
  [/sissy/, "Squat sissy", "On se penche en arrière en gardant le corps aligné, genoux qui avancent : isole les cuisses."],
  [/nordic/, "Nordic", "À genoux, on retient la descente du buste vers l'avant (ischio-jambiers) ou on se penche en arrière (cuisses) en gardant le corps aligné."],
  [/hack/, "Hack squat", "Squat sur une machine inclinée où le dos est calé : guidé, centré sur les cuisses."],
  [/leg press|presse a cuisses|presse horizontale|presse inclinee/, "Presse à cuisses", "Assis ou allongé, on pousse une plateforme avec les pieds : mouvement de squat guidé par une machine."],
  [/\bpike\b/, "Pike", "Corps en V inversé : fesses hautes, jambes et bras tendus."],
  [/hollow/, "Hollow body", "Allongé sur le dos, bas du dos plaqué, bras et jambes tendus et décollés du sol : gainage intense."],
  [/dragon flag/, "Dragon flag", "Allongé, tenu aux épaules, on lève le corps entier tendu : exercice de gymnastique très avancé."],
  [/windshield|essuie/, "Essuie-glace", "Allongé ou suspendu, jambes ensemble qui balayent de gauche à droite comme un essuie-glace."],
  [/russian twist|rotation russe/, "Russian twist", "Assis, buste incliné, on tourne le tronc d'un côté à l'autre."],
  [/pallof/, "Pallof press", "Debout de profil à une poulie ou un élastique : on tend les bras devant soi sans laisser le corps tourner."],
  [/burpee/, "Burpee", "Enchaînement : on descend au sol, on fait une pompe, on se relève et on saute."],
  [/mountain climber|grimpeur/, "Mountain climbers", "En position de planche, on ramène les genoux vers la poitrine l'un après l'autre, comme pour courir à plat ventre."],
  [/thruster/, "Thruster", "Squat avec une charge devant les épaules, puis on remonte en poussant la charge au-dessus de la tête, d'un seul geste."],
  [/\bclean\b/, "Clean", "On amène la charge du sol aux épaules d'un geste rapide."],
  [/snatch|arrache/, "Arraché", "On amène la charge du sol à bout de bras au-dessus de la tête d'un seul geste explosif."],
  [/\bswing/, "Kettlebell swing", "On balance la kettlebell entre les jambes puis jusqu'à hauteur de poitrine, grâce à une poussée des hanches (pas des bras)."],
  [/turkish|get-?up/, "Turkish get-up", "On se relève du sol jusqu'à la position debout en gardant un poids tendu au-dessus de soi."],
  [/\bbarre ez\b|\bbarre z\b|\bez\b/, "Barre EZ", "Barre courbée qui ménage les poignets pour les curls et les extensions."],
  [/trap bar|barre hexagonale/, "Trap bar", "Barre en forme d'hexagone dans laquelle on se place : soulevé de terre plus facile pour le dos."],
  [/pupitre|larry scott/, "Pupitre", "Appui incliné sous les bras qui empêche de tricher pendant le curl."],
  [/concentration/, "Curl concentration", "Assis, coude contre l'intérieur de la cuisse : isole le biceps."],
  [/isometrique|isometrie/, "Isométrique", "On tient la position sans bouger, muscles contractés."],
  [/excentrique|negative|negatives/, "Excentrique / négatif", "On insiste sur la phase de descente, lente (3 à 5 secondes)."],
  [/\btempo\b/, "Tempo", "Vitesse imposée à chaque phase (par exemple 3 secondes à la descente) pour mieux contrôler."],
  [/\bpause\b/, "Avec pause", "On marque un temps d'arrêt (1 à 2 secondes) en bas ou en haut du mouvement."],
  [/assiste|assistee/, "Assisté", "Une machine ou un élastique allège le poids du corps : permet de progresser vers la version complète."],
  [/\blest(e|ee|es|ees)\b/, "Lesté", "On ajoute une charge (gilet, ceinture, sac à dos) à l'exercice au poids du corps."],
  [/sur banc incline|\bincline/, "Incliné", "Le banc ou le corps est incliné vers le haut : déplace le travail vers le haut du muscle (par exemple le haut des pectoraux)."],
  [/\bdecline/, "Décliné", "Tête plus basse que les hanches : déplace le travail vers le bas des pectoraux."],
  [/deficit/, "Déficit", "Pieds surélevés (sur un disque ou une marche) : amplitude plus longue."],
  [/sur-?eleve|surelevee?s?/, "Surélevé", "Un appui plus haut que d'habitude (pieds ou mains) : change la difficulté et les muscles sollicités."],
  [/bras tendus/, "Bras tendus", "Les coudes restent verrouillés : l'effort vient de l'épaule ou du dos, pas du bras."],
  [/poulie (basse|haute|mi)/, "Poulie basse / haute", "Position de la poulie : basse = au niveau du sol, haute = au-dessus de la tête. Elle change la direction de la traction."],
  [/a genoux|demi-genou|chevalier/, "À genoux", "On travaille à genoux au lieu de debout : plus stable, et le bas du corps ne triche pas."],
  [/alterne|alternee|alternes/, "Alterné", "On fait un côté puis l'autre, à tour de rôle."],
  [/bear crawl|marche de l ours/, "Bear crawl", "Marche à quatre pattes, genoux décollés du sol."],
  [/wall slide/, "Wall slide", "Dos et bras contre un mur : on fait glisser les bras vers le haut sans les décoller du mur."],
  [/dislocation/, "Dislocations", "Avec un bâton ou un élastique tenu large, on passe les bras de l'avant vers l'arrière en les gardant tendus."],
  [/90\/90/, "90/90", "Assis, une jambe pliée à 90° devant et l'autre à 90° sur le côté : mobilité de hanche."],
  [/chat-?vache/, "Chat-vache", "À quatre pattes, on alterne dos rond et dos creux, lentement, en respirant."],
  [/enfant/, "Posture de l'enfant", "À genoux, fesses sur les talons, buste et bras allongés vers l'avant."],
  [/chien tete en bas|chien/, "Chien tête en bas", "Corps en V inversé, mains et pieds au sol, talons qui descendent vers le sol."],
  [/cobra/, "Cobra", "Allongé sur le ventre, on se redresse sur les bras en gardant le bassin au sol."],
];

const POSITION: [RegExp, string][] = [
  [/assis|assise|chaise romaine/, "assis"],
  [/debout/, "debout"],
  [/allonge|couche|au sol|dos au sol|sur le dos/, "allongé"],
  [/penche|buste incline/, "buste penché en avant"],
  [/a genoux|demi-genou/, "à genoux"],
  [/suspendu|suspension|traction|barre de traction/, "suspendu"],
];

export function explain(ex: ExplainInput): Explain {
  const text = nz(`${ex.name} ${ex.alias ?? ""}`);
  const eq = ex.equipment ?? [];
  const terms: { term: string; def: string }[] = [];
  const seen = new Set<string>();
  for (const [re, term, def] of GLOSSARY) if (re.test(text) && !seen.has(term)) { seen.add(term); terms.push({ term, def }); }

  const what = NAME_WHAT.find(([re]) => re.test(text))?.[1] ?? WHAT[ex.pattern ?? ""] ?? "Mouvement décrit dans la fiche ; regardez le schéma pour la position de départ et d'arrivée.";
  const flat = eq.flatMap((t) => t.split("|"));
  const phrase = (tok: string) => EQ.find(([t]) => nz(t) === nz(tok))?.[1];
  // « a|b » = l'un ou l'autre ; plusieurs entrées = tout est nécessaire
  const phrases = eq.map((entry) => entry.split("|").map(phrase).filter(Boolean).join(" ou ")).filter(Boolean);
  const how: string[] = [];
  if (!flat.length) how.push("Sans matériel : le poids du corps suffit");
  else if (phrases.length) how.push(`Se fait ${phrases.slice(0, 3).join(", ")}`);
  const pos = POSITION.find(([re]) => re.test(text));
  if (pos) how.push(`position : ${pos[1]}`);
  const muscles = ex.primary_muscles?.length ? `Travaille surtout : ${ex.primary_muscles.slice(0, 3).join(", ")}.` : "";
  return { summary: what, how: [how.length ? `${how.join(" ; ")}.` : "", muscles].filter(Boolean).join(" "), terms: terms.slice(0, 5) };
}
