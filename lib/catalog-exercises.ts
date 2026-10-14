// Catalogue d'exercices étendu : nom ; muscles principaux ; secondaires ; lieu (h maison, g salle, b les deux) ; matériel ; niveau ; suivi ; modèle ; remarque.
// Matériel : « a,b » = tout est requis ; « a/b » = l'un ou l'autre. Les modèles portent les consignes d'exécution et les erreurs fréquentes.
// Ce catalogue décrit des mouvements ; il ne constitue pas un programme prescrit. Fiches à faire relire avant diffusion publique.

type Pat = { steps: string; mistakes: string; alt: string | null; easier: string | null };
const P: Record<string, Pat> = {
  pushUp: { steps: "Mains sous les épaules, corps gainé de la tête aux talons. Descendez la poitrine vers le sol en gardant les coudes à environ 45° du tronc, puis poussez.", mistakes: "Bassin qui s'affaisse ou qui monte ; coudes trop ouverts ; amplitude partielle.", alt: "pompes", easier: "pompes-genoux" },
  pushH: { steps: "Omoplates serrées et pieds ancrés. Descendez la charge de façon contrôlée vers le bas des pectoraux, puis poussez sans décoller les fesses du support.", mistakes: "Rebond sur la poitrine ; coudes trop écartés ; fesses qui décollent ; poignets cassés.", alt: "pompes", easier: "pompes-inclinees" },
  pushV: { steps: "Tronc gainé, côtes rentrées. Poussez la charge au-dessus de la tête jusqu'à l'extension sans cambrer, puis redescendez en contrôlant.", mistakes: "Dos cambré ; poignets cassés ; charge trop lourde qui entraîne un élan.", alt: "pompes-pike", easier: null },
  fly: { steps: "Bras légèrement fléchis, ouvrez en arc jusqu'à sentir l'étirement des pectoraux, puis refermez en serrant sans verrouiller les coudes.", mistakes: "Charge trop lourde ; coudes trop fléchis (cela devient un développé) ; épaules qui remontent.", alt: "pompes", easier: null },
  lateral: { steps: "Bras légèrement fléchis, montez en menant par les coudes jusqu'à l'horizontale, puis redescendez lentement.", mistakes: "Élan du buste ; épaules haussées ; charge trop lourde.", alt: "elevations-laterales-bouteilles", easier: null },
  rear: { steps: "Buste penché dos plat (ou appui sur la machine), ouvrez les bras en arc en serrant les omoplates, puis revenez lentement.", mistakes: "Élan ; trapèzes qui prennent le relais ; dos arrondi.", alt: "elevations-laterales-bouteilles", easier: null },
  tricepsExt: { steps: "Coudes fixes près du corps ou de la tête, étendez les avant-bras jusqu'à l'extension, puis contrôlez le retour.", mistakes: "Coudes qui s'écartent ; élan des épaules ; charge trop lourde.", alt: "dips-sur-chaise", easier: null },
  dip: { steps: "Épaules basses et éloignées des oreilles. Descendez jusqu'à environ 90° aux coudes, puis poussez pour remonter.", mistakes: "Épaules haussées ; descente trop profonde ; buste trop penché sans contrôle.", alt: "dips-sur-chaise", easier: null },
  pullV: { steps: "Épaules basses. Tirez les coudes vers les hanches en amenant la poitrine vers la barre ou la poignée, puis descendez en contrôlant.", mistakes: "Élan ; amplitude partielle ; épaules haussées ; nuque tendue.", alt: "tractions-australiennes-sous-table", easier: "tractions-assistees" },
  pullH: { steps: "Dos plat, omoplates qui se rapprochent. Tirez les coudes vers l'arrière sans balancer le buste, puis revenez lentement.", mistakes: "Buste qui balance ; épaules en avant ; nuque tendue ; dos arrondi.", alt: "tractions-australiennes-sous-table", easier: null },
  curl: { steps: "Coudes près du corps, fléchissez sans balancer, contractez en haut, puis redescendez lentement.", mistakes: "Élan du dos ; coudes qui avancent ; descente non contrôlée.", alt: "curl-sac-a-dos", easier: null },
  shrug: { steps: "Bras tendus le long du corps, montez les épaules verticalement vers les oreilles, marquez une pause, puis redescendez.", mistakes: "Rotation des épaules ; charge excessive ; amplitude trop courte.", alt: "haussements-sac-a-dos", easier: null },
  lowback: { steps: "Hanches calées, montez jusqu'à l'alignement sans hyperextension, puis redescendez de façon contrôlée.", mistakes: "Hyperextension en haut ; élan ; nuque en arrière.", alt: "superman", easier: null },
  squat: { steps: "Pieds à largeur d'épaules, pointes légèrement ouvertes. Poussez les hanches en arrière et descendez, genoux dans l'axe des pieds, dos neutre ; remontez en poussant dans les talons.", mistakes: "Genoux qui rentrent ; talons qui décollent ; dos qui s'arrondit ; profondeur incohérente.", alt: "squat-poids-corps", easier: null },
  lunge: { steps: "Pas contrôlé, buste droit. Descendez à la verticale, genou avant au-dessus du pied, puis poussez pour revenir.", mistakes: "Genou qui part en dedans ; pas trop court ; buste penché ; talon avant qui décolle.", alt: "fentes-arriere", easier: null },
  hinge: { steps: "Charge près du corps, dos plat. Envoyez les hanches vers l'arrière jambes presque tendues, puis redressez-vous en poussant les hanches vers l'avant sans cambrer.", mistakes: "Dos arrondi ; charge loin des jambes ; hyperextension en haut ; genoux trop fléchis.", alt: "pont-fessier", easier: null },
  glute: { steps: "Poussez les hanches jusqu'à l'alignement épaules-hanches-genoux, serrez les fessiers en haut, puis redescendez lentement.", mistakes: "Lombaires cambrées ; poussée sur les orteils ; amplitude réduite.", alt: "pont-fessier", easier: null },
  legiso: { steps: "Réglez l'appareil ou le support, hanches stables. Fléchissez les genoux en contractant les ischio-jambiers, puis contrôlez le retour.", mistakes: "Bassin qui se soulève ; élan ; retour non contrôlé.", alt: "pont-fessier", easier: null },
  legext: { steps: "Dos calé, axe du genou aligné sur l'axe de la machine. Tendez les jambes sans verrouiller brutalement, puis redescendez lentement.", mistakes: "À-coups ; verrouillage brutal des genoux ; fesses qui décollent.", alt: "squat-isometrique-contre-un-mur", easier: null },
  calf: { steps: "Montez sur la pointe des pieds, marquez une pause en haut, puis descendez lentement en étirant le mollet.", mistakes: "Rebond ; amplitude réduite ; chevilles qui roulent.", alt: "mollets-debout", easier: null },
  plyo: { steps: "Échauffez-vous d'abord. Réception amortie sur l'avant-pied, genoux fléchis et dans l'axe, puis enchaînez en gardant le contrôle.", mistakes: "Réception raide ; genoux qui rentrent ; fatigue qui dégrade la technique.", alt: "squat-poids-corps", easier: null },
  plank: { steps: "Corps gainé en ligne droite, abdominaux et fessiers contractés, respiration continue.", mistakes: "Bassin trop haut ou affaissé ; nuque tendue ; respiration bloquée.", alt: "planche", easier: "dead-bug" },
  crunch: { steps: "Enroulez le haut du dos en expirant, lombaires en contact avec le support, puis redescendez de façon contrôlée.", mistakes: "Tirer sur la nuque ; élan ; amplitude trop grande avec les lombaires qui décollent.", alt: "crunch", easier: "dead-bug" },
  legraise: { steps: "Dos plaqué (ou bassin enroulé en suspension), relevez les jambes en contrôlant, sans cambrer les lombaires, puis redescendez sans poser.", mistakes: "Lombaires cambrées ; élan ; balancement en suspension.", alt: "releves-de-jambes-au-sol", easier: "dead-bug" },
  rot: { steps: "La rotation vient du tronc, bassin stable, mouvement contrôlé dans les deux sens.", mistakes: "Bras seuls qui bougent ; bassin qui tourne ; élan.", alt: "russian-twist", easier: null },
  carry: { steps: "Épaules basses, tronc gainé, marchez à pas réguliers sans vous pencher ni vous balancer.", mistakes: "Buste incliné ; épaules haussées ; pas trop rapides.", alt: "marche", easier: null },
  cardioSteady: { steps: "Allure confortable permettant de parler, augmentez progressivement la durée ou l'intensité.", mistakes: "Départ trop rapide ; intensité qui empêche de tenir la durée.", alt: "marche", easier: "marche" },
  cardioHiit: { steps: "Après un échauffement, alternez efforts soutenus et récupérations (par ex. 30 s d'effort, 60 s de récupération).", mistakes: "Pas d'échauffement ; intensité maximale dès la première série ; récupération trop courte.", alt: "marche", easier: "marche" },
  mob: { steps: "Mouvement lent et contrôlé dans une amplitude confortable, respiration calme, sans douleur.", mistakes: "Forcer l'amplitude ; retenir sa respiration ; aller trop vite.", alt: null, easier: null },
  stretch: { steps: "Tenez la position 20 à 40 secondes en respirant calmement, sans rebond ni douleur.", mistakes: "Rebonds ; étirement jusqu'à la douleur ; respiration bloquée.", alt: null, easier: null },
  olympic: { steps: "Technique exigeante : apprenez avec une charge très légère, de préférence encadré par une personne compétente.", mistakes: "Tirer avec les bras trop tôt ; dos arrondi ; réception instable.", alt: "squat-poids-corps", easier: null },
};

