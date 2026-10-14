"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, useApi, fmtShort, localToday, nf } from "@/lib/client";
import { useMe } from "@/components/Shell";
import { Empty, ErrorBox, Field, Loading, Notice, Tabs, toast } from "@/components/ui";
import { goalCoherence, parseNum } from "@/lib/calc";
import { Choice, Completeness, HelpField, Section, splitList } from "@/components/ProfileHelp";

export default function AccountPage() { return <Suspense><Account /></Suspense>; }

function Account() {
  const welcome = useSearchParams().get("welcome");
  const [tab, setTab] = useState<"profile" | "goals" | "privacy">(welcome ? "profile" : "profile");
  return <div><h1>Mon compte</h1>
    {welcome && <Notice kind="okk">Bienvenue. Renseignez l’essentiel de votre profil ci-dessous, ou passez : vous pouvez utiliser les journaux sans agent ni cible calorique.</Notice>}
    <Tabs tabs={[["profile", "Profil de vie"], ["goals", "Objectifs datés"], ["privacy", "Confidentialité et données"]]} value={tab} onChange={setTab} />
    {tab === "profile" ? <Profile /> : tab === "goals" ? <Goals /> : <Privacy />}</div>;
}

const list = splitList;
const GOALS: [string, string, string][] = [
  ["perte de poids", "Perdre du poids", "Vous voulez réduire progressivement votre poids. L’agent n’impose aucun rythme : vous fixez vos objectifs datés dans l’onglet « Objectifs »."],
  ["maintien", "Me maintenir", "Vous êtes bien où vous en êtes. Aucune suggestion de déficit, on se concentre sur la régularité et l’énergie."],
  ["progression sportive", "Progresser en sport", "Charges, répétitions, endurance : on suit vos performances, pas seulement le poids."],
  ["habitudes plus régulières", "Des habitudes régulières", "Pas de chiffre à atteindre : on installe d’abord la routine (noter, bouger, dormir) à votre rythme."],
  ["", "Je ne sais pas encore", "Aucun souci : l’agent vous posera une question ciblée quand ce sera utile, il n’invente rien."],
];
const LEVELS: [string, string, string][] = [
  ["débutant", "Débutant", "Moins de 6 mois de pratique régulière, ou une reprise après une longue pause. Les propositions restent simples."],
  ["intermédiaire", "Intermédiaire", "Entre 6 mois et 3 ans de pratique régulière : vous connaissez les mouvements de base."],
  ["avancé", "Avancé", "Plus de 3 ans de pratique : vous gérez vos charges et votre progression."],
  ["", "Je ne sais pas", "Par défaut, l’agent propose des exercices de niveau débutant, plus sûrs."],
];
const EQUIP_HELP: Record<string, string> = { "élastiques": "bandes de résistance", "haltères": "même une seule paire, ajustable ou non", "kettlebell": "bille à poignée", "banc": "plat ou inclinable", "barre": "barre et disques", "rack": "cage ou supports de squat", "smith": "barre guidée (machine Smith)", "poulie": "poulie haute et basse, crossover", "machines": "machines guidées (presse, leg curl, pec deck…)", "barre de traction": "fixe ou de porte", "barres parallèles": "pour les dips", "anneaux": "anneaux de gym ou TRX", "swiss ball": "ballon de gym", "medecine ball": "ballon lesté", "roue abdominale": "ab wheel", "step": "step ou box de saut", "vélo": "d’appartement ou de salle", "rameur": "rameur d’appartement ou de salle", "tapis": "tapis de course", "battle ropes": "cordes ondulatoires", "sac de frappe": "boxe", "traîneau": "sled", "corde": "corde à sauter" };
const SCHEDULES: [string, string, string][] = [["réguliers", "Réguliers", "Les mêmes horaires la plupart des jours : l’agent peut caler repas et séances sur des créneaux fixes."], ["décalés", "Décalés", "Travail de nuit, équipes, horaires atypiques : les repas et créneaux se calent sur votre réveil, pas sur midi/soir."], ["variables", "Variables", "Ça change chaque semaine : l’agent évite de supposer un horaire habituel."], ["", "Je préfère ne pas dire", "Aucun horaire n’est supposé."]];
const BUDGETS: [string, string, string][] = [["serré", "Serré", "Recettes simples et économiques en priorité."], ["moyen", "Moyen", "Un bon équilibre entre coût et variété."], ["souple", "Souple", "Pas de contrainte de prix particulière."], ["", "Non précisé", "Aucun budget supposé."]];

