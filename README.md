# Terminator — plateforme de suivi alimentaire et sportif

Application web multi-comptes (V1 du *cahier des charges v1.1 du 14 octobre 2026*) : journal alimentaire et calories,
recettes, poids et tendance, catalogue de plus de 700 exercices avec schémas, routines, séances en direct, activités, carnet de connaissances
et agent personnalisé. Interface en français, pensée pour le téléphone (360 → 1 440 px), mode clair/sombre automatique.

## Démarrage

Prérequis : **Node ≥ 22.13** (la base utilise le module `node:sqlite` intégré, aucune dépendance native).

```bash
npm install
npm run dev            # http://localhost:3000
npm run seed:demo      # (serveur lancé) compte fictif demo@terminator.local + données de démonstration
```

Le **premier compte créé devient administrateur** (amorçage) ; les suivants sont des utilisateurs.

| Commande | Rôle |
|---|---|
| `npm test` | tests unitaires : calculs (§6, §7, §11), catalogue, matériel, **évaluation de l'agent** (≥ 40 profils, ≥ 10 injections) |
| `npm run test:e2e` | recette bout en bout T01–T34 sur serveur réel + base temporaire |
| `npm run typecheck` / `npm run build` | contrôle de types / build de production |
| `npm run check` | typecheck + tests + build |

Variables (voir `.env.example`) : `DATABASE_PATH`, `ANTHROPIC_API_KEY` (optionnel), `AGENT_MODEL`, `AGENT_DAILY_QUOTA`.

## Design et graphiques

Identité chaleureuse et vivante : fond crème, encre aubergine, police Bricolage Grotesque (auto-hébergée via `@fontsource`, aucune requête vers un service tiers), formes organiques légèrement asymétriques, et **une couleur par rubrique** (jaune soleil = Aujourd'hui, tomate = Alimentation, violet = Entraînement, vert = Progression, bleu = Carnet, rose = Agent) qui teinte l'accent, les boutons et l'onglet actif. Barre de navigation flottante sur mobile, mascotte « Termi » (`components/Mascot.tsx`) dans les états vides et les moments clés, thème automatique/clair/sombre.
Les graphiques (`components/charts.tsx`) suivent la méthode dataviz : une seule échelle, bulle de survol et lecture au clavier, légende dès 2 séries, jours incomplets en teinte claire, tableau équivalent sous chaque graphique. Couleurs de données (énergie `--s1`, entraînement `--s2`, poids/forme `--s3`) validées avec le script de contraste/daltonisme, en clair (`#d63d1f #6247e0 #0f8a74` sur `#fff7ec`, toutes paires) et en sombre (`#e5573a #8570ec #17967f` sur `#1d1630`).

## Exercices : retrouver celui qu'on cherche

Le catalogue compte plus de 700 fiches ; l'écran « Exercices » aide à reconnaître le bon mouvement :

1. **Muscle d'abord** : carte anatomique du corps (face et dos, formes lissées) cliquable et pastilles avec le nombre d'exercices disponibles, calculé avec les autres filtres (`facets` de `GET /exercises`). Les exercices dont le muscle choisi est le muscle *principal* passent avant ceux où il n'est que secondaire (badge « muscle secondaire ») ; la musculation passe avant la mobilité, et les exercices faisables avec le matériel du profil avant les autres (`lib/muscles.ts`, `components/BodyMap.tsx`).
2. **Schéma du mouvement** : chaque fiche porte une vignette « départ → fin » ; la fiche détaillée l'anime (pause, boutons Départ / Fin, animation désactivée si l'appareil demande de réduire les mouvements). Les schémas sont **originaux** : un mannequin aux membres effilés, avec le muscle qui travaille en couleur, dessiné par un petit moteur de poses (`lib/figures.ts` : cinématique + jambes/bras à deux segments, vues de profil et de face, une soixantaine d’archétypes) choisis d'après le type de mouvement (`pattern`) et le nom. Ce sont des figures simplifiées : elles donnent l'idée du mouvement, pas la technique complète. Pour un exercice privé, l'utilisateur choisit le type de mouvement qui y ressemble le plus.
3. **Vidéo** : aucune vidéo tierce n'est livrée. La fiche propose une recherche YouTube et chacun peut **coller son propre lien** (YouTube, Vimeo, fichier `.mp4`/`.webm` en https), privé, exporté et supprimé avec le compte. Le lecteur n'est chargé **qu'après un clic** (YouTube via `youtube-nocookie.com`, Vimeo, ou balise `<video>`) : tant que rien n'est lancé, aucun site tiers n'est contacté. Un hôte inconnu reste un simple lien. Un média public ne peut être publié par l'administration qu'avec auteur, source et licence.
4. **Comprendre sans connaître les noms** : chaque fiche a une explication « En clair » (ce que fait le mouvement, avec quel matériel, quels muscles) et les mots de salle du nom sont expliqués (iso-latéral, prise marteau, Smith machine, hip thrust, roumain…), générés par des règles dans `lib/explain.ts`. Le même sélecteur guidé (muscle → schéma → « C’est quoi ? » → Choisir) sert à ajouter un exercice à une routine ou à une séance, et chaque exercice déjà choisi garde sa vignette, ses muscles et son explication repliable (`components/ExerciseParts.tsx`, `GET /exercise-brief`).
5. **Exercices qui ressemblent** : même zone du corps, même famille de mouvement, matériel compatible d'abord.