const LEVEL: Record<string, string> = { d: "débutant", i: "intermédiaire", a: "avancé" };
const METRIC: Record<string, "reps_load" | "time" | "distance"> = { r: "reps_load", t: "time", k: "distance" };
const GROUP: Record<string, string> = { push: "poussée", pull: "tirage", legs: "jambes", core: "tronc", cardio: "cardio", mob: "mobilité" };
// Famille de mouvement déduite du modèle (les sections servent seulement à ranger le texte source).
const PATMOVE: Record<string, string> = { pushUp: "poussée", pushV: "poussée", pushH: "poussée", fly: "poussée", lateral: "poussée", tricepsExt: "poussée", dip: "poussée", rear: "tirage", pullV: "tirage", pullH: "tirage", curl: "tirage", shrug: "tirage", lowback: "tirage",
  squat: "jambes", lunge: "jambes", hinge: "jambes", glute: "jambes", legiso: "jambes", legext: "jambes", calf: "jambes", olympic: "jambes", plank: "tronc", crunch: "tronc", legraise: "tronc", rot: "tronc", carry: "tronc", cardioSteady: "cardio", cardioHiit: "cardio", mob: "mobilité", stretch: "mobilité" };

// ---------- POUSSÉE ----------
const PUSH = `
Pompes déclinées;pectoraux (haut),épaules;triceps;h;chaise;i;r;pushUp;Pieds surélevés sur une chaise : plus de travail sur le haut des pectoraux et les épaules.
Pompes diamant;triceps;pectoraux,épaules;h;;i;r;pushUp;Mains rapprochées en losange sous la poitrine, coudes près du corps.
Pompes larges;pectoraux;épaules;h;;i;r;pushUp;Mains plus larges que les épaules.
Pompes archer;pectoraux;triceps,épaules;h;;a;r;pushUp;Un bras fléchit pendant que l'autre reste tendu sur le côté, alternez.
Pompes tempo;pectoraux;triceps,épaules;h;;i;r;pushUp;Descente en 3 secondes, poussée normale.
Pompes lestées avec sac à dos;pectoraux;triceps,épaules;h;sac à dos;a;r;pushUp;Sac chargé (livres, bouteilles) bien serré sur le haut du dos.
Pompes Spiderman;pectoraux,obliques;épaules,abdominaux;h;;a;r;pushUp;Genou vers le coude du même côté à chaque descente.
Pompes avec rotation;pectoraux,obliques;épaules;h;;i;r;pushUp;Après chaque pompe, ouvrez un bras vers le plafond.
Pompes murales;pectoraux;triceps;h;mur;d;r;pushUp;Debout face au mur, mains à hauteur d'épaules : version la plus accessible.
Pompes claquées;pectoraux;triceps,épaules;h;;a;r;plyo;Poussez assez fort pour décoller les mains du sol, réception amortie.
Pompes sur anneaux;pectoraux;triceps,épaules,abdominaux;b;anneaux;a;r;pushUp;Instabilité des anneaux : exige un bon gainage.
Pompes pike;épaules;triceps,pectoraux (haut);h;;i;r;pushV;Hanches hautes en V inversé, descendez la tête entre les mains.
Pompes pike pieds surélevés;épaules;triceps;h;chaise;a;r;pushV;Pieds sur une chaise : se rapproche du développé vertical.
Pompes hindoues;épaules,pectoraux;triceps,dos;h;;i;r;pushV;Mouvement fluide en arc : hanches hautes puis glissé vers l'avant.
Développé couché prise serrée;triceps,pectoraux;épaules;g;barre,banc;i;r;pushH;Mains à largeur d'épaules, coudes près du corps.
Développé incliné barre;pectoraux (haut);épaules,triceps;g;barre,banc;i;r;pushH;Banc incliné à environ 30°.
Développé décliné barre;pectoraux (bas);triceps;g;barre,banc;i;r;pushH;Banc décliné, présence d'un partenaire recommandée.
Développé décliné haltères;pectoraux (bas);triceps;g;haltères,banc;i;r;pushH
Développé couché haltères prise neutre;pectoraux;triceps,épaules;b;haltères,banc;d;r;pushH;Paumes face à face : souvent plus confortable pour les épaules.
Développé couché Smith;pectoraux;triceps,épaules;g;smith,banc;d;r;pushH;Trajectoire guidée par la machine Smith.
Développé incliné Smith;pectoraux (haut);épaules,triceps;g;smith,banc;d;r;pushH
Développé couché machine convergente;pectoraux;triceps,épaules;g;machine;d;r;pushH;Chest press guidé, réglez la hauteur du siège.
Développé incliné machine;pectoraux (haut);épaules,triceps;g;machine;d;r;pushH
Développé décliné machine;pectoraux (bas);triceps;g;machine;d;r;pushH
Développé couché à la poulie;pectoraux;triceps;g;poulie,banc;i;r;pushH;Deux poulies basses, banc au centre.
Développé au sol haltères;pectoraux;triceps;h;haltères;d;r;pushH;Allongé au sol, les coudes touchent le sol en bas : amplitude réduite, ménage les épaules.
Développé au sol barre;pectoraux,triceps;épaules;b;barre;i;r;pushH
Développé couché élastique;pectoraux;triceps,épaules;h;élastique;d;r;pushH;Élastique passé dans le dos, allongé ou debout.
Svend press;pectoraux;épaules;b;haltères/disques;d;r;fly;Deux haltères (ou disques) serrés entre les paumes, poussez devant vous.
Développé militaire barre debout;épaules;triceps,abdominaux;g;barre;i;r;pushV;Barre devant les épaules, fessiers serrés.
Développé militaire barre assis;épaules;triceps;g;barre,banc;i;r;pushV
Développé Arnold;épaules;triceps;b;haltères;i;r;pushV;Paumes vers vous au départ, rotation pendant la poussée.
Développé épaules machine;épaules;triceps;g;machine;d;r;pushV
Développé épaules Smith;épaules;triceps;g;smith,banc;i;r;pushV
Développé épaules kettlebell;épaules;triceps,abdominaux;b;kettlebell;i;r;pushV
Développé épaules une main;épaules;obliques,triceps;b;haltères/kettlebell;i;r;pushV;Une main à la fois, le tronc résiste à l'inclinaison.
Push press;épaules;triceps,quadriceps;g;barre;a;r;pushV;Léger élan des jambes pour envoyer la barre.
Développé landmine;épaules,pectoraux (haut);triceps,abdominaux;g;barre;i;r;pushV;Extrémité de la barre calée dans un coin (landmine), poussée oblique.
Thruster haltères;corps entier;épaules,quadriceps;b;haltères;i;r;pushV;Squat enchaîné avec un développé.
Thruster kettlebell;corps entier;épaules,quadriceps;b;kettlebell;i;r;pushV
Élévations latérales poulie;deltoïdes latéraux;;g;poulie;i;r;lateral
Élévations latérales machine;deltoïdes latéraux;;g;machine;d;r;lateral
Élévations latérales élastique;deltoïdes latéraux;;h;élastique;d;r;lateral
Élévations latérales bouteilles;deltoïdes latéraux;;h;bouteilles;d;r;lateral;Deux bouteilles d'eau ou petits sacs : version maison.
Élévations latérales penché;deltoïdes latéraux,deltoïdes postérieurs;;b;haltères;i;r;lateral
Élévations frontales haltères;épaules;pectoraux (haut);b;haltères;d;r;lateral
Élévations frontales poulie;épaules;;g;poulie;d;r;lateral
Oiseau haltères penché;deltoïdes postérieurs;dos,trapèzes;b;haltères;d;r;rear
Oiseau machine;deltoïdes postérieurs;dos;g;machine;d;r;rear;Machine pec deck inversée (reverse fly).
Oiseau poulie vis-à-vis;deltoïdes postérieurs;dos;g;poulie;i;r;rear
Oiseau élastique;deltoïdes postérieurs;dos;h;élastique;d;r;rear
Écartés haltères;pectoraux;épaules;b;haltères,banc;d;r;fly
Écartés inclinés haltères;pectoraux (haut);épaules;b;haltères,banc;i;r;fly
Écartés poulie vis-à-vis;pectoraux;épaules;g;poulie;i;r;fly;Crossover : poulies hautes, mains qui se rejoignent devant.
Écartés poulie basse vers le haut;pectoraux (haut);épaules;g;poulie;i;r;fly
Écartés poulie haute vers le bas;pectoraux (bas);épaules;g;poulie;i;r;fly
Pec deck;pectoraux;épaules;g;machine;d;r;fly;Machine papillon, réglez la hauteur du siège.
Écartés élastique;pectoraux;épaules;h;élastique;d;r;fly
Dips barres parallèles;triceps,pectoraux (bas);épaules;b;barres parallèles;i;r;dip
Dips sur chaise;triceps;épaules,pectoraux;h;chaise;d;r;dip;Mains sur le bord d'une chaise stable, jambes tendues ou fléchies.
Dips sur banc;triceps;épaules;b;banc;d;r;dip
Dips machine assistée;triceps,pectoraux (bas);épaules;g;machine;d;r;dip
Extension triceps poulie corde;triceps;;g;poulie;d;r;tricepsExt
Extension triceps poulie barre droite;triceps;;g;poulie;d;r;tricepsExt
Extension triceps poulie barre V;triceps;;g;poulie;d;r;tricepsExt
Extension triceps poulie une main;triceps;;g;poulie;d;r;tricepsExt
Extension triceps poulie au-dessus de la tête;triceps;;g;poulie;i;r;tricepsExt
Barre au front;triceps;;g;barre,banc;i;r;tricepsExt;Aussi appelé skull crusher : barre EZ de préférence.
Barre au front haltères;triceps;;b;haltères,banc;i;r;tricepsExt
Extension nuque haltère;triceps;;b;haltères;d;r;tricepsExt
Kickback triceps;triceps;;b;haltères;d;r;tricepsExt
Extension triceps élastique;triceps;;h;élastique;d;r;tricepsExt
Extension triceps machine;triceps;;g;machine;d;r;tricepsExt
`;