function Profile() {
  const me = useMe();
  const { data, error, reload } = useApi<any>("/lifestyle");
  const [f, setF] = useState<any>(null), [err, setErr] = useState<string | null>(null), [name, setName] = useState(me.name ?? ""), [tz, setTz] = useState(me.tz);
  useEffect(() => { if (data) { const d = data.current?.data ?? {}; setF({ goal: d.goal ?? "", level: d.level ?? "", equipment: d.equipment ?? [], gym: !!d.gym, sessions_per_week: d.sessions_per_week ?? "", max_session_min: d.max_session_min ?? "", schedule: d.schedule ?? "", work: d.work ?? "", meal_categories: (d.meals_per_day ?? []).join(", "), excluded_foods: (d.excluded_foods ?? []).join(", "), disliked_foods: (d.disliked_foods ?? []).join(", "), liked_foods: (d.liked_foods ?? []).join(", "), diet: d.diet ?? "", eating_out: d.eating_out ?? "", budget: d.budget ?? "", cook_time_max_min: d.cook_time_max_min ?? "", people: d.people ?? "", allergies: (d.allergies ?? []).join(", "), temp_mode: d.temp_mode ?? "", coaching: { style: d.coaching?.style ?? "", review_frequency: d.coaching?.review_frequency ?? "", detail: d.coaching?.detail ?? "", silent: !!d.coaching?.silent } }); } }, [data]);
  if (error) return <ErrorBox error={error} retry={reload} />;
  if (!f) return <Loading />;
  const s = (k: string, v: any) => setF({ ...f, [k]: v });
  const essentials: [string, boolean][] = [["votre objectif", !!f.goal], ["votre niveau", !!f.level], ["votre matériel", f.equipment.length > 0 || f.gym], ["vos séances par semaine", f.sessions_per_week !== ""], ["le temps dont vous disposez par séance", f.max_session_min !== ""]];
  const fillExample = () => {
    const ex: Record<string, any> = { goal: "habitudes plus régulières", level: "débutant", equipment: ["haltères", "élastiques"], sessions_per_week: 3, max_session_min: 40, schedule: "décalés", work: "assis", meal_categories: "Petit-déjeuner, Déjeuner, Dîner, Collation", excluded_foods: "porc", liked_foods: "riz, poulet, fruits", disliked_foods: "brocoli", budget: "moyen", cook_time_max_min: 25, people: 2 };
    const empty = (v: any) => v === "" || v == null || (Array.isArray(v) && !v.length);
    setF({ ...f, ...Object.fromEntries(Object.entries(ex).filter(([k]) => empty(f[k]))) });
    toast("Exemple ajouté aux champs vides : modifiez ce qui ne vous correspond pas");
  };
  async function save() {
    setErr(null);
    try {
      await api("/me", { method: "PUT", body: { name, tz } });
      await api("/lifestyle", { body: { data: { ...f, sessions_per_week: parseNum(f.sessions_per_week), max_session_min: parseNum(f.max_session_min), cook_time_max_min: parseNum(f.cook_time_max_min), people: parseNum(f.people), meal_categories: list(f.meal_categories), excluded_foods: list(f.excluded_foods), disliked_foods: list(f.disliked_foods), liked_foods: list(f.liked_foods), allergies: list(f.allergies) } } });
      toast("Profil enregistré (nouvelle version datée)"); reload();
    } catch (e: any) { setErr(e.message); }
  }
  return <div className="stack">
    {err && <Notice kind="err">{err}</Notice>}
    <div>
      <Completeness done={essentials.filter((e) => e[1]).length} total={essentials.length} missing={essentials.filter((e) => !e[1]).map((e) => e[0])} />
      <div className="notice info"><b>Comment ça marche ?</b> Répondez à ce que vous voulez, dans l’ordre que vous voulez. Chaque rubrique explique à quoi elle sert et propose des exemples. Une réponse manquante n’est jamais « devinée » : l’agent vous posera plutôt une question.
        <div style={{ marginTop: 8 }}><button type="button" onClick={fillExample}>Remplir avec un exemple</button> <span className="small muted">ne touche que les champs vides</span></div></div>
    </div>

    <Section n={1} title="Qui êtes-vous ?" tag="facultatif" why="Juste de quoi vous appeler par votre prénom et caler les dates sur votre fuseau.">
      <div className="inline"><HelpField label="Prénom ou pseudo" value={name} onChange={setName} placeholder="Camille" hint="S’affiche dans votre salutation. Vous pouvez mettre un pseudo." /><HelpField label="Fuseau horaire" value={tz} onChange={setTz} placeholder="Europe/Paris" hint="Les repas et pesées sont rangés par date locale. Si vous voyagez, chaque entrée garde la date que vous avez choisie." /></div>
    </Section>

    <Section n={2} title="Votre objectif" tag="essentiel" why="Pas besoin d’un chiffre : choisissez simplement ce qui vous parle le plus aujourd’hui. Vous pourrez en changer à tout moment, et fixer des cibles précises dans l’onglet « Objectifs datés »." uses="adapter le ton des bilans et ne jamais proposer de déficit calorique si vous visez le maintien.">
      <Choice label="Ma priorité en ce moment" value={f.goal} onChange={(v) => s("goal", v)} options={GOALS} />
    </Section>

    <Section n={3} title="Votre pratique sportive" tag="essentiel" why="Ces informations servent à ne vous proposer que des séances réalistes pour vous : faisables avec votre matériel, dans le temps dont vous disposez." uses="construire des routines compatibles avec votre matériel, votre niveau et le temps que vous avez indiqué.">
      <Choice label="Mon niveau" value={f.level} onChange={(v) => s("level", v)} options={LEVELS} />
      <div className="field"><label>Matériel dont je dispose</label>
        <div className="grid g2" style={{ gap: 0 }}>{data.equipmentOptions.map((e: string) => <label className="chk" key={e} style={{ alignItems: "flex-start", padding: ".35rem 0" }}><input type="checkbox" checked={f.equipment.includes(e)} onChange={(x) => s("equipment", x.target.checked ? [...f.equipment, e] : f.equipment.filter((y: string) => y !== e))} /><span>{e}<span className="small muted" style={{ display: "block" }}>{EQUIP_HELP[e]}</span></span></label>)}</div>
        <label className="chk" style={{ alignItems: "flex-start" }}><input type="checkbox" checked={f.gym} onChange={(e) => s("gym", e.target.checked)} /><span>J’ai accès à une salle de sport<span className="small muted" style={{ display: "block" }}>cela débloque les exercices avec barre, rack et machines</span></span></label>
        <p className="small phelp">Aucun matériel ? Ne cochez rien : le catalogue propose de nombreux exercices au poids du corps, avec chaise, mur, sac à dos ou serviette. Une salle donne accès à tout le matériel ci-dessus.</p></div>
      <div className="inline num">
        <HelpField label="Combien de séances par semaine ?" value={String(f.sessions_per_week)} onChange={(v) => s("sessions_per_week", v)} inputMode="numeric" placeholder="3" unit="séances" hint="Un nombre réaliste, pas idéal. 2 régulières valent mieux que 5 abandonnées." example="3" />
        <HelpField label="Combien de temps par séance ?" value={String(f.max_session_min)} onChange={(v) => s("max_session_min", v)} inputMode="numeric" placeholder="40" unit="minutes" hint="Le temps dont vous disposez, échauffement et repos compris. Les routines proposées tiendront dedans." example="40" />
      </div>
    </Section>

    <Section n={4} title="Votre alimentation" tag="facultatif" why="Indiquez ce que vous mangez déjà, ce que vous aimez et ce que vous ne mangez pas. L’idée est de partir de vos habitudes, pas de vous imposer un régime." uses="proposer des recettes et des substitutions acceptables pour vous. Une exclusion est une règle stricte : l’agent ne la contourne jamais, il vous explique le conflit.">
      <HelpField label="Aliments que je ne mange pas (exclusions)" list value={f.excluded_foods} onChange={(v) => s("excluded_foods", v)} placeholder="porc, gluten, crevettes" suggestions={["porc", "viande", "poisson", "œuf", "lactose", "gluten", "fruits à coque", "soja"]}
        hint="Séparez par des virgules, ou cliquez sur une suggestion. Vous pouvez écrire un aliment (« crevettes ») ou un groupe (« gluten », « lactose »)." example="porc, lactose" />
      <div className="inline">
        <HelpField label="Aliments que j’apprécie" list value={f.liked_foods} onChange={(v) => s("liked_foods", v)} placeholder="riz, poulet, fruits" suggestions={["riz", "pâtes", "poulet", "œuf", "légumineuses", "fruits"]} hint="Ils passeront en premier dans les propositions." example="riz, poulet, fruits" />
        <HelpField label="Aliments que j’évite (préférence)" list value={f.disliked_foods} onChange={(v) => s("disliked_foods", v)} placeholder="brocoli, champignons" suggestions={["brocoli", "champignons", "poisson", "abats"]} hint="Différent d’une exclusion : l’agent les évite mais peut en proposer s’il n’a vraiment pas d’autre option." example="brocoli" />
      </div>
      <HelpField label="Mes repas de la journée" list value={f.meal_categories} onChange={(v) => s("meal_categories", v)} placeholder="Petit-déjeuner, Déjeuner, Dîner" suggestions={["Petit-déjeuner", "Déjeuner", "Dîner", "Collation", "Repas de nuit", "Avant l’entraînement"]} hint="Les noms qui vous correspondent. Vous travaillez de nuit ? Mettez « Repas de nuit » : rien ne suppose un repas à midi." example="Petit-déjeuner, Déjeuner, Dîner, Collation" />
      <Choice label="Mon budget courses" value={f.budget} onChange={(v) => s("budget", v)} options={BUDGETS} />
      <div className="inline num">
        <HelpField label="Combien de temps pour cuisiner ?" value={String(f.cook_time_max_min)} onChange={(v) => s("cook_time_max_min", v)} inputMode="numeric" placeholder="25" unit="minutes" hint="Par repas. Les recettes proposées seront prêtes dans ce délai." example="25" />
        <HelpField label="Pour combien de personnes ?" value={String(f.people)} onChange={(v) => s("people", v)} inputMode="numeric" placeholder="2" unit="personnes" hint="Les quantités des recettes proposées sont calculées pour ce nombre." example="2" />
      </div>
      <HelpField label="Allergies ou intolérances (information sensible)" list value={f.allergies} onChange={(v) => s("allergies", v)} placeholder="arachide" suggestions={["arachide", "fruits à coque", "lait", "œuf", "gluten", "soja", "crustacés"]}
        hint="Facultatif. Sert uniquement à filtrer les suggestions. Aucune garantie sur les traces ou la composition réelle d’un produit : vérifiez toujours l’étiquette. N’indiquez rien d’autre de médical." />
    </Section>

    <Section n={5} title="Votre quotidien" tag="facultatif" why="Pour que les créneaux de repas et de séances tombent au bon moment, sans supposer que vous vivez au rythme « 9h-17h »." uses="proposer des créneaux de séance et de repas qui collent à votre journée.">
      <Choice label="Mes horaires" value={f.schedule} onChange={(v) => s("schedule", v)} options={SCHEDULES} />
      <Choice label="Mon travail" value={f.work} onChange={(v) => s("work", v)} options={[["assis", "Plutôt assis", "Beaucoup de temps assis : l’agent peut suggérer de petites pauses actives."], ["actif", "Plutôt actif", "Vous bougez déjà beaucoup dans la journée."], ["", "Non précisé", "Rien n’est supposé."]]} />
      <Choice label="Une période particulière en ce moment ?" value={f.temp_mode} onChange={(v) => s("temp_mode", v)} options={[["", "Non, rien de spécial", "Votre rythme habituel s’applique."], ["déplacement", "En déplacement", "Mode temporaire : propositions plus légères, sans matériel."], ["vacances", "En vacances", "Mode temporaire : pas de pression, le suivi reste libre."], ["semaine chargée", "Semaine chargée", "Mode temporaire : on réduit les priorités au minimum."], ["reprise", "Reprise", "Mode temporaire : on repart doucement."]]} />
      <p className="small phelp">Un mode temporaire ne redéfinit pas votre mode de vie : vous pouvez le retirer quand c’est fini.</p>
    </Section>

    <Section n={6} title="Comment vous accompagner" tag="facultatif" why="Votre façon préférée de recevoir l’aide de l’agent. Il ne vous juge pas, ne culpabilise pas, et vous pouvez demander le silence à tout moment." uses="adapter le ton, la fréquence des bilans et le niveau de détail.">
      <HelpField label="Style de langage souhaité" value={f.coaching.style} onChange={(v) => s("coaching", { ...f.coaching, style: v })} placeholder="direct et concis" hint="En quelques mots. Ce champ sert de repère de ton." example="direct et concis, sans jargon" />
      <HelpField label="Fréquence des bilans" value={f.coaching.review_frequency} onChange={(v) => s("coaching", { ...f.coaching, review_frequency: v })} placeholder="une fois par semaine, le dimanche" hint="Quand vous voulez faire le point. Un bilan reste toujours descriptif." example="une fois par semaine, le dimanche" />
      <label className="chk"><input type="checkbox" checked={f.coaching.silent} onChange={(e) => s("coaching", { ...f.coaching, silent: e.target.checked })} />Silence : ne pas me solliciter pour l’instant</label>
    </Section>

    <div className="savebar"><span className="small muted">{data.history.length > 1 ? `${data.history.length} versions conservées. ` : ""}Vos réponses ne sont enregistrées qu’en validant ici.</span><button className="primary" onClick={save}>Enregistrer mon profil</button></div>
  </div>;
}

