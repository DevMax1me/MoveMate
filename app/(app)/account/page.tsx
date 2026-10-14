"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, useApi, fmtShort, localToday, nf } from "@/lib/client";
import { useMe } from "@/components/Shell";
import { Empty, ErrorBox, Field, Loading, Notice, Tabs, toast } from "@/components/ui";
import { goalCoherence, parseNum } from "@/lib/calc";

export default function AccountPage() { return <Suspense><Account /></Suspense>; }

function Account() {
  const welcome = useSearchParams().get("welcome");
  const [tab, setTab] = useState<"profile" | "goals" | "privacy">(welcome ? "profile" : "profile");
  return <div><h1>Mon compte</h1>
    {welcome && <Notice kind="okk">Bienvenue. Renseignez l’essentiel de votre profil ci-dessous, ou passez : vous pouvez utiliser les journaux sans agent ni cible calorique.</Notice>}
    <Tabs tabs={[["profile", "Profil de vie"], ["goals", "Objectifs datés"], ["privacy", "Confidentialité et données"]]} value={tab} onChange={setTab} />
    {tab === "profile" ? <Profile /> : tab === "goals" ? <Goals /> : <Privacy />}</div>;
}

const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
function Profile() {
  const me = useMe();
  const { data, error, reload } = useApi<any>("/lifestyle");
  const [f, setF] = useState<any>(null), [err, setErr] = useState<string | null>(null), [name, setName] = useState(me.name ?? ""), [tz, setTz] = useState(me.tz);
  useEffect(() => { if (data) { const d = data.current?.data ?? {}; setF({ goal: d.goal ?? "", level: d.level ?? "", equipment: d.equipment ?? [], gym: !!d.gym, sessions_per_week: d.sessions_per_week ?? "", max_session_min: d.max_session_min ?? "", schedule: d.schedule ?? "", work: d.work ?? "", meal_categories: (d.meals_per_day ?? []).join(", "), excluded_foods: (d.excluded_foods ?? []).join(", "), disliked_foods: (d.disliked_foods ?? []).join(", "), liked_foods: (d.liked_foods ?? []).join(", "), diet: d.diet ?? "", eating_out: d.eating_out ?? "", budget: d.budget ?? "", cook_time_max_min: d.cook_time_max_min ?? "", people: d.people ?? "", allergies: (d.allergies ?? []).join(", "), temp_mode: d.temp_mode ?? "", coaching: { style: d.coaching?.style ?? "", review_frequency: d.coaching?.review_frequency ?? "", detail: d.coaching?.detail ?? "", silent: !!d.coaching?.silent } }); } }, [data]);
  if (error) return <ErrorBox error={error} retry={reload} />;
  if (!f) return <Loading />;
  const s = (k: string, v: any) => setF({ ...f, [k]: v });
  async function save() {
    setErr(null);
    try {
      await api("/me", { method: "PUT", body: { name, tz } });
      await api("/lifestyle", { body: { data: { ...f, sessions_per_week: parseNum(f.sessions_per_week), max_session_min: parseNum(f.max_session_min), cook_time_max_min: parseNum(f.cook_time_max_min), people: parseNum(f.people), meal_categories: list(f.meal_categories), excluded_foods: list(f.excluded_foods), disliked_foods: list(f.disliked_foods), liked_foods: list(f.liked_foods), allergies: list(f.allergies) } } });
      toast("Profil enregistré (nouvelle version datée)"); reload();
    } catch (e: any) { setErr(e.message); }
  }
  const tag = (t: string) => <span className={`badge ${t === "obligatoire" ? "acc" : ""}`}>{t}</span>;
  return <div className="stack">
    {err && <Notice kind="err">{err}</Notice>}
    <div className="card"><h2 style={{ margin: 0 }}>Identité {tag("facultatif")}</h2>
      <div className="inline"><Field label="Prénom ou pseudo"><input value={name} onChange={(e) => setName(e.target.value)} /></Field><Field label="Fuseau horaire"><input value={tz} onChange={(e) => setTz(e.target.value)} /></Field></div>
      <p className="small muted">Les dates de repas et de pesée sont des dates locales. Si vous changez de fuseau, chaque entrée reste associée à la date locale choisie.</p></div>
    <div className="card"><h2 style={{ margin: 0 }}>L’essentiel {tag("utile à l’agent")}</h2>
      <p className="small muted">Utilisé pour personnaliser les propositions. Sans réponse, l’agent pose une question ciblée : il n’invente pas votre profil.</p>
      <div className="inline"><Field label="Objectif / priorité"><select value={f.goal} onChange={(e) => s("goal", e.target.value)}><option value="">—</option>{["perte de poids", "maintien", "progression sportive", "habitudes plus régulières"].map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Niveau sportif"><select value={f.level} onChange={(e) => s("level", e.target.value)}><option value="">—</option><option>débutant</option><option>intermédiaire</option><option>avancé</option></select></Field></div>
      <h3>Matériel disponible</h3>
      <div className="row">{data.equipmentOptions.map((e: string) => <label className="chk" key={e}><input type="checkbox" checked={f.equipment.includes(e)} onChange={(x) => s("equipment", x.target.checked ? [...f.equipment, e] : f.equipment.filter((y: string) => y !== e))} />{e}</label>)}<label className="chk"><input type="checkbox" checked={f.gym} onChange={(e) => s("gym", e.target.checked)} />accès à une salle (machines)</label></div>
      <div className="inline"><Field label="Séances réalistes par semaine"><input inputMode="numeric" value={f.sessions_per_week} onChange={(e) => s("sessions_per_week", e.target.value)} /></Field><Field label="Durée max d’une séance (min)"><input inputMode="numeric" value={f.max_session_min} onChange={(e) => s("max_session_min", e.target.value)} /></Field></div></div>
    <div className="card"><h2 style={{ margin: 0 }}>Alimentation {tag("facultatif")}</h2>
      <Field label="Exclusions strictes" hint="aliments ou groupes : porc, gluten, lactose, poisson… (jamais contournées)"><input value={f.excluded_foods} onChange={(e) => s("excluded_foods", e.target.value)} /></Field>
      <div className="inline"><Field label="Aliments que vous appréciez"><input value={f.liked_foods} onChange={(e) => s("liked_foods", e.target.value)} /></Field><Field label="Aliments que vous évitez (souhait)"><input value={f.disliked_foods} onChange={(e) => s("disliked_foods", e.target.value)} /></Field></div>
      <Field label="Catégories de repas habituelles" hint="séparées par des virgules : petit-déjeuner, déjeuner…"><input value={f.meal_categories} onChange={(e) => s("meal_categories", e.target.value)} /></Field>
      <div className="inline"><Field label="Budget indicatif"><select value={f.budget} onChange={(e) => s("budget", e.target.value)}><option value="">—</option><option>serré</option><option>moyen</option><option>souple</option></select></Field><Field label="Temps de préparation max (min)"><input inputMode="numeric" value={f.cook_time_max_min} onChange={(e) => s("cook_time_max_min", e.target.value)} /></Field><Field label="Convives"><input inputMode="numeric" value={f.people} onChange={(e) => s("people", e.target.value)} /></Field></div>
      <Field label="Allergies / intolérances" hint="information sensible facultative : sert à filtrer, sans garantie sur les traces ni la composition réelle — vérifiez l’étiquette"><input value={f.allergies} onChange={(e) => s("allergies", e.target.value)} /></Field></div>
    <div className="card"><h2 style={{ margin: 0 }}>Organisation du quotidien {tag("facultatif")}</h2>
      <div className="inline"><Field label="Horaires"><select value={f.schedule} onChange={(e) => s("schedule", e.target.value)}><option value="">—</option><option>réguliers</option><option>décalés</option><option>variables</option></select></Field><Field label="Travail"><select value={f.work} onChange={(e) => s("work", e.target.value)}><option value="">—</option><option>assis</option><option>actif</option></select></Field><Field label="Mode temporaire"><select value={f.temp_mode} onChange={(e) => s("temp_mode", e.target.value)}><option value="">aucun</option><option>déplacement</option><option>vacances</option><option>semaine chargée</option><option>reprise</option></select></Field></div></div>
    <div className="card"><h2 style={{ margin: 0 }}>Accompagnement {tag("facultatif")}</h2>
      <div className="inline"><Field label="Style de langage"><input value={f.coaching.style} onChange={(e) => s("coaching", { ...f.coaching, style: e.target.value })} /></Field><Field label="Fréquence des bilans"><input value={f.coaching.review_frequency} onChange={(e) => s("coaching", { ...f.coaching, review_frequency: e.target.value })} /></Field></div>
      <label className="chk"><input type="checkbox" checked={f.coaching.silent} onChange={(e) => s("coaching", { ...f.coaching, silent: e.target.checked })} />Silence / pause : pas de sollicitation</label></div>
    <button className="primary" onClick={save}>Enregistrer le profil</button>
    {data.history.length > 1 && <p className="small muted">{data.history.length} versions du profil conservées ; la plus récente s’applique dès sa date d’effet.</p>}
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