// ---------- TIRAGE ----------
const PULL = `
Tractions prise large;dos;biceps,avant-bras;b;barre de traction;a;r;pullV
Tractions prise neutre;dos,biceps;;b;barre de traction;i;r;pullV
Tractions supination;biceps,dos;;b;barre de traction;i;r;pullV;Aussi appelé chin-up : paumes vers vous.
Tractions prise serrée;dos,biceps;;b;barre de traction;i;r;pullV
Tractions lestées;dos;biceps;b;barre de traction;a;r;pullV;Ceinture ou sac à dos lesté.
Tractions négatives;dos;biceps;b;barre de traction;i;r;pullV;Montez avec un saut ou une chaise, descendez en 4 à 5 secondes.
Tractions assistées élastique;dos;biceps;b;barre de traction,élastique;d;r;pullV
Tractions assistées machine;dos;biceps;g;machine;d;r;pullV
Tractions australiennes barre basse;dos;biceps,deltoïdes postérieurs;g;barre;d;r;pullH;Barre à hauteur de taille (rack ou Smith), corps gainé.
Tractions australiennes sous table;dos;biceps;h;table;d;r;pullH;Sous une table très stable : vérifiez sa solidité avant.
Tractions australiennes anneaux;dos;biceps,abdominaux;b;anneaux;i;r;pullH
Tirage vertical prise large;dos;biceps;g;poulie;d;r;pullV
Tirage vertical prise serrée;dos;biceps;g;poulie;d;r;pullV
Tirage vertical prise neutre;dos;biceps;g;poulie;d;r;pullV
Tirage vertical supination;dos,biceps;;g;poulie;d;r;pullV
Tirage vertical unilatéral;dos;biceps;g;poulie;i;r;pullV
Tirage vertical machine;dos;biceps;g;machine;d;r;pullV
Tirage élastique vertical;dos;biceps;h;élastique;d;r;pullV;Élastique fixé en hauteur (porte, barre).
Pull-over poulie bras tendus;dos;triceps,pectoraux;g;poulie;i;r;pullV
Pull-over haltère;dos,pectoraux;triceps;b;haltères,banc;i;r;pullV
Rowing barre supination;dos;biceps;g;barre;i;r;pullH
Rowing Pendlay;dos;lombaires,biceps;g;barre;a;r;pullH;La barre est reposée au sol à chaque répétition.
Rowing T-bar;dos;biceps;g;barre;i;r;pullH;Barre calée dans un coin (landmine) ou machine T-bar.
Rowing haltères penché;dos;biceps;b;haltères;d;r;pullH
Rowing haltère appui sur banc incliné;dos;biceps;b;haltères,banc;d;r;pullH;Poitrine appuyée sur le banc : ménage le bas du dos.
Rowing machine prise neutre;dos;biceps;g;machine;d;r;pullH
Rowing machine prise large;dos;deltoïdes postérieurs;g;machine;d;r;pullH
Rowing machine unilatéral;dos;biceps;g;machine;d;r;pullH
Rowing poulie basse prise large;dos;deltoïdes postérieurs;g;poulie;d;r;pullH
Rowing poulie unilatéral;dos;biceps;g;poulie;d;r;pullH
Rowing Smith;dos;biceps;g;smith;i;r;pullH
Rowing kettlebell;dos;biceps;b;kettlebell;d;r;pullH
Rowing sac à dos;dos;biceps;h;sac à dos;d;r;pullH;Sac chargé tenu à deux mains, buste penché dos plat.
Rowing serviette sur porte;dos;biceps;h;serviette,porte;d;r;pullH;Serviette nouée à une poignée de porte fermée, penchez-vous en arrière.
Rowing élastique unilatéral;dos;biceps;h;élastique;d;r;pullH
Landmine row;dos;biceps;g;barre;i;r;pullH
Shrugs haltères;trapèzes;;b;haltères;d;r;shrug
Shrugs barre;trapèzes;;g;barre;d;r;shrug
Shrugs Smith;trapèzes;;g;smith;d;r;shrug
Shrugs machine;trapèzes;;g;machine;d;r;shrug
Haussements sac à dos;trapèzes;;h;sac à dos;d;r;shrug
Extensions lombaires banc 45;lombaires;fessiers,ischio-jambiers;g;machine;d;r;lowback
Good morning;lombaires,ischio-jambiers;fessiers;g;barre;i;r;hinge
Superman;lombaires;fessiers;h;;d;r;lowback
Curl barre droite;biceps;;g;barre;d;r;curl
Curl barre EZ;biceps;;g;barre;d;r;curl
Curl haltères alternés;biceps;;b;haltères;d;r;curl
Curl marteau;biceps,avant-bras;;b;haltères;d;r;curl;Paumes face à face.
Curl concentration;biceps;;b;haltères;d;r;curl
Curl incliné haltères;biceps;;b;haltères,banc;i;r;curl
Curl pupitre;biceps;;g;machine;d;r;curl;Appui sur un pupitre (preacher), pas d'élan possible.
Curl poulie basse;biceps;;g;poulie;d;r;curl
Curl poulie haute;biceps;;g;poulie;i;r;curl
Curl machine;biceps;;g;machine;d;r;curl
Curl élastique;biceps;;h;élastique;d;r;curl
Curl araignée;biceps;;b;haltères,banc;i;r;curl;Poitrine contre un banc incliné, bras pendants.
Curl Zottman;biceps,avant-bras;;b;haltères;i;r;curl
Curl 21;biceps;;g;barre;i;r;curl;Sept répétitions bas, sept haut, sept complètes.
Curl sac à dos;biceps;;h;sac à dos;d;r;curl;Sac chargé tenu par les sangles.
Curl bouteilles;biceps;;h;bouteilles;d;r;curl
Curl poignets;avant-bras;;b;haltères;d;r;curl
Curl inversé barre;avant-bras,biceps;;g;barre;d;r;curl
Farmer walk;avant-bras,trapèzes;abdominaux;b;haltères/kettlebell;d;k;carry;Charges lourdes tenues le long du corps, 20 à 40 mètres.
`;