function Goals() {
  const me = useMe();
  const { data, error, reload } = useApi<any>("/goals");
  const [f, setF] = useState<any>({ phase: "maintien", start_date: me.today, kcal: "", protein: "", carbs: "", fat: "", weight_target: "", start_weight: "" }), [err, setErr] = useState<string | null>(null), [warn, setWarn] = useState<string | null>(null);
  const s = (k: string, v: string) => setF({ ...f, [k]: v });
  const coh = goalCoherence({ kcal: parseNum(f.kcal), protein: parseNum(f.protein), carbs: parseNum(f.carbs), fat: parseNum(f.fat) });
  return <div className="stack">
    <p className="muted small">Chaque objectif a une date d’effet. Un changement ultérieur ne réécrit pas l’historique : les jours passés restent comparés à leurs cibles d’origine. Vous pouvez aussi n’en fixer aucune, ralentir, maintenir ou faire une pause.</p>
    <div className="card"><h2 style={{ margin: 0 }}>Nouvel objectif</h2>
      {err && <Notice kind="err">{err}</Notice>}{warn && <Notice>{warn}</Notice>}
      <div className="inline"><Field label="Phase"><select value={f.phase} onChange={(e) => s("phase", e.target.value)}>{[["perte", "Perte de poids"], ["maintien", "Maintien"], ["progression", "Progression sportive"], ["habitudes", "Habitudes régulières"], ["pause", "Pause"]].map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field><Field label="Date d’effet"><input type="date" value={f.start_date} onChange={(e) => s("start_date", e.target.value)} /></Field></div>
      <div className="inline"><Field label="Cible calorique (kcal)" hint="facultatif"><input inputMode="numeric" value={f.kcal} onChange={(e) => s("kcal", e.target.value)} /></Field><Field label="Protéines (g)"><input inputMode="numeric" value={f.protein} onChange={(e) => s("protein", e.target.value)} /></Field><Field label="Glucides (g)"><input inputMode="numeric" value={f.carbs} onChange={(e) => s("carbs", e.target.value)} /></Field><Field label="Lipides (g)"><input inputMode="numeric" value={f.fat} onChange={(e) => s("fat", e.target.value)} /></Field></div>
      {coh && <p className={`small ${coh.warning ? "" : "muted"}`}>Équivalent indicatif 4P+4G+9L : <b>{nf(coh.equivalent, 0)} kcal</b>{coh.warning ? <> — <span className="badge warn">écart de {nf(coh.gap * 100, 0)} % avec la cible</span> (ne bloque pas : l’énergie d’étiquetage et la formule simplifiée peuvent différer)</> : ""}</p>}
      <div className="inline"><Field label="Poids de départ (kg)" hint="facultatif"><input inputMode="decimal" value={f.start_weight} onChange={(e) => s("start_weight", e.target.value)} /></Field><Field label="Poids cible (kg)" hint="facultatif"><input inputMode="decimal" value={f.weight_target} onChange={(e) => s("weight_target", e.target.value)} /></Field></div>
      <button className="primary" onClick={async () => { setErr(null); setWarn(null); try { const r = await api("/goals", { body: { ...f, kcal: parseNum(f.kcal), protein: parseNum(f.protein), carbs: parseNum(f.carbs), fat: parseNum(f.fat), weight_target: parseNum(f.weight_target), start_weight: parseNum(f.start_weight) } }); if (r.coherence?.warning) setWarn("Objectif enregistré. Attention : les macros et la cible énergétique diffèrent de plus de 10 %."); toast("Objectif enregistré"); reload(); } catch (e: any) { setErr(e.message); } }}>Enregistrer l’objectif</button></div>
    {error && <ErrorBox error={error} retry={reload} />}
    <div className="card"><h2 style={{ margin: 0 }}>Historique des objectifs</h2>
      {data?.goals.length === 0 && <Empty>Aucun objectif. Les apports s’affichent sans « reste » : c’est un choix valable.</Empty>}
      {data?.goals.map((g: any) => <div className="item" key={g.id}><div className="grow"><b>{{ perte: "Perte de poids", maintien: "Maintien", progression: "Progression", habitudes: "Habitudes", pause: "Pause" }[g.phase as string]}</b> <span className="small muted">du {fmtShort(g.start_date)} {g.end_date ? `au ${fmtShort(g.end_date)}` : "→ en cours"}</span>
        <div className="small muted">{g.kcal ? `${nf(g.kcal, 0)} kcal` : "pas de cible calorique"}{g.protein ? ` · P ${nf(g.protein, 0)}` : ""}{g.weight_target ? ` · poids cible ${nf(g.weight_target, 1)} kg` : ""}</div></div>
        <button className="ghost" aria-label="Supprimer cet objectif" onClick={async () => { if (confirm("Supprimer cette version d’objectif ?")) { await api(`/goals/${g.id}`, { method: "DELETE" }); reload(); } }}>✕</button></div>)}</div>
  </div>;
}

function Privacy() {
  const me = useMe();
  const router = useRouter();
  const sup = useApi<any>("/me/support");
  const [pw, setPw] = useState({ current: "", next: "" }), [del, setDel] = useState(""), [err, setErr] = useState<string | null>(null), [dom, setDom] = useState("weights");
  async function dl(body: any) { try { const r = await api("/exports", { body }); window.location.href = r.url; toast("Téléchargement lancé (lien à usage unique, valable 24 h)"); } catch (e: any) { setErr(e.message); } }
  return <div className="stack">
    {err && <Notice kind="err">{err}</Notice>}
    <div className="card"><h2 style={{ margin: 0 }}>Exporter mes données</h2>
      <p className="small muted">Vos pesées, repas (valeurs figées), objectifs, routines, séances, séries, activités, notes privées, mémoire de l’agent. Dates locales, unités indiquées. Les catalogues publics ne sont pas redistribués.</p>
      <div className="row"><button className="primary" onClick={() => dl({ format: "json" })}>Tout exporter (JSON)</button>
        <select style={{ width: "auto" }} aria-label="Domaine CSV" value={dom} onChange={(e) => setDom(e.target.value)}>{["weights", "meals", "goals", "workouts", "sets", "activities", "notes", "routines", "recipes", "measurements"].map((d) => <option key={d}>{d}</option>)}</select><button onClick={() => dl({ format: "csv", domain: dom })}>CSV du domaine</button></div>
      <p className="small muted">CSV en UTF-8, séparateur « ; », cellules protégées contre l’exécution de formules.</p></div>
    <div className="card"><h2 style={{ margin: 0 }}>Mot de passe et sessions</h2>
      <div className="inline"><Field label="Mot de passe actuel"><input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field><Field label="Nouveau (10 caractères min.)"><input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field></div>
      <div className="row"><button onClick={async () => { try { await api("/me/password", { body: { current: pw.current, password: pw.next } }); toast("Mot de passe changé : sessions révoquées"); router.replace("/login"); } catch (e: any) { setErr(e.message); } }}>Changer le mot de passe</button>
        <button onClick={async () => { await api("/me/sessions/revoke", { body: {} }); router.replace("/login"); }}>Déconnecter tous les appareils</button>
        <button onClick={async () => { await api("/auth/logout", { body: {} }); router.replace("/login"); }}>Se déconnecter</button></div></div>
    {sup.data?.requests.length > 0 && <div className="card"><h2 style={{ margin: 0 }}>Demandes d’accès support</h2><p className="small muted">Un administrateur ne peut pas consulter votre journal. Un accès exceptionnel exige un motif, votre autorisation, une durée limitée et laisse une trace ; il n’expose que des informations techniques.</p>
      {sup.data.requests.map((r: any) => <div className="item" key={r.id}><div className="grow">{r.reason}<div className="small muted">{r.authorized_by_user ? `autorisé jusqu’à ${new Date(r.expires).toLocaleString("fr-FR")}` : "en attente de votre décision"}</div></div>{!r.authorized_by_user && <button onClick={async () => { await api(`/me/support/${r.id}/authorize`, { body: { minutes: 30 } }); sup.reload(); }}>Autoriser 30 min</button>}</div>)}</div>}
    <div className="card"><h2 style={{ margin: 0 }}>Supprimer mon compte</h2>
      <p className="small">L’accès est bloqué immédiatement et toutes vos données privées (journaux, séances, notes, mémoire de l’agent, conversations) sont purgées. Cette action est irréversible. Pensez à exporter vos données avant.</p>
      <Field label="Confirmez avec votre mot de passe"><input type="password" value={del} onChange={(e) => setDel(e.target.value)} autoComplete="current-password" /></Field>
      <button className="danger" disabled={!del} onClick={async () => { if (!confirm(`Supprimer définitivement le compte ${me.email} ?`)) return; try { await api("/me/delete", { body: { password: del } }); router.replace("/"); } catch (e: any) { setErr(e.message); } }}>Supprimer définitivement mon compte</button></div>
  </div>;
}
void localToday;
