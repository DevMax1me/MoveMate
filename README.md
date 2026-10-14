# Terminator — plateforme de suivi alimentaire et sportif

Application web multi-comptes (V1 du *cahier des charges v1.1 du 14 octobre 2026*) : journal alimentaire et calories,
recettes, poids et tendance, catalogue de 40 exercices, routines, séances en direct, activités, carnet de connaissances
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

Identité « carnet d'entraînement » : papier chaud, encre, un seul rouge signal, filets fins à la place des cartes, libellés en monospace, aucune icône emoji. Thème automatique, clair ou sombre (bouton en haut / dans la barre latérale).
Les graphiques (`components/charts.tsx`) sont des SVG maison suivant la méthode dataviz : marques fines, une seule échelle, bulle de survol et lecture au clavier (flèches), légende dès 2 séries, jours incomplets en teinte claire + légende, et un tableau équivalent sous chaque graphique. Palette de données validée par le script de contraste/daltonisme en clair (`#c8321b`, `#2a6aa8`, `#a9740a` sur `#f2efe7`) et en sombre (`#e8573a`, `#4a86cc`, `#bf8718` sur `#14130f`).

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
| 4 NUT | Recherche (perso, favoris, récents, catalogue, Open Food Facts **sur action explicite**, terme seul transmis), copie privée, aliments privés, repas prédéfinis personnalisables, duplication, copie de journée, complétude de journée (non renseignée / partielle / terminée) |
| 5 REC | Recettes privées versionnées, portions, poids final, refus des grammes sans poids final, instantané au journal, recalcul explicite et tracé |
| 6 CAL | CAL 01–08 dans `lib/calc.ts` (inconnu ≠ 0, kJ→kcal, estimation 4P+4G+9L marquée, reste/dépassement, sport hors budget), cohérence des objectifs (seuil 10 %), objectifs datés |
| 7 POI | Pesée de référence par jour, moyenne mobile 7 j (≥ 3 mesures), variation hebdomadaire (2 fenêtres couvertes), objectif personnel, progression bornée avec écart réel, mensurations |
| 8–9 EXO/ROU | 40 fiches (8/8/10/6/5/3), filtres, compatibilité matériel, fiches privées, 3 routines de démonstration séparées, éditeur, planning récurrent, copie figée au démarrage |
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
3. **Contenus** : valeurs nutritionnelles du catalogue générique *indicatives* (marquées « à valider ») et fiches d'exercices à faire **relire par une personne compétente** ; aucun média n'est livré (droits non établis). Licence ODbL/DbCL à valider pour tout catalogue dérivé d'Open Food Facts.
4. **Fournisseur IA** : sans `ANTHROPIC_API_KEY` l'agent fonctionne en règles. Choix du fournisseur, conditions contractuelles, plafond de coût global et la grille d'évaluation à deux évaluateurs (≥ 90 % de pertinence) restent à conduire ; `npm test` couvre les contraintes strictes.
5. **Maquettes** (§3) et **spécification OpenAPI** : non produites ; l'interface a été construite directement.
6. **Base** : SQLite convient au pilote (20 utilisateurs). Sauvegardes chiffrées, rétention 30 j, test de restauration, supervision, 99,5 % de disponibilité et déploiement conteneurisé sont à mettre en place côté exploitation (rejouer `account_deleted` de la table `audit` après toute restauration).
7. **Hors V1** (extensions §1/§22) : scan de codes-barres, hors-ligne complet (le manifeste PWA seul ne promet **pas** de fonctionnement hors réseau : une série non envoyée reste à l'écran avec « Relancer »), rappels, objets connectés, export PDF.
8. **Accessibilité** : labels, focus visibles, contrastes et rôles ARIA soignés, mais l'audit WCAG 2.2 AA manuel (clavier, lecteur d'écran, T19) reste à faire.
9. **Purge à 24 mois d'inactivité** (avertissement + purge à 30 j) : règle documentée, tâche planifiée non implémentée.

## Arborescence

```
app/            pages (public, (app)/ écrans connectés) et API
components/     Shell, graphiques, saisie de repas, formulaires
lib/            calc, agent, equipment, db, seed, auth, http, provider, api/*
tests/          unitaires, évaluation agent, e2e
scripts/        e2e.sh, seed-demo.mjs
```