// ---------- JAMBES ----------
const LEGS = `
Squat sauté;quadriceps,fessiers;mollets;h;;i;r;plyo
Squat sumo;adducteurs,fessiers,quadriceps;;h;;d;r;squat;Pieds très écartés, pointes ouvertes.
Squat sumo haltère;adducteurs,fessiers;quadriceps;b;haltères/kettlebell;d;r;squat
Squat sac à dos;quadriceps,fessiers;;h;sac à dos;d;r;squat;Sac chargé contre la poitrine ou sur le dos.
Squat avant;quadriceps;fessiers,abdominaux;g;barre,rack;a;r;squat;Barre sur l'avant des épaules, coudes hauts.
Squat Smith;quadriceps,fessiers;;g;smith;d;r;squat
Squat hack machine;quadriceps;fessiers;g;machine;i;r;squat
Squat Zercher;quadriceps,fessiers;abdominaux;g;barre;a;r;squat;Barre dans le creux des coudes.
Squat sur banc;quadriceps,fessiers;;g;barre,banc;i;r;squat;Descente contrôlée jusqu'au banc, puis remontée.
Squat kettlebell double;quadriceps;fessiers;b;kettlebell;i;r;squat;Deux kettlebells en position rack.
Squat pistolet assisté;quadriceps,fessiers;abdominaux;h;mur;a;r;squat;Une main en appui sur un mur ou un montant.
Squat pistolet;quadriceps,fessiers;abdominaux;h;;a;r;squat
Squat sissy;quadriceps;;h;;a;r;squat
Squat isométrique contre un mur;quadriceps;fessiers;h;mur;d;t;squat;Dos contre le mur, cuisses à l'horizontale.
Squat assisté anneaux;quadriceps,fessiers;;b;anneaux;d;r;squat;Les anneaux aident à garder l'équilibre.
Presse à cuisses unilatérale;quadriceps,fessiers;;g;machine;i;r;squat
Presse à cuisses pieds hauts;fessiers,ischio-jambiers;quadriceps;g;machine;d;r;squat
Presse à cuisses pieds bas;quadriceps;;g;machine;d;r;squat
Leg extension;quadriceps;;g;machine;d;r;legext
Leg extension unilatéral;quadriceps;;g;machine;i;r;legext
Fentes avant;quadriceps,fessiers;;h;;d;r;lunge
Fentes marchées;quadriceps,fessiers;;h;;d;r;lunge
Fentes marchées haltères;quadriceps,fessiers;;b;haltères;i;r;lunge
Fentes arrière haltères;quadriceps,fessiers;;b;haltères;d;r;lunge
Fentes arrière Smith;quadriceps,fessiers;;g;smith;i;r;lunge
Fentes barre;quadriceps,fessiers;;g;barre;i;r;lunge
Fentes latérales;adducteurs,quadriceps,fessiers;;h;;d;r;lunge
Fentes croisées;fessiers,abducteurs;quadriceps;h;;i;r;lunge;Aussi appelées fentes curtsy.
Fentes sautées;quadriceps,fessiers;mollets;h;;a;r;plyo
Squat bulgare poids du corps;quadriceps,fessiers;;h;chaise;d;r;lunge;Pied arrière posé sur une chaise.
Squat bulgare Smith;quadriceps,fessiers;;g;smith,banc;i;r;lunge
Step-up haltères;quadriceps,fessiers;;b;haltères,banc;d;r;lunge
Step-up latéral;quadriceps,fessiers,abducteurs;;h;chaise;d;r;lunge
Soulevé de terre conventionnel;ischio-jambiers,fessiers,dos;lombaires,quadriceps;g;barre;i;r;hinge
Soulevé de terre sumo;fessiers,adducteurs,quadriceps;dos,ischio-jambiers;g;barre;i;r;hinge
Soulevé de terre trap bar;quadriceps,fessiers;dos;g;barre;i;r;hinge;Barre hexagonale (trap bar).
Soulevé de terre jambes tendues;ischio-jambiers;lombaires;g;barre;a;r;hinge
Roumain unijambiste;ischio-jambiers,fessiers;abdominaux;b;haltères/kettlebell;i;r;hinge
Roumain Smith;ischio-jambiers,fessiers;;g;smith;d;r;hinge
Bonjour unijambiste sans charge;ischio-jambiers,fessiers;;h;;d;r;hinge
Kettlebell swing;fessiers,ischio-jambiers;dos,épaules;b;kettlebell;i;r;hinge;Le mouvement vient des hanches, pas des bras.
Kettlebell swing une main;fessiers,ischio-jambiers;obliques;b;kettlebell;a;r;hinge
Extension de hanche banc 45;fessiers,ischio-jambiers;lombaires;g;machine;d;r;hinge
Hip thrust barre;fessiers;ischio-jambiers;g;barre,banc;i;r;glute
Hip thrust haltère;fessiers;;b;haltères,banc;d;r;glute
Hip thrust machine;fessiers;;g;machine;d;r;glute
Hip thrust Smith;fessiers;;g;smith,banc;i;r;glute
Hip thrust poids du corps;fessiers;;h;canapé;d;r;glute;Haut du dos appuyé sur le canapé ou un banc.
Hip thrust unilatéral;fessiers;;h;canapé;i;r;glute
Pont fessier pieds surélevés;fessiers,ischio-jambiers;;h;chaise;d;r;glute
Pont fessier unilatéral;fessiers;;h;;d;r;glute
Pont fessier élastique;fessiers,abducteurs;;h;élastique;d;r;glute
Pont fessier sac à dos;fessiers;;h;sac à dos;d;r;glute
Kickback fessier poulie;fessiers;;g;poulie;d;r;glute
Kickback fessier machine;fessiers;;g;machine;d;r;glute
Donkey kick;fessiers;;h;;d;r;glute
Fire hydrant;abducteurs,fessiers;;h;;d;r;glute
Clamshell élastique;abducteurs;;h;élastique;d;r;glute
Abduction hanche machine;abducteurs,fessiers;;g;machine;d;r;glute
Adduction hanche machine;adducteurs;;g;machine;d;r;glute
Abduction poulie;abducteurs;;g;poulie;d;r;glute
Marche latérale élastique;abducteurs,fessiers;;h;élastique;d;r;glute
Leg curl assis;ischio-jambiers;;g;machine;d;r;legiso
Leg curl allongé;ischio-jambiers;;g;machine;d;r;legiso
Leg curl unilatéral;ischio-jambiers;;g;machine;i;r;legiso
Leg curl swiss ball;ischio-jambiers,fessiers;;b;swiss ball;i;r;legiso
Curl ischios glissé;ischio-jambiers;;h;serviette;i;r;legiso;Talons sur une serviette, sur sol lisse.
Nordic curl;ischio-jambiers;;h;;a;r;legiso;Pieds bloqués, descente la plus lente possible.
Glute-ham raise;ischio-jambiers,fessiers;;g;machine;a;r;legiso
Mollets à la presse;mollets;;g;machine;d;r;calf
Mollets assis machine;mollets;;g;machine;d;r;calf
Mollets debout machine;mollets;;g;machine;d;r;calf
Mollets debout Smith;mollets;;g;smith;d;r;calf
Mollets unilatéral sur marche;mollets;;h;marche;d;r;calf
Mollets debout haltères;mollets;;b;haltères,marche;d;r;calf
Mollets debout escalier;mollets;;h;escalier;d;r;calf
Marche sur la pointe des pieds;mollets;;h;;d;t;calf
Box jump;quadriceps,fessiers;mollets;g;step;i;r;plyo;Sur une box ou un step solide, descente en marchant.
Saut en longueur sur place;quadriceps,fessiers;mollets;h;;i;r;plyo
Skater jumps;fessiers,abducteurs;quadriceps;h;;i;r;plyo
`;

