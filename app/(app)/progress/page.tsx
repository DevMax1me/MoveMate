"use client";
import { useState } from "react";
import Link from "next/link";
import { api, useApi, fmtShort, nf } from "@/lib/client";
import { useMe } from "@/components/Shell";
import WeightForm from "@/components/WeightForm";
import { BarChart, Empty, ErrorBox, Field, Legend, LineChart, Loading, Notice, Tabs, toast } from "@/components/ui";
import { parseNum } from "@/lib/calc";

export default function Progress() {
  const [tab, setTab] = useState<"overview" | "weight" | "exercise">("overview");
  const [range, setRange] = useState("30");
  return <div><h1>Progression</h1>
    <Tabs tabs={[["overview", "Vue d’ensemble"], ["weight", "Poids et mesures"], ["exercise", "Exercices et records"]]} value={tab} onChange={setTab} />
    {tab !== "weight" && <div className="row" style={{ marginBottom: 8 }}>{[["7", "7 j"], ["30", "30 j"], ["90", "90 j"]].map(([v, l]) => <button key={v} aria-pressed={range === v} className={range === v ? "primary" : ""} onClick={() => setRange(v)}>{l}</button>)}</div>}
    {tab === "overview" ? <Overview range={range} /> : tab === "weight" ? <Weight /> : <Exercises range={range} />}</div>;
}

function Overview({ range }: { range: string }) {
  const s = useApi<any>(`/stats/series?range=${range}`);
  const wk = useApi<any>("/stats/week");
  if (s.error) return <ErrorBox error={s.error} retry={s.reload} />;
  if (!s.data || !wk.data) return <Loading />;
  const d = s.data, w = wk.data, sum = w.summary;
  return <div className="stack">
    <div className="card"><h2 style={{ margin: 0 }}>Bilan hebdomadaire</h2><p className="small muted">7 derniers jours : {fmtShort(w.start)} → {fmtShort(w.end)}</p>
      <div className="grid g3">
        <div><div className="big">{sum.closedDays}<span className="unit">/ 7 journées terminées</span></div></div>
        <div><div className="big">{sum.kcalAvg == null ? "—" : nf(sum.kcalAvg, 0)}<span className="unit">kcal moy.</span></div><div className="small muted">sur {sum.kcalDays} journée(s) complète(s) — couverture {sum.kcalCoverage}</div></div>
        <div><div className="big">{w.trainings.total}<span className="unit">séance(s) / activité(s)</span></div><div className="small muted">{w.trainings.completed} terminée(s){w.trainings.interrupted ? `, ${w.trainings.interrupted} interrompue(s)` : ""} · {nf(w.trainings.activityMinutes, 0)} min d’activité</div></div></div>
      <p className="small">{sum.proteinAvg == null ? "Protéines : couverture insuffisante pour une moyenne." : <>Protéines : {nf(sum.proteinAvg, 0)} g en moyenne (couverture {sum.proteinCoverage}).</>} {w.adherence ? <>Assiduité : {w.adherence.done}/{w.adherence.planned} ({nf(w.adherence.pct, 0)} %).</> : "Aucune séance planifiée : pas de pourcentage d’assiduité."}</p>
      <p className="small muted">Moyenne calculée sur les journées terminées avec énergie complète, jamais divisée par 7 par défaut. Les bilans sont descriptifs : ils ne prouvent pas de cause entre alimentation et poids.</p></div>
    <div className="card"><h2 style={{ margin: 0 }}>Apports quotidiens</h2>
      <BarChart labels={d.intake.map((x: any) => fmtShort(x.date))} values={d.intake.map((x: any) => x.kcal)} partial={d.intake.map((x: any) => x.state !== "terminee")} target={d.intake.map((x: any) => x.target)} unit=" kcal" />
      <Legend items={[{ color: "var(--c1)", label: "journée terminée" }, { color: "var(--c3)", label: "incomplète / partielle (hachurée)" }, { color: "var(--c2)", label: "cible de la date", dashed: true }]} />
      <p className="small muted">Les jours sans saisie ne sont pas des jours à 0 kcal : ils restent vides.</p></div>
    <div className="card"><h2 style={{ margin: 0 }}>Poids mesuré</h2>
      {d.weights.length === 0 ? <Empty>Aucune pesée sur la période. <button onClick={() => (location.href = "/progress")} className="ghost">Ajouter une pesée depuis « Poids et mesures »</button></Empty> : <>
        <LineChart labels={d.weights.map((x: any) => fmtShort(x.date))} unit=" kg" series={[{ name: "Poids", color: "var(--c2)", values: d.weights.map((x: any) => x.kg), points: true }, { name: "Moyenne mobile 7 j", color: "var(--c1)", values: d.weights.map((x: any) => x.avg) }]} />
        <Legend items={[{ color: "var(--c2)", label: "pesée de référence" }, { color: "var(--c1)", label: "moyenne mobile 7 jours (≥ 3 mesures)" }]} />
        <p className="small muted">{d.weights.length} jour(s) de mesure sur la période. Aucun jour absent n’est interpolé.</p></>}</div>
    <div className="card"><h2 style={{ margin: 0 }}>Séances et activité par semaine</h2>
      {d.weeks.length === 0 ? <Empty>Aucune séance sur la période.</Empty> : <><BarChart labels={d.weeks.map((x: any) => fmtShort(x.week))} values={d.weeks.map((x: any) => x.minutes)} unit=" min" height={140} />
        <table><thead><tr><th>Semaine du</th><th>Séances / activités</th><th>Durée</th></tr></thead><tbody>{d.weeks.map((x: any) => <tr key={x.week}><td>{fmtShort(x.week)}</td><td>{x.sessions}</td><td>{nf(x.minutes, 0)} min</td></tr>)}</tbody></table></>}</div>
  </div>;
}