## Dire ce que j'ai mangé

« Ajouter un repas » s'ouvre sur **Dire ce que j'ai mangé** : on écrit comme on parle (« 2 œufs au plat, 2 tranches de pain complet, un café, une pomme ») ou on colle l'adresse d'une recette. L'application découpe la phrase, reconnaît chaque aliment, **estime les quantités** et calcule ; chaque ligne reste modifiable, et on ajoute au repas au fur et à mesure.

- **Quantités estimées** (`lib/recipe-amount.ts`, mode « repas ») : pièces (une pomme = 150 g), portions usuelles quand rien n'est dit (« des pâtes » = une assiette), verres, tasses et parts propres à chaque aliment (« un verre de vin » = 125 ml, « une part de pizza » = 120 g, « une pizza » = 350 g), tailles (« une petite pomme », « un grand verre »), « un peu de » = la moitié. Ce qu'on mange est **cuit** : « des pâtes » ou « du riz » désignent les aliments cuits ; dans une recette, c'est l'inverse.
- **Catalogue** : environ 80 plats, viennoiseries, encas et boissons courants (`lib/dishes.ts` : pizza, burger, kebab, croissant, couscous, glace, soda…) s'ajoutent aux aliments de base et aux ingrédients. Valeurs **indicatives**, portions usuelles renseignées.
- **Aliment inconnu** : l'application ne propose jamais un aliment au hasard. Une proposition approchante (« tarte au maroilles » → « tarte ») est marquée « à vérifier ». On peut donner sa propre estimation en calories pour une portion : elle est **mémorisée** comme aliment privé et reconnue (en priorité) la fois suivante. C'est ainsi que la base personnelle grandit au fil des repas.
- **Approximation visible** : les lignes dont la quantité est estimée sont enregistrées avec la mention « ≈ estimé » (journal) et le total du jour indique « dont énergie estimée » ; corriger la quantité à la main retire la mention.
- **Adresse web** : si la phrase contient une adresse, l'application propose l'import de recette (ci-dessous) ; une fois la recette enregistrée, on choisit le nombre de portions mangées.

## Importer une recette depuis une adresse web

Colle d'une adresse dans « Dire ce que j'ai mangé », ou Alimentation → Recettes → **Importer depuis une adresse web**. L'utilisateur colle une adresse ; le serveur télécharge la page **une seule fois**, lit la recette, rapproche chaque ingrédient d'un aliment, convertit les quantités et calcule calories et macros. Rien n'est enregistré avant la validation d'un aperçu où chaque ligne reste modifiable.