// ---------- TRONC ----------
const CORE = `
Planche haute;abdominaux;épaules;h;;d;t;plank
Planche avec levé de jambe;abdominaux,fessiers;;h;;i;t;plank
Planche latérale avec levé de jambe;obliques,abducteurs;;h;;i;t;plank
Planche dynamique;abdominaux;épaules,triceps;h;;i;r;plank;Passez de la planche sur avant-bras à la planche haute et inversement.
Planche sur swiss ball;abdominaux;;b;swiss ball;i;t;plank
Gainage hollow hold;abdominaux;;h;;i;t;plank;Dos plaqué, jambes et épaules légèrement décollées.
Gainage L-sit;abdominaux;triceps;b;barres parallèles;a;t;plank
Mountain climbers;abdominaux;épaules;h;;d;t;plank;Genoux alternés vers la poitrine en position de planche haute.
Crunch inversé;abdominaux;;h;;d;r;crunch
Crunch bicyclette;abdominaux,obliques;;h;;d;r;crunch
Crunch poulie haute;abdominaux;;g;poulie;d;r;crunch;À genoux face à la poulie.
Crunch machine;abdominaux;;g;machine;d;r;crunch
Crunch décliné;abdominaux;;b;banc;d;r;crunch
Crunch swiss ball;abdominaux;;b;swiss ball;d;r;crunch
Sit-up;abdominaux;fléchisseurs de hanche;h;;d;r;crunch
V-up;abdominaux;;h;;i;r;crunch
Toe touches;abdominaux;;h;;d;r;crunch
Relevés de jambes au sol;abdominaux;;h;;d;r;legraise
Relevés de jambes suspendu;abdominaux;avant-bras;b;barre de traction;i;r;legraise
Relevés de genoux suspendu;abdominaux;avant-bras;b;barre de traction;d;r;legraise
Relevés de genoux chaise romaine;abdominaux;;g;machine;d;r;legraise
Flutter kicks;abdominaux;;h;;d;t;legraise
Ciseaux;abdominaux;;h;;d;t;legraise
Russian twist;obliques,abdominaux;;h;;d;r;rot
Russian twist lesté;obliques;abdominaux;b;haltères/medecine ball;i;r;rot
Bûcheron poulie haut vers bas;obliques;abdominaux;g;poulie;i;r;rot
Bûcheron poulie bas vers haut;obliques;abdominaux;g;poulie;i;r;rot
Rotation machine;obliques;;g;machine;d;r;rot
Roue abdominale à genoux;abdominaux;épaules;b;roue abdominale;i;r;plank
Roue abdominale debout;abdominaux;épaules;b;roue abdominale;a;r;plank
Hip dips latéraux;obliques;;h;;d;r;rot
Windshield wipers;obliques,abdominaux;;b;barre de traction;a;r;rot
Suitcase carry;obliques,avant-bras;abdominaux;b;haltères/kettlebell;d;k;carry;Une seule charge, tenue d'un côté : le tronc résiste à l'inclinaison.
Landmine rotation;obliques;épaules;g;barre;i;r;rot
Lancer de médecine ball en rotation;obliques;épaules;b;medecine ball;d;r;rot;Contre un mur solide.
`;

// ---------- CARDIO ----------
const CARDIO = `
Marche rapide;cardio;;h;;d;k;cardioSteady
Marche inclinée sur tapis;cardio;fessiers,mollets;g;tapis;d;k;cardioSteady
Course sur tapis;cardio;;g;tapis;d;k;cardioSteady
Course fractionnée;cardio;;h;;i;t;cardioHiit;Par exemple 1 minute rapide, 1 minute lente, répété.
Sprints;cardio;jambes;h;;a;t;cardioHiit;Après un très bon échauffement.
Course en côte;cardio;jambes;h;;i;k;cardioSteady
Vélo d'appartement;cardio;jambes;g;vélo;d;k;cardioSteady
Cours de vélo en salle;cardio;jambes;g;vélo;i;t;cardioSteady
Assault bike;cardio;corps entier;g;machine;i;t;cardioHiit
Elliptique;cardio;;g;machine;d;k;cardioSteady
Machine à escaliers;cardio;fessiers;g;machine;d;t;cardioSteady
Escaliers à pied;cardio;jambes,fessiers;h;escalier;d;t;cardioSteady
Rameur par intervalles;cardio;dos,jambes;g;rameur;i;t;cardioHiit
SkiErg;cardio;dos,épaules;g;machine;i;t;cardioHiit
Jumping jacks;cardio;;h;;d;t;cardioHiit
Burpees;cardio;corps entier;h;;i;r;cardioHiit
Montées de genoux;cardio;;h;;d;t;cardioHiit
Talons-fesses;cardio;;h;;d;t;cardioHiit
Shadow boxing;cardio;épaules;h;;d;t;cardioHiit
Sac de frappe;cardio;épaules;g;sac de frappe;i;t;cardioHiit
Battle ropes;cardio;épaules,abdominaux;g;battle ropes;i;t;cardioHiit
Traîneau poussé;cardio,quadriceps;fessiers;g;traîneau;i;k;cardioHiit
Randonnée;cardio;jambes;h;;d;k;cardioSteady
Danse;cardio;;h;;d;t;cardioSteady
Step aérobic;cardio;jambes;h;step;d;t;cardioSteady
`;

// ---------- MOBILITÉ & ÉTIREMENTS ----------
const MOB = `
Mobilité de hanches 90/90;hanches;;h;;d;t;mob
Pigeon;fessiers,hanches;;h;;d;t;stretch
Fente basse avec rotation;hanches,dos;ischio-jambiers;h;;d;r;mob;Souvent appelé « world's greatest stretch ».
Chat-vache;dos;;h;;d;r;mob
Posture de l'enfant;dos,hanches;;h;;d;t;stretch
Étirement des ischio-jambiers;ischio-jambiers;;h;;d;t;stretch
Étirement des quadriceps;quadriceps;;h;;d;t;stretch
Étirement des mollets au mur;mollets;;h;mur;d;t;stretch
Étirement des pectoraux à la porte;pectoraux;épaules;h;porte;d;t;stretch
Étirement des épaules bras croisé;épaules;;h;;d;t;stretch
Étirement des triceps;triceps;;h;;d;t;stretch
Étirement des fléchisseurs de hanche;hanches;;h;;d;t;stretch
Étirement des adducteurs (papillon);adducteurs;;h;;d;t;stretch
Étirement des fessiers allongé;fessiers;;h;;d;t;stretch
Étirement lombaires genoux poitrine;lombaires;;h;;d;t;stretch
Rotation allongée du dos;dos,lombaires;;h;;d;t;stretch
Étirement des avant-bras;avant-bras;;h;;d;t;stretch
Étirement doux du cou;trapèzes;;h;;d;t;stretch
Cobra;abdominaux;;h;;d;t;stretch
Chien tête en bas;épaules,ischio-jambiers;mollets;h;;d;t;stretch
Dislocations d'épaule;épaules;;h;bâton;d;r;mob;Bâton ou manche à balai, prise large, aucun forçage.
Wall slides;épaules,trapèzes;;h;mur;d;r;mob
Cercles d'épaules;épaules;;h;;d;r;mob
Open book;dos;obliques;h;;d;r;mob;Allongé sur le côté, ouvrez le bras supérieur vers l'arrière.
Squat profond maintenu;hanches,chevilles;;h;;d;t;mob
Cercles de hanches;hanches;;h;;d;r;mob
Mobilité des poignets;avant-bras;;h;;d;r;mob
Mobilité de cheville au mur;chevilles;mollets;h;mur;d;r;mob
Rotation de tronc assise;obliques,dos;;h;chaise;d;r;mob
Respiration diaphragmatique;abdominaux;;h;;d;t;mob;Mains sur le ventre, inspirez en le gonflant doucement.
Salutation au soleil;corps entier;;h;;d;r;mob
Kettlebell halo;épaules;abdominaux;b;kettlebell;d;r;mob
`;

// ---------- FONCTIONNEL, KETTLEBELL, HALTÉROPHILIE, ANNEAUX ----------
const FUNC = `
Turkish get-up;corps entier;épaules,abdominaux;b;kettlebell;a;r;plank;Mouvement en plusieurs étapes : apprenez-le à vide ou avec une charge très légère.
Kettlebell clean;fessiers,dos;épaules;b;kettlebell;i;r;hinge
Kettlebell snatch;corps entier;;b;kettlebell;a;r;hinge
Kettlebell windmill;obliques,épaules;ischio-jambiers;b;kettlebell;a;r;rot
Épaulé;corps entier;dos,trapèzes;g;barre;a;r;olympic;Aussi appelé power clean.
Arraché;corps entier;;g;barre;a;r;olympic
Épaulé-jeté;corps entier;;g;barre;a;r;olympic
Slam ball;corps entier;abdominaux,épaules;g;medecine ball;d;r;plyo
Wall ball;corps entier;épaules;g;medecine ball;i;r;plyo
Curl anneaux;biceps;;b;anneaux;i;r;curl
Extension triceps anneaux;triceps;;b;anneaux;i;r;tricepsExt
Face pull anneaux;deltoïdes postérieurs;dos;b;anneaux;d;r;rear
Face pull poulie;deltoïdes postérieurs;trapèzes;g;poulie;d;r;rear
Face pull élastique;deltoïdes postérieurs;trapèzes;h;élastique;d;r;rear
`;