function Weight() {
  const me = useMe();
  const sum = useApi<any>("/weights-summary");
  const list = useApi<any>("/weights");
  const meas = useApi<any>("/measurements");
  const [mn, setMn] = useState("Tour de taille"), [mv, setMv] = useState("");
  const reloadAll = () => { sum.reload(); list.reload(); };
  const s = sum.data;
  async function act(fn: () => Promise<any>, msg: string) { try { await fn(); toast(msg); reloadAll(); } catch (e: any) { toast(e.message); } }
  return <div className="stack">
    {sum.error && <ErrorBox error={sum.error} retry={sum.reload} />}
    {s && <div className="card"><div className="grid g3">
      <div><div className="big">{s.last ? nf(s.last.kg, 2) : "—"}<span className="unit">kg</span></div><div className="small muted">{s.last ? `dernière mesure : ${fmtShort(s.last.date)}` : "aucune pesée"}</div></div>
      <div><div className="big">{s.movingAverage.insufficient ? "—" : nf(s.movingAverage.avg, 2)}<span className="unit">kg moy. 7 j</span></div><div className="small muted">{s.movingAverage.insufficient ? `Données insuffisantes pour la tendance (${s.movingAverage.days}/7 jours, 3 minimum)` : `${s.movingAverage.days} jours mesurés sur 7`}</div></div>
      <div><div className="big">{s.weeklyVariation == null ? "—" : `${s.weeklyVariation > 0 ? "+" : ""}${nf(s.weeklyVariation, 2)}`}<span className="unit">kg / semaine</span></div><div className="small muted">{s.weeklyVariation == null ? `Il faut ≥ 3 pesées dans chacune des deux fenêtres (couverture : ${s.windows.current.days} puis ${s.windows.previous.days} jours)` : `fenêtres de 7 jours : ${s.windows.current.days} et ${s.windows.previous.days} jours mesurés`}</div></div></div>
      {s.progress ? <div style={{ marginTop: 10 }}><div className="row spread"><b>Objectif personnel : {nf(s.progress.target, 1)} kg</b><span>{nf(s.progress.pct, 0)} % — écart réel {s.progress.gap > 0 ? "+" : ""}{nf(s.progress.gap, 1)} kg</span></div><div className="bar" role="progressbar" aria-valuenow={Math.round(s.progress.bar)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${s.progress.bar}%` }} /></div><p className="small muted">Départ {nf(s.progress.start, 1)} kg · mesure du {fmtShort(s.progress.asOf)}. La barre est bornée entre 0 et 100 % ; l’écart réel reste affiché.</p></div> : <p className="small muted">Aucun objectif de poids actif. <Link href="/account">Définir un objectif (facultatif)</Link>. Aucun objectif n’est universel ; le maintien et la progression sans changement de poids sont des phases à part entière.</p>}
      <p className="small muted">Les observations sont descriptives : ni date de réussite prédite, ni conclusion de stagnation. Une fluctuation ponctuelle n’est pas une tendance.</p></div>}
    <div className="card"><h2 style={{ margin: 0 }}>Ajouter une pesée</h2><WeightForm date={me.today} onSaved={reloadAll} /></div>
    <div className="card"><h2 style={{ margin: 0 }}>Journal des pesées</h2>
      {list.data?.entries.length === 0 && <Empty>Aucune pesée. Ajoutez la première ci-dessus.</Empty>}
      {list.data?.entries.slice(0, 40).map((e: any) => <div className="item" key={e.id}><div className="grow"><b>{nf(e.kg, 2)} kg</b> <span className="small muted">{fmtShort(e.date)}{e.time ? ` ${e.time}` : ""}{e.context ? ` · ${e.context}` : ""}{e.note ? ` · ${e.note}` : ""}</span></div>
        {e.is_ref ? <span className="badge acc">référence</span> : <button onClick={() => act(() => api(`/weights/${e.id}/reference`, { body: {} }), "Pesée de référence mise à jour")}>Définir référence</button>}
        <button className="ghost" aria-label="Supprimer la pesée" onClick={() => act(() => api(`/weights/${e.id}`, { method: "DELETE" }), "Supprimée")}>✕</button></div>)}</div>
    <div className="card"><h2 style={{ margin: 0 }}>Mensurations (facultatif)</h2>
      <div className="inline"><Field label="Mesure"><select value={mn} onChange={(e) => setMn(e.target.value)}>{["Tour de taille", "Tour de hanches", "Tour de poitrine", "Tour de cuisse", "Tour de bras"].map((x) => <option key={x}>{x}</option>)}</select></Field><Field label="Valeur (cm)"><input inputMode="decimal" value={mv} onChange={(e) => setMv(e.target.value)} /></Field></div>
      <button disabled={!mv} onClick={async () => { try { await api("/measurements", { body: { date: me.today, name: mn, cm: parseNum(mv) } }); setMv(""); meas.reload(); toast("Mesure enregistrée"); } catch (e: any) { toast(e.message); } }}>Enregistrer</button>
      {meas.data?.entries.slice(0, 12).map((m: any) => <div className="item" key={m.id}><div className="grow">{m.name} : <b>{nf(m.cm)} cm</b> <span className="small muted">{fmtShort(m.date)}</span></div><button className="ghost" aria-label="Supprimer" onClick={async () => { await api(`/measurements/${m.id}`, { method: "DELETE" }); meas.reload(); }}>✕</button></div>)}
      <p className="small muted">Les photos de progression ne sont pas collectées en V1.</p></div>
  </div>;
}

function Exercises({ range }: { range: string }) {
  const ex = useApi<any>("/exercises");
  const [sel, setSel] = useState("");
  const series = useApi<any>(sel ? `/stats/series?range=${range}&exercise=${sel}` : null);
  const rec = useApi<any>("/stats/records");
  return <div className="stack">
    <div className="card"><h2 style={{ margin: 0 }}>Évolution d’un exercice</h2>
      <Field label="Exercice"><select value={sel} onChange={(e) => setSel(e.target.value)}><option value="">— choisir —</option>{ex.data?.exercises.filter((e: any) => e.metric === "reps_load").map((e: any) => <option key={e.ex_key} value={e.ex_key}>{e.name}</option>)}</select></Field>
      {sel && series.data && (series.data.exercise.length === 0 ? <Empty>Aucune série enregistrée pour cet exercice sur la période.</Empty> : series.data.exercise.map((c: any) => {
        const [eq, conv, kind] = c.context.split("|");
        return <div key={c.context}><h3>Contexte : {kind === "pc" ? "poids du corps" : kind === "as" ? "assisté" : "charge externe"}{eq ? ` · ${eq}` : ""}{conv ? ` · charge ${conv.replace("_", " ")}` : ""}</h3>
          <LineChart labels={c.points.map((p: any) => fmtShort(p.date))} unit={kind === "ext" ? " kg" : ""} series={[{ name: kind === "ext" ? "Charge max" : "Répétitions max", color: "var(--c1)", values: c.points.map((p: any) => (kind === "ext" ? p.maxLoad : p.bestReps)), points: true }]} />
          <p className="small muted">Seules les séries du même appareil et de la même convention de charge sont comparées.</p></div>; }))}</div>
    <div className="card"><h2 style={{ margin: 0 }}>Records</h2>
      {rec.data?.records.length === 0 && <Empty>Aucun record pour l’instant. Ils apparaissent avec vos séries de travail validées (les échauffements sont exclus).</Empty>}
      {rec.data?.records.slice(0, 30).map((r: any) => <div className="item" key={r.key}><div className="grow"><b>{r.exercise}</b> — {r.label}<div className="small muted">{Object.values(r.context).filter(Boolean).join(" · ") || "contexte libre"} · {fmtShort(r.date)}</div></div><b>{nf(r.value, 1)} {r.unit}</b></div>)}
      <p className="small muted">Un record n’est jamais déclaré en comparant deux machines différentes. Une série corrigée ou supprimée recalcule les records.</p></div>
  </div>;
}
void Notice;