- **Lecture** (`lib/recipe-extract.ts`) : données structurées schema.org de la page (JSON-LD, sinon microdonnées) — titre, portions, durée, ingrédients, étapes, et la nutrition annoncée par le site quand elle existe, comparée au calcul (écart signalé au-delà de 25 %). Vérifié sur des pages réelles (Ricardo, 750g, Marmiton, CuisineAZ, BBC Good Food).
- **Lignes d'ingrédients** (`lib/recipe-parse.ts`) : « 500g de fraises », « 1 boîte(s) Pois chiches », « 3 c. à soupe d'huile », « 1½ tasse », « 2 à 3 », « 2 x 400 g », « 227 g (8 oz) de… », fractions, nombres en lettres, anglais courant.
- **Rapprochement et conversion** (`lib/recipe-match.ts`, `lib/recipe-amount.ts`) : synonymes (« oeufs entiers », « blanc de poulet », « crème fraîche »…), **cru préféré au cuit** sauf mention contraire (les recettes listent des quantités crues), aliments à soi prioritaires, poids moyens des pièces (oignon, œuf, gousse d'ail…), conditionnements (boîte de tomates 400 g), cuillères avec densité (une cuillère de miel ≠ de farine). Une quantité inconnue reste « à préciser » : jamais zéro silencieux. Sel, poivre, épices et eau sans quantité sont indiqués comme négligeables.
- **Catalogue** : environ 165 ingrédients courants (crus, pour les recettes) s'ajoutent aux aliments de base (`lib/ingredients.ts`), valeurs **indicatives** à valider, comme le reste du catalogue générique.
- **Droits** : seuls ingrédients, quantités et lien « source » sont repris ; le texte de préparation n'est conservé que si l'utilisateur le demande (usage personnel).
- **Sécurité** (`lib/safe-fetch.ts`) : le serveur ne doit pas servir de relais vers le réseau interne. http(s) seulement, ports standards, pas d'identifiants, adresses privées/locales/réservées refusées (y compris IPv6 enveloppant une IPv4), contrôle **à la connexion** (pas de seconde résolution DNS, donc pas de « DNS rebinding »), redirections suivies une à une et revalidées, taille comptée après décompression, durée et type de contenu bornés, limite de 12 imports par 10 minutes et par compte.
- **Limites** : certains sites refusent la lecture automatique (Marmiton, CuisineAZ, BBC Good Food, AllRecipes… répondent « 403 » à un robot qui s'identifie honnêtement) ; l'onglet **Coller le texte** (liste des ingrédients copiée depuis la page) fonctionne partout. `RECIPE_IMPORT_USER_AGENT` permet de changer l'identifiant envoyé, à n'utiliser que si les conditions du site l'autorisent ; `RECIPE_IMPORT_ALLOW` (hôte:port) sert aux tests.

## Architecture (variante « application intégrée » du §19)

- **Next.js 15 (App Router) + TypeScript** : interface React et API dans un seul déploiement. Les règles métier sont
  indépendantes du framework (`lib/calc.ts`, `lib/agent.ts`, `lib/equipment.ts` sont du TypeScript pur).
- **SQLite** (WAL, clés étrangères) via `node:sqlite`. Le schéma est dans `lib/db.ts`. Passage à PostgreSQL = remplacer la
  couche `lib/db.ts` (SQL simple, pas d'ORM).
- **API** : un routeur unique `app/api/[...path]/route.ts` → modules `lib/api/*` (compte, nutrition, corps, entraînement,
  stats, carnet, agent, admin). Ressources du §19 : `/me`, `/goals`, `/weights`, `/foods`, `/recipes`, `/meals`, `/exercises`,
  `/routines`, `/planned`, `/workouts`, `/sets`, `/activities`, `/notes`, `/lifestyle`, `/agent/*`, `/exports`.
- **Sécurité** : sessions par cookie `HttpOnly` + `SameSite=Lax` (+ `Secure` en production), contrôle d'origine sur les
  écritures, mots de passe hachés `scrypt`, verrouillage après 5 échecs, révocation des sessions au changement de mot de
  passe, propriétaire **toujours déduit de la session serveur** (jamais d'un identifiant client), en-têtes de sécurité,
  journaux techniques sans valeur métier.
- **Agent** (`lib/agent.ts`, `lib/api/agent.ts`) : moteur de règles déterministe + passerelle fournisseur interchangeable
  (`lib/provider.ts`, optionnelle, ne reformule que du texte déjà calculé et refuse toute reformulation qui altère un
  chiffre). Les brouillons de recette/routine sont **revalidés côté serveur avant affichage et avant application**
  (exclusions strictes, matériel, durée) ; rien n'est écrit sans confirmation ; acceptation idempotente et annulable ;
  mémoire consultable/corrigeable/effaçable ; quotas par compte ; refus médical, inter-comptes et injections.

## Correspondance avec le cahier des charges

| § | Couvert |
|---|---|
| 2–3 | Rôles visiteur/utilisateur/admin, 9 écrans, navigation basse mobile / latérale bureau, cibles tactiles ≥ 44 px, virgule décimale, états vides/erreur/chargement, séance en cours accessible partout |
| 4 NUT | **Repas composés** (une catégorie, plusieurs aliments/recettes ajoutés d'un coup, enregistrement tout-ou-rien), **repas types** réutilisables et repas récents, copie d'un repas complet vers une autre date ou catégorie, alerte sur les quantités inhabituelles. Recherche (perso, favoris, récents, catalogue, Open Food Facts **sur action explicite**, terme seul transmis), copie privée, aliments privés, repas prédéfinis personnalisables, duplication, copie de journée, complétude de journée (non renseignée / partielle / terminée) |
| 5 REC | Recettes privées versionnées, portions, poids final, refus des grammes sans poids final, instantané au journal, recalcul explicite et tracé |
| 6 CAL | CAL 01–08 dans `lib/calc.ts` (inconnu ≠ 0, kJ→kcal, estimation 4P+4G+9L marquée, reste/dépassement, sport hors budget), cohérence des objectifs (seuil 10 %), objectifs datés |
| 7 POI | Pesée de référence par jour, moyenne mobile 7 j (≥ 3 mesures), variation hebdomadaire (2 fenêtres couvertes), objectif personnel, progression bornée avec écart réel, mensurations |
| 8–9 EXO/ROU | **près de 600 fiches** (salle : machines, poulies, Smith, barre, haltères, kettlebell, anneaux… ; maison : poids du corps, chaise, mur, sac à dos, serviette, élastiques…), lot initial de 40 conservé, filtres par muscle/matériel/lieu/niveau, compatibilité matériel, fiches privées, 3 routines de démonstration séparées, éditeur, planning récurrent, copie figée au démarrage |
| 10–11 SEA/ACT/STA | Séance (états, reprise), validation serveur série par série **avec clé d'idempotence**, statut enregistré/en cours/échec, minuteur basé sur une heure de fin, résumé, comparaisons par appareil et convention de charge, volume externe, poids du corps/assisté séparés, records recalculés, assiduité, dépense énergétique séparée |
| 12 CON | Carnet : fiches, statuts, provenance, versions, import prévisualisé, « à revoir » après changement d'objectif, archivage |
| 13 TDB/EXP | Vue du jour, bilan hebdomadaire avec couverture, graphiques SVG (jours incomplets hachurés), export JSON + CSV par domaine (UTF-8 BOM, `;`, protection contre les formules, lien authentifié à usage unique, 24 h) |
| 14–17 | Profil progressif versionné, contraintes strictes vs souples, allergies = filtre sans garantie, ≤ 3 priorités, pas de rattrapage obligatoire, ton factuel, phase « maintien/pause » respectée |
| 18–19 | Modèle de données, identifiants non prévisibles, versions/instantanés, décimaux/null, **détection de modification concurrente** (HTTP 409), OpenAPI à produire (cf. ci-dessous) |
| 21 | Page de confidentialité, activation explicite de l'agent avec ce qui est transmis, rétention conversations 90 j, suppression de compte immédiate et complète, aucun traceur tiers |

## Limites connues et décisions à arbitrer (honnêteté de livraison)

À traiter **avant ouverture publique** — non faits ici :

1. **Vérification de l'adresse e-mail et envoi de courriels** : non branchés (pas de SMTP). Le lien de réinitialisation est journalisé côté serveur uniquement (jamais renvoyé au client).
2. **Volet juridique (§21)** : base légale art. 6/9, AIPD, HDS, registre, sous-traitants et hébergement sont à valider par un interlocuteur qualifié. La page `/confidentialite` est une version de travail.
3. **Contenus** : valeurs nutritionnelles du catalogue générique *indicatives* (marquées « à valider ») et fiches d'exercices à faire **relire par une personne compétente** ; aucun média n'est livré (droits non établis) et les schémas de mouvement sont des figures simplifiées à faire valider par un coach. Licence ODbL/DbCL à valider pour tout catalogue dérivé d'Open Food Facts.
4. **Fournisseur IA** : sans `ANTHROPIC_API_KEY` l'agent fonctionne en règles. Choix du fournisseur, conditions contractuelles, plafond de coût global et la grille d'évaluation à deux évaluateurs (≥ 90 % de pertinence) restent à conduire ; `npm test` couvre les contraintes strictes.
5. **Maquettes** (§3) et **spécification OpenAPI** : non produites ; l'interface a été construite directement.
6. **Base** : SQLite convient au pilote (20 utilisateurs). Sauvegardes chiffrées, rétention 30 j, test de restauration, supervision, 99,5 % de disponibilité et déploiement conteneurisé sont à mettre en place côté exploitation (rejouer `account_deleted` de la table `audit` après toute restauration).
7. **Hors V1** (extensions §1/§22) : scan de codes-barres, hors-ligne complet (le manifeste PWA seul ne promet **pas** de fonctionnement hors réseau : une série non envoyée reste à l'écran avec « Relancer »), rappels, objets connectés, export PDF.
8. **Accessibilité** : labels, focus visibles, contrastes et rôles ARIA soignés, mais l'audit WCAG 2.2 AA manuel (clavier, lecteur d'écran, T19) reste à faire.
9. **Purge à 24 mois d'inactivité** (avertissement + purge à 30 j) : règle documentée, tâche planifiée non implémentée.

## Arborescence

```
app/            pages (public, (app)/ écrans connectés) et API
components/     Shell, graphiques, saisie de repas, import de recette, carte des muscles, schémas de mouvement, formulaires
lib/            calc, agent, equipment, db, seed, auth, http, provider, api/*
tests/          unitaires, évaluation agent, e2e
scripts/        e2e.sh, seed-demo.mjs
```