// ---------- COMPLÉMENTS : variantes barre, haltères, poulie, machines guidées, maison ----------
const MORE_PUSH = `
Développé couché pause;pectoraux;triceps,épaules;g;barre,banc;i;r;pushH;Marquez 1 à 2 secondes d'arrêt barre sur la poitrine.
Développé couché prise large;pectoraux;épaules,triceps;g;barre,banc;i;r;pushH
Développé couché une main haltère;pectoraux;obliques,triceps;b;haltères,banc;i;r;pushH;Le tronc résiste à la rotation.
Développé Spoto;pectoraux;triceps;g;barre,banc;a;r;pushH;Arrêt de la barre quelques centimètres au-dessus de la poitrine.
Développé couché sur machine unilatérale;pectoraux;triceps;g;machine;d;r;pushH
Développé hammer machine;pectoraux;triceps,épaules;g;machine;d;r;pushH;Prise neutre guidée.
Développé incliné prise neutre haltères;pectoraux (haut);épaules,triceps;b;haltères,banc;d;r;pushH
Développé incliné une main haltère;pectoraux (haut);épaules;b;haltères,banc;i;r;pushH
Développé couché élastique unilatéral;pectoraux;triceps;h;élastique;d;r;pushH
Pompes sur banc surélevé;pectoraux;triceps,épaules;b;banc;d;r;pushUp
Pompes sur barres parallèles;pectoraux;triceps,épaules;b;barres parallèles;i;r;pushUp;Amplitude plus grande que sur le sol.
Pompes pieds sur swiss ball;pectoraux;épaules,abdominaux;b;swiss ball;a;r;pushUp
Pompes lestées avec disque;pectoraux;triceps,épaules;b;barre;a;r;pushUp;Disque posé sur le haut du dos par un partenaire.
Pompes une main sur marche;pectoraux;triceps,abdominaux;h;marche;i;r;pushUp;Une main surélevée, l'autre au sol : alternez les côtés.
Pompes sur poings;pectoraux;triceps,avant-bras;h;;i;r;pushUp;Poignets alignés, utile si les poignets fatiguent.
Pompes explosives;pectoraux;triceps,épaules;h;;i;r;plyo
Pompes isométriques en bas;pectoraux;triceps;h;;i;t;plank;Tenir la position basse, poitrine à quelques centimètres du sol.
Landmine press une main;épaules,pectoraux (haut);obliques,triceps;g;barre;i;r;pushV
Z-press;épaules;abdominaux,triceps;g;barre/haltères;a;r;pushV;Assis au sol, jambes tendues : impossible de tricher avec les jambes.
Développé haltères assis incliné 75;épaules;triceps,pectoraux (haut);b;haltères,banc;d;r;pushV
Tirage menton haltères;épaules,trapèzes;biceps;b;haltères;i;r;shrug;Coudes qui montent au-dessus des mains, prise pas trop serrée.
Tirage menton barre;épaules,trapèzes;biceps;g;barre;i;r;shrug
Tirage menton poulie;épaules,trapèzes;;g;poulie;i;r;shrug
Élévations latérales unilatérales poulie;deltoïdes latéraux;;g;poulie;i;r;lateral;Une main à la fois, bras croisé devant le corps.
Élévations latérales assis;deltoïdes latéraux;;b;haltères,banc;d;r;lateral
Élévations en Y;deltoïdes postérieurs,trapèzes;épaules;b;haltères/élastique;d;r;rear;Bras en V au-dessus de la tête.
Élévations en T;deltoïdes postérieurs;trapèzes;b;haltères/élastique;d;r;rear
Rotation externe poulie;deltoïdes postérieurs;épaules;g;poulie;d;r;rear;Coude collé au corps, rotation de l'avant-bras vers l'extérieur.
Rotation externe élastique;deltoïdes postérieurs;épaules;h;élastique;d;r;rear;Coude collé au corps, utile pour l'épaule.
Rotation externe haltère allongé;deltoïdes postérieurs;épaules;b;haltères;d;r;rear;Charge très légère.
Extension triceps haltère à deux mains;triceps;;b;haltères;d;r;tricepsExt
Extension triceps allongé poulie;triceps;;g;poulie,banc;i;r;tricepsExt
Extension triceps poulie prise inversée;triceps;avant-bras;g;poulie;d;r;tricepsExt
Développé JM;triceps;pectoraux;g;barre,banc;a;r;tricepsExt
Tate press;triceps;;b;haltères,banc;i;r;tricepsExt
Extension triceps au sol haltères;triceps;;h;haltères;d;r;tricepsExt
Extension triceps sac à dos;triceps;;h;sac à dos;d;r;tricepsExt;Sac chargé tenu derrière la tête à deux mains.
Dips lestés;triceps,pectoraux (bas);épaules;b;barres parallèles;a;r;dip
Dips entre deux chaises;triceps,pectoraux (bas);épaules;h;chaise;i;r;dip;Deux chaises très stables, mains sur les assises.
Crossover poulie milieu;pectoraux;épaules;g;poulie;i;r;fly
Écartés unilatéraux poulie;pectoraux;épaules;g;poulie;i;r;fly
Écartés au sol haltères;pectoraux;épaules;h;haltères;d;r;fly
Pull-over élastique;dos,pectoraux;triceps;h;élastique;d;r;pullV
`;

const MORE_PULL = `
Tractions pronation unilatérale assistées;dos;biceps;b;barre de traction,élastique;a;r;pullV
Tractions L-sit;dos,abdominaux;biceps;b;barre de traction;a;r;pullV
Tractions explosives;dos;biceps;b;barre de traction;a;r;pullV;Montez assez haut pour que la poitrine touche presque la barre.
Suspension active;dos,avant-bras;épaules;b;barre de traction;d;t;pullV;Épaules basses, sans se laisser pendre passivement.
Suspension passive;avant-bras,dos;épaules;b;barre de traction;d;t;pullV
Tractions poitrine à la barre;dos;biceps,deltoïdes postérieurs;b;barre de traction;a;r;pullV
Tractions prise large assistée machine;dos;biceps;g;machine;d;r;pullV
Tirage poitrine prise large;dos;biceps;g;poulie;d;r;pullV;Barre vers le haut de la poitrine, jamais derrière la nuque.
Tirage vertical bras tendus;dos;triceps;g;poulie;i;r;pullV
Tirage haut machine convergente;dos;biceps;g;machine;d;r;pullV
Tirage horizontal machine prise haute;dos;deltoïdes postérieurs;g;machine;d;r;pullH
Tirage horizontal machine prise basse;dos;biceps;g;machine;d;r;pullH
Rowing assis machine unilatéral prise neutre;dos;biceps;g;machine;d;r;pullH
Rowing à la poulie basse à une main;dos;biceps;g;poulie;d;r;pullH
Rowing penché prise large;dos;deltoïdes postérieurs;g;barre;i;r;pullH
Rowing haltère à genou;dos;biceps;b;haltères;d;r;pullH
Rowing Kroc;dos;avant-bras,biceps;g;haltères;a;r;pullH;Charge lourde, répétitions nombreuses, avec une légère impulsion contrôlée.
Rowing Meadows;dos;biceps;g;barre;a;r;pullH
Rowing gorille;dos;biceps;b;kettlebell/haltères;i;r;pullH;Deux charges au sol, tirez une main après l'autre.
Rowing renégat;dos,abdominaux;épaules,biceps;b;haltères;a;r;pullH
Rowing poitrine appuyée barre;dos;biceps;g;barre,banc;i;r;pullH
Rowing poitrine appuyée machine;dos;biceps;g;machine;d;r;pullH
Rowing inversé sous la barre de Smith;dos;biceps;g;smith;d;r;pullH
Tirage bras tendus à genoux;dos;triceps;g;poulie;i;r;pullV
Pull-over machine;dos;triceps;g;machine;d;r;pullV
Tirage élastique horizontal;dos;biceps;h;élastique;d;r;pullH
Tirage élastique bras tendus;dos;triceps;h;élastique;d;r;pullV
Face pull à genoux;deltoïdes postérieurs;trapèzes;g;poulie;d;r;rear
Shrugs unilatéral haltère;trapèzes;;b;haltères;d;r;shrug
Shrugs derrière;trapèzes;;g;barre;i;r;shrug
Rack pull;dos,fessiers;ischio-jambiers,trapèzes;g;barre,rack;i;r;hinge;Soulevé de terre partiel, départ barre au niveau des genoux.
Hyperextension sans charge;lombaires;fessiers;g;machine;d;r;lowback
Hyperextension lestée;lombaires,fessiers;ischio-jambiers;g;machine;i;r;lowback
Hyperextension inversée;fessiers,lombaires;;g;machine;i;r;lowback;Bassin sur le banc, jambes qui montent.
Bird dog avec charge;lombaires,fessiers;abdominaux;h;élastique;d;r;lowback
Curl barre prise serrée;biceps;;g;barre;d;r;curl
Curl barre prise large;biceps;;g;barre;d;r;curl
Curl marteau corde poulie;biceps,avant-bras;;g;poulie;d;r;curl
Curl marteau croisé;biceps,avant-bras;;b;haltères;d;r;curl
Curl marteau incliné;biceps,avant-bras;;b;haltères,banc;i;r;curl
Curl pupitre haltère;biceps;;b;haltères,banc;d;r;curl
Curl pupitre barre EZ;biceps;;g;barre,banc;d;r;curl
Curl Bayesian poulie;biceps;;g;poulie;i;r;curl;Dos tourné à la poulie, bras en arrière : étirement maximal.
Curl drag;biceps;;g;barre;i;r;curl;La barre remonte le long du corps, coudes vers l'arrière.
Curl poulie unilatéral;biceps;;g;poulie;d;r;curl
Curl biceps machine unilatéral;biceps;;g;machine;d;r;curl
Curl biceps élastique unilatéral;biceps;;h;élastique;d;r;curl
Curl inversé élastique;avant-bras;biceps;h;élastique;d;r;curl
Curl poignets inversé;avant-bras;;b;haltères;d;r;curl
Curl poignets barre;avant-bras;;g;barre;d;r;curl
Rotation avant-bras (pronation-supination);avant-bras;;b;haltères;d;r;curl;Marteau léger tenu en bout de manche, rotation lente.
Suspension à une main;avant-bras,dos;épaules;b;barre de traction;a;t;pullV
`;

const MORE_LEGS = `
Squat tempo;quadriceps,fessiers;;g;barre,rack;i;r;squat;Descente en 3 secondes, remontée normale.
Squat pause;quadriceps,fessiers;;g;barre,rack;i;r;squat;Marquez 2 secondes en bas.
Squat talons surélevés;quadriceps;fessiers;b;haltères,step;d;r;squat;Talons sur un petit disque ou une planche : plus de travail des quadriceps.
Squat cycliste;quadriceps;;g;smith;i;r;squat;Pieds avancés et serrés, talons surélevés.
Squat de sécurité (safety bar);quadriceps,fessiers;dos;g;barre,rack;i;r;squat;Barre spéciale qui repose sur les épaules.
Squat overhead;quadriceps,épaules;abdominaux;g;barre;a;r;squat;Barre tenue bras tendus au-dessus de la tête : mobilité exigée.
Squat hack inversé;fessiers,quadriceps;;g;machine;i;r;squat
Squat pendulaire;quadriceps;fessiers;g;machine;i;r;squat
Squat en ceinture (belt squat);quadriceps,fessiers;;g;machine;i;r;squat;Charge fixée à la taille, colonne déchargée.
Presse à cuisses 45 degrés;quadriceps,fessiers;ischio-jambiers;g;machine;d;r;squat
Presse à cuisses horizontale;quadriceps,fessiers;;g;machine;d;r;squat
Squat Cossack;adducteurs,quadriceps,fessiers;;h;;i;r;lunge;Grand pas latéral, une jambe fléchie, l'autre tendue.
Squat Jefferson;quadriceps,fessiers,adducteurs;;g;barre;a;r;squat
Squat goblet talons surélevés;quadriceps;fessiers;b;haltères/kettlebell,step;d;r;squat
Fentes arrière déficit;quadriceps,fessiers;;b;haltères,step;i;r;lunge;Pied avant sur une surélévation.
Fentes marchées barre;quadriceps,fessiers;;g;barre;i;r;lunge
Fentes avant Smith;quadriceps,fessiers;;g;smith;i;r;lunge
Fentes arrière anneaux;quadriceps,fessiers;;b;anneaux;d;r;lunge
Fentes isométriques;quadriceps,fessiers;;h;;d;t;lunge
Montée sur banc latérale haltères;quadriceps,fessiers,abducteurs;;b;haltères,banc;d;r;lunge
Step-up excentrique;quadriceps;fessiers;h;marche;i;r;lunge;Montez normalement, descendez très lentement.
Soulevé de terre roumain haltères;ischio-jambiers,fessiers;lombaires;b;haltères;d;r;hinge
Soulevé de terre roumain à une jambe;ischio-jambiers,fessiers;abdominaux;b;haltères/kettlebell;i;r;hinge
Soulevé de terre roumain kettlebell;ischio-jambiers,fessiers;;b;kettlebell;d;r;hinge
Soulevé de terre roumain élastique;ischio-jambiers,fessiers;;h;élastique;d;r;hinge
Soulevé de terre roumain sac à dos;ischio-jambiers,fessiers;;h;sac à dos;d;r;hinge
Soulevé de terre déficit;ischio-jambiers,fessiers,quadriceps;dos;g;barre;a;r;hinge
Soulevé de terre prise mixte;ischio-jambiers,fessiers,dos;avant-bras;g;barre;i;r;hinge
Good morning assis;lombaires,ischio-jambiers;fessiers;g;barre,banc;a;r;hinge
Tirage entre les jambes poulie;fessiers,ischio-jambiers;;g;poulie;d;r;hinge;Cable pull-through : charnière de hanche à la poulie basse.
Frog pump;fessiers;;h;;d;r;glute
Pont fessier marché;fessiers,ischio-jambiers;abdominaux;h;;i;r;glute
Hip thrust à une jambe barre;fessiers;ischio-jambiers;g;barre,banc;a;r;glute
Hip thrust pause;fessiers;;g;barre,banc;i;r;glute;Marquez 2 secondes en haut.
Hip thrust élastique;fessiers,abducteurs;;b;élastique,banc;d;r;glute
Kickback quadrupédie élastique;fessiers;;h;élastique;d;r;glute
Extension de hanche poulie;fessiers;;g;poulie;d;r;glute
Abduction couché sur le côté;abducteurs,fessiers;;h;;d;r;glute
Abduction couché élastique;abducteurs;;h;élastique;d;r;glute
Adduction couché sur le côté;adducteurs;;h;;d;r;glute
Adduction poulie;adducteurs;;g;poulie;d;r;glute
Copenhagen plank;adducteurs;obliques;b;banc;a;t;plank
Levée de jambe latérale debout;abducteurs;fessiers;h;;d;r;glute
Leg curl debout;ischio-jambiers;;g;machine;d;r;legiso
Leg curl poulie;ischio-jambiers;;g;poulie;d;r;legiso
Leg curl élastique;ischio-jambiers;;h;élastique;d;r;legiso
Leg curl haltère entre les pieds;ischio-jambiers;;b;haltères,banc;i;r;legiso
Leg curl swiss ball unilatéral;ischio-jambiers,fessiers;;b;swiss ball;a;r;legiso
Nordic curl assisté élastique;ischio-jambiers;;h;élastique;i;r;legiso
Nordic reverse;quadriceps;;h;;a;r;squat;À genoux, penchez-vous en arrière buste aligné.
Extension de jambe élastique;quadriceps;;h;élastique;d;r;legext
Mollets assis haltère;mollets;;b;haltères,banc;d;r;calf
Mollets à la presse unilatéral;mollets;;g;machine;i;r;calf
Releves de pointes (tibial);jambier antérieur;;h;mur;d;r;calf;Dos au mur, relevez la pointe des pieds.
Releves de pointes poulie;jambier antérieur;;g;poulie;d;r;calf
Mollets sautés;mollets;;h;;d;r;plyo
Saut à la corde pieds joints;mollets,cardio;;h;corde;d;t;plyo
Saut de grenouille;quadriceps,fessiers;mollets;h;;i;r;plyo
Saut latéral par-dessus une ligne;quadriceps,mollets;abducteurs;h;;d;t;plyo
Saut sur box unilatéral;quadriceps,fessiers;mollets;g;step;a;r;plyo
Burpee box jump;corps entier;;g;step;a;r;plyo
Sled drag arrière;quadriceps;mollets;g;traîneau;i;k;cardioHiit;Traîneau tiré à reculons, genoux fléchis.
`;

const MORE_CORE = `
Dragon flag;abdominaux;;b;banc;a;r;legraise
Toes-to-bar;abdominaux;avant-bras;b;barre de traction;a;r;legraise
Relevés de jambes suspendu en V;abdominaux;;b;barre de traction;a;r;legraise
Relevés de bassin au sol;abdominaux;;h;;d;r;legraise
Relevé de jambes banc;abdominaux;;b;banc;d;r;legraise
Relevé de jambes machine;abdominaux;;g;machine;d;r;legraise
Hollow rocks;abdominaux;;h;;i;r;plank
Dead hang L-sit;abdominaux;;b;barre de traction;a;t;plank
Bear crawl;corps entier;abdominaux,épaules;h;;d;k;plank;Quatre appuis, genoux à quelques centimètres du sol.
Planche shoulder taps;abdominaux;épaules;h;;d;r;plank;Touchez l'épaule opposée sans balancer le bassin.
Planche to pike;abdominaux;épaules;h;serviette;a;r;plank;Pieds sur une serviette, sol lisse.
Planche araignée;abdominaux,obliques;;h;;i;r;plank
Planche inversée;fessiers,lombaires;épaules;h;;d;t;plank
Planche sur bras tendus avec élévation de bras;abdominaux;épaules;h;;i;r;plank
Planche côté sur bras tendu;obliques;épaules;h;;d;t;plank
Stir the pot;abdominaux;épaules;b;swiss ball;a;r;plank;Petits cercles des avant-bras sur la balle.
Dead bug avec élastique;abdominaux;;h;élastique;d;r;crunch
Dead bug lesté;abdominaux;;b;haltères/medecine ball;i;r;crunch
Crunch obliques;obliques,abdominaux;;h;;d;r;crunch
Crunch haltère;abdominaux;;b;haltères;d;r;crunch
Crunch à la poulie unilatéral;abdominaux,obliques;;g;poulie;i;r;crunch
Flexion latérale haltère;obliques;;b;haltères;d;r;rot
Flexion latérale poulie;obliques;;g;poulie;d;r;rot
Pallof press à genoux;obliques,abdominaux;;g;poulie;d;r;rot
Pallof press élastique;obliques,abdominaux;;h;élastique;d;r;rot
Pallof press avec mouvement de bras;obliques;épaules;g;poulie;i;r;rot
Bûcheron élastique;obliques;abdominaux;h;élastique;d;r;rot
Lancer de médecine ball au sol;abdominaux;épaules;b;medecine ball;d;r;rot
Rotation russe poulie;obliques;;g;poulie;i;r;rot
Wipers au sol;obliques,abdominaux;;h;;i;r;rot
Roue abdominale unilatérale;abdominaux,obliques;épaules;b;roue abdominale;a;r;plank
Roue abdominale sur swiss ball;abdominaux;épaules;b;swiss ball;i;r;plank
Farmer walk unilatéral;obliques;avant-bras,abdominaux;b;haltères/kettlebell;d;k;carry
Rack carry;abdominaux,épaules;trapèzes;b;kettlebell;i;k;carry;Charges tenues contre la poitrine.
Overhead carry;épaules,abdominaux;trapèzes;b;kettlebell/haltères;i;k;carry;Bras tendu au-dessus de la tête, côtes rentrées.
Portage de sac à dos;abdominaux;avant-bras,trapèzes;h;sac à dos;d;k;carry;Sac chargé tenu contre la poitrine, marchez à pas réguliers.
Portage de bidons;avant-bras,abdominaux;trapèzes;h;bouteilles;d;k;carry;Deux bidons ou packs d'eau, un dans chaque main.
Sprawl;corps entier;abdominaux;h;;i;r;cardioHiit
Mobilité thoracique à quatre pattes;dos;obliques;h;;d;r;mob
Tuck sit;abdominaux;triceps;b;barres parallèles;i;t;plank
`;

const MORE_CARDIO = `
Marche nordique;cardio;bras;h;;d;k;cardioSteady
Marche en montée;cardio;fessiers,mollets;h;;d;k;cardioSteady
Marche avec sac à dos;cardio;jambes;h;sac à dos;d;k;cardioSteady
Course lente;cardio;;h;;d;k;cardioSteady;Allure à laquelle on peut tenir une conversation.
Course à 400 mètres;cardio;jambes;h;;i;k;cardioHiit
Course à pied sur piste;cardio;;h;;d;k;cardioSteady
Course de côte en marche;cardio;jambes;h;;d;k;cardioSteady
Vélo sur route;cardio;jambes;h;vélo;d;k;cardioSteady
Vélo par intervalles;cardio;jambes;g;vélo;i;t;cardioHiit
Vélo allongé;cardio;jambes;g;machine;d;k;cardioSteady
Rameur régulier;cardio;dos,jambes;g;rameur;d;k;cardioSteady
Rameur 500 mètres;cardio;dos,jambes;g;rameur;i;k;cardioHiit
Elliptique par intervalles;cardio;;g;machine;i;t;cardioHiit
Tapis de course par intervalles;cardio;;g;tapis;i;t;cardioHiit
Tapis en côte;cardio;fessiers;g;tapis;i;k;cardioSteady
Corde à sauter par intervalles;cardio;mollets;h;corde;i;t;cardioHiit
Corde à sauter alternée;cardio;mollets;h;corde;d;t;cardioSteady
Double unders;cardio;mollets;h;corde;a;t;cardioHiit
Boxe sur sac;cardio;épaules,abdominaux;g;sac de frappe;i;t;cardioHiit
Circuit au poids du corps;cardio,corps entier;;h;;d;t;cardioHiit;Six à huit exercices simples à la suite, 30 à 40 s chacun.
Circuit de cardio sans impact;cardio;;h;;d;t;cardioSteady
Danse cardio;cardio;;h;;d;t;cardioSteady
Zumba;cardio;;h;;d;t;cardioSteady
Tennis;cardio;jambes;h;;d;t;cardioSteady;Activité sportive : saisissez-la dans les activités.
Football;cardio;jambes;h;;d;t;cardioSteady
Basketball;cardio;jambes;h;;d;t;cardioSteady
Badminton;cardio;jambes;h;;d;t;cardioSteady
Natation;cardio;corps entier;g;;d;k;cardioSteady
Aquagym;cardio;corps entier;g;;d;t;cardioSteady
Yoga dynamique;corps entier;;h;;d;t;mob
Pilates au sol;abdominaux;fessiers;h;;d;t;mob
Gymnastique douce;corps entier;;h;;d;t;mob
`;

const SECTIONS: [string, string][] = [["push", PUSH], ["pull", PULL], ["legs", LEGS], ["core", CORE], ["cardio", CARDIO], ["mob", MOB], ["push", FUNC], ["push", MORE_PUSH], ["pull", MORE_PULL], ["legs", MORE_LEGS], ["core", MORE_CORE], ["cardio", MORE_CARDIO]];

export const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const list = (s: string) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : []);

export type CatalogRow = { slug: string; name: string; movement: string; primary: string[]; secondary: string[]; place: "home" | "gym" | "both"; equipment: string[]; level: string; metric: "reps_load" | "time" | "distance"; steps: string; mistakes: string; easier: string | null; alternative: string | null };

export function buildCatalog(): CatalogRow[] {
  const rows: CatalogRow[] = [];
  const seen = new Set<string>();
  for (const [group, text] of SECTIONS) {
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      const [name, prim, sec, place, equip, lvl, met, pat, note] = line.split(";");
      const p = P[pat];
      if (!p) throw new Error(`Modèle inconnu « ${pat} » pour ${name}`);
      const slug = slugify(name);
      if (seen.has(slug)) continue;
      seen.add(slug);
      const movement = pat === "plyo" ? (group === "push" && /pompes/i.test(name) ? "poussée" : "jambes") : PATMOVE[pat] ?? GROUP[group];
      rows.push({
        slug, name, movement, primary: list(prim), secondary: list(sec), place: place === "h" ? "home" : place === "g" ? "gym" : "both",
        equipment: list(equip).map((e) => e.replace(/\//g, "|")), level: LEVEL[lvl], metric: METRIC[met],
        steps: p.steps + (note ? ` ${note}` : ""), mistakes: p.mistakes, easier: p.easier === slug ? null : p.easier, alternative: p.alt === slug ? null : p.alt,
      });
    }
  }
  // Les fiches « Pompes murales », « Tractions négatives »… ont des alternatives plus simples déjà présentes ; on évite l'auto-référence.
  return rows;
}
