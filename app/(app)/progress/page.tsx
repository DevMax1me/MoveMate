"use client";
import { useState } from "react";
import Link from "next/link";
import { api, useApi, fmtDate, fmtShort, nf } from "@/lib/client";
import { useMe } from "@/components/Shell";
import WeightForm from "@/components/WeightForm";
import { BarChart, Figure, Legend, LineChart, Stat } from "@/components/charts";
import { Empty, ErrorBox, Field, Loading, Tabs, toast } from "@/components/ui";
import { parseNum } from "@/lib/calc";

export default function Progress() {
  const [tab, setTab] = useState<"overview" | "weight" | "exercise">("overview");
  const [range, setRange] = useState("30");
  return <div><h1>Progression</h1>
    <Tabs tabs={[["overview", "Vue d’ensemble"], ["weight", "Poids"], ["exercise", "Exercices"]]} value={tab} onChange={setTab} />
    {tab !== "weight" && <div className="row" style={{ marginBottom: 18 }} role="group" aria-label="Période">{[["7", "7 jours"], ["30", "30 jours"], ["90", "90 jours"]].map(([v, l]) => <button key={v} aria-pressed={range === v} onClick={() => setRange(v)}>{l}</button>)}</div>}
    {tab === "overview" ? <Overview range={range} /> : tab === "weight" ? <Weight /> : <Exercises range={range} />}</div>;
}

const STATE_TXT: Record<string, string> = { terminee: "Journée terminée", partielle: "Journée partielle", non_renseignee: "Non renseignée" };

function Overview({ range }: { range: string }) {
  const s = useApi<any>(`/stats/series?range=${range}`);
  const wk = useApi<any>("/stats/week");
  if (s.error) return <ErrorBox error={s.error} retry={s.reload} />;
  if (!s.data || !wk.data) return <Loading />;
  const d = s.data, w = wk.data, sum = w.summary, busy = s.loading;
  const measured = d.weights.filter((x: any) => x.kg != null);
  const lastAvg = [...d.weights].reverse().find((x: any) => x.avg != null);
  return <div className="stack">
    <section>
      <h2 style={{ marginTop: 0 }}>7 derniers jours · {fmtShort(w.start)} → {fmtShort(w.end)}</h2>
      <div className="stats">
        <Stat label="Journées terminées" value={sum.closedDays} unit="/ 7" sub={`énergie complète : ${sum.kcalCoverage}`} />
        <Stat label="Énergie moyenne" value={sum.kcalAvg == null ? "—" : nf(sum.kcalAvg, 0)} unit="kcal" sub={sum.kcalAvg == null ? "aucune journée complète" : `sur ${sum.kcalDays} journée(s) complète(s)`} />
        <Stat label="Séances et activités" value={w.trainings.total} sub={`${w.trainings.completed} séance(s) · ${nf(w.trainings.activityMinutes, 0)} min d’activité`} />
        <Stat label="Poids, moyenne 7 j" value={w.weight.movingAverage.insufficient ? "—" : nf(w.weight.movingAverage.avg, 1)} unit="kg" sub={w.weight.movingAverage.insufficient ? `données insuffisantes (${w.weight.movingAverage.days}/7 jours)` : `${w.weight.movingAverage.days} jours mesurés`} />
      </div>
      <p className="small muted">{sum.proteinAvg == null ? "Protéines : couverture insuffisante pour une moyenne. " : `Protéines : ${nf(sum.proteinAvg, 0)} g en moyenne (couverture ${sum.proteinCoverage}). `}{w.adherence ? `Assiduité : ${w.adherence.done}/${w.adherence.planned} occurrences prévues. ` : "Aucune séance planifiée : pas de pourcentage d’assiduité. "}Bilan descriptif : il ne prouve aucun lien de cause.</p>
    </section>

    <Figure title="Poids" busy={busy}
      note={measured.length ? `${measured.length} jour(s) de mesure` : undefined}
      legend={measured.length ? <Legend2 /> : undefined}
      table={{ head: ["Date", "Pesée (kg)", "Moyenne 7 j (kg)", "Jours mesurés"], rows: d.weights.filter((x: any) => x.kg != null).map((x: any) => [fmtShort(x.date), nf(x.kg, 1), x.avg == null ? "—" : nf(x.avg, 2), `${x.n}/7`]) }}>
      {measured.length === 0 ? <Empty>Aucune pesée sur la période. Ajoutez-en une depuis l’onglet Poids.</Empty> :
        <LineChart unit=" kg" labels={d.weights.map((x: any) => fmtShort(x.date))} tipTitles={d.weights.map((x: any) => fmtDate(x.date))}
          notes={(i) => (d.weights[i].kg == null ? "Pas de pesée ce jour" : undefined)}
          series={[{ name: "Moyenne 7 j", color: "var(--s1)", values: d.weights.map((x: any) => x.avg), endLabel: true }, { name: "Pesée de référence", color: "var(--s2)", values: d.weights.map((x: any) => x.kg), mode: "dots" }]} />}
      {lastAvg && <p className="small muted" style={{ marginTop: 6 }}>Les jours sans pesée restent vides : rien n’est interpolé. La moyenne exige au moins 3 jours mesurés dans la fenêtre.</p>}
    </Figure>

    <Figure title="Apports quotidiens" busy={busy}
      note="un jour sans saisie n’est pas un jour à 0 kcal"
      table={{ head: ["Date", "État", "Énergie (kcal)", "Cible (kcal)"], rows: d.intake.map((x: any) => [fmtShort(x.date), STATE_TXT[x.state], x.kcal == null ? "—" : nf(x.kcal, 0), x.target == null ? "—" : nf(x.target, 0)]) }}>
      <BarChart unit=" kcal" valueName="Énergie connue" labels={d.intake.map((x: any) => fmtShort(x.date))} tipTitles={d.intake.map((x: any) => fmtDate(x.date))}
        bars={d.intake.map((x: any) => ({ value: x.kcal, partial: x.state !== "terminee", target: x.target, note: x.state === "non_renseignee" ? "Non renseignée" : `${STATE_TXT[x.state]}${x.complete === false && x.state === "terminee" ? " · énergie incomplète" : ""}` }))} />
    </Figure>

    <Figure title="Activité par semaine" busy={busy}
      table={{ head: ["Semaine du", "Séances / activités", "Durée (min)"], rows: d.weeks.map((x: any) => [fmtShort(x.week), x.sessions, nf(x.minutes, 0)]) }}>
      {d.weeks.length === 0 ? <Empty>Aucune séance sur la période.</Empty> :
        <BarChart unit=" min" valueName="Durée" color="var(--s2)" labelLast={false} labels={d.weeks.map((x: any) => fmtShort(x.week))} tipTitles={d.weeks.map((x: any) => `Semaine du ${fmtShort(x.week)}`)}
          bars={d.weeks.map((x: any) => ({ value: x.minutes, note: `${x.sessions} séance(s) ou activité(s)` }))} />}
    </Figure>
  </div>;
}
const Legend2 = () => <Legend items={[{ label: "Moyenne mobile 7 jours", color: "var(--s1)", kind: "line" }, { label: "Pesée de référence", color: "var(--s2)", kind: "dot" }]} />;

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
    {s && <section>
      <div className="stats">
        <Stat label="Dernière mesure" value={s.last ? nf(s.last.kg, 1) : "—"} unit="kg" sub={s.last ? fmtShort(s.last.date) : "aucune pesée"} />
        <Stat label="Moyenne 7 jours" value={s.movingAverage.insufficient ? "—" : nf(s.movingAverage.avg, 1)} unit="kg" sub={s.movingAverage.insufficient ? `insuffisant : ${s.movingAverage.days}/7 jours, 3 minimum` : `${s.movingAverage.days} jours mesurés`} />
        <Stat label="Variation hebdo." value={s.weeklyVariation == null ? "—" : `${s.weeklyVariation > 0 ? "+" : ""}${nf(s.weeklyVariation, 2)}`} unit="kg" sub={s.weeklyVariation == null ? `3 pesées requises dans chaque fenêtre (${s.windows.current.days} puis ${s.windows.previous.days})` : `fenêtres de ${s.windows.current.days} et ${s.windows.previous.days} jours mesurés`} />
      </div>
      {s.progress ? <div style={{ marginTop: 14 }}><div className="row spread"><b>Objectif personnel · {nf(s.progress.target, 1)} kg</b><span className="mono small">{nf(s.progress.pct, 0)} % · écart réel {s.progress.gap > 0 ? "+" : ""}{nf(s.progress.gap, 1)} kg</span></div>
        <div className="bar" role="progressbar" aria-valuenow={Math.round(s.progress.bar)} aria-valuemin={0} aria-valuemax={100} aria-label="Progression vers l’objectif"><i style={{ width: `${s.progress.bar}%` }} /></div>
        <p className="small muted">Départ {nf(s.progress.start, 1)} kg · mesure du {fmtShort(s.progress.asOf)}. La barre est bornée entre 0 et 100 % ; l’écart réel reste affiché.</p></div>
        : <p className="small muted" style={{ marginTop: 10 }}>Aucun objectif de poids actif. <Link href="/account">Définir un objectif</Link> (facultatif) — le maintien est une phase à part entière.</p>}
      <p className="small muted">Descriptif uniquement : pas de date de réussite prédite, pas de conclusion de stagnation. Une fluctuation ponctuelle n’est pas une tendance.</p>
    </section>}
    <section><h2 style={{ marginTop: 0 }}>Ajouter une pesée</h2><WeightForm date={me.today} onSaved={reloadAll} /></section>
    <section><h2 style={{ marginTop: 0 }}>Journal</h2>
      {list.data?.entries.length === 0 && <Empty>Aucune pesée pour l’instant.</Empty>}
      {list.data?.entries.slice(0, 40).map((e: any) => <div className="item" key={e.id}><div className="grow"><b>{nf(e.kg, 2)} kg</b> <span className="small muted">{fmtShort(e.date)}{e.time ? ` ${e.time}` : ""}{e.context ? ` · ${e.context}` : ""}{e.note ? ` · ${e.note}` : ""}</span></div>
        {e.is_ref ? <span className="badge acc">référence</span> : <button onClick={() => act(() => api(`/weights/${e.id}/reference`, { body: {} }), "Référence mise à jour")}>Définir référence</button>}
        <button className="ghost" aria-label="Supprimer la pesée" onClick={() => act(() => api(`/weights/${e.id}`, { method: "DELETE" }), "Supprimée")}>✕</button></div>)}</section>
    <section><h2 style={{ marginTop: 0 }}>Mensurations <span className="muted">· facultatif</span></h2>
      <div className="inline"><Field label="Mesure"><select value={mn} onChange={(e) => setMn(e.target.value)}>{["Tour de taille", "Tour de hanches", "Tour de poitrine", "Tour de cuisse", "Tour de bras"].map((x) => <option key={x}>{x}</option>)}</select></Field><Field label="Valeur (cm)"><input inputMode="decimal" value={mv} onChange={(e) => setMv(e.target.value)} /></Field></div>
      <button disabled={!mv} onClick={async () => { try { await api("/measurements", { body: { date: me.today, name: mn, cm: parseNum(mv) } }); setMv(""); meas.reload(); toast("Mesure enregistrée"); } catch (e: any) { toast(e.message); } }}>Enregistrer</button>
      {meas.data?.entries.slice(0, 12).map((m: any) => <div className="item" key={m.id}><div className="grow">{m.name} : <b>{nf(m.cm)} cm</b> <span className="small muted">{fmtShort(m.date)}</span></div><button className="ghost" aria-label="Supprimer" onClick={async () => { await api(`/measurements/${m.id}`, { method: "DELETE" }); meas.reload(); }}>✕</button></div>)}
      <p className="small muted">Les photos de progression ne sont pas collectées en V1.</p></section>
  </div>;
}

function Exercises({ range }: { range: string }) {
  const ex = useApi<any>("/exercises");
  const [sel, setSel] = useState("");
  const series = useApi<any>(sel ? `/stats/series?range=${range}&exercise=${sel}` : null);
  const rec = useApi<any>("/stats/records");
  return <div className="stack">
    <section><h2 style={{ marginTop: 0 }}>Évolution d’un exercice</h2>
      <Field label="Exercice"><select value={sel} onChange={(e) => setSel(e.target.value)}><option value="">— choisir —</option>{ex.data?.exercises.filter((e: any) => e.metric === "reps_load").map((e: any) => <option key={e.ex_key} value={e.ex_key}>{e.name}</option>)}</select></Field>
      {sel && series.data && (series.data.exercise.length === 0 ? <Empty>Aucune série enregistrée pour cet exercice sur la période.</Empty> : series.data.exercise.map((c: any) => {
        const [eq, conv, kind] = c.context.split("|");
        const ctx = `${kind === "pc" ? "poids du corps" : kind === "as" ? "assisté" : "charge externe"}${eq ? ` · ${eq}` : ""}${conv ? ` · charge ${conv.replace("_", " ")}` : ""}`;
        const name = kind === "ext" ? "Charge max" : "Répétitions max", u = kind === "ext" ? " kg" : "";
        return <Figure key={c.context} title={ctx} note="un point par séance" table={{ head: ["Date", name, "Volume (kg)"], rows: c.points.map((p: any) => [fmtShort(p.date), kind === "ext" ? nf(p.maxLoad, 1) : p.bestReps, nf(p.volume, 0)]) }}>
          <LineChart unit={u} labels={c.points.map((p: any) => fmtShort(p.date))} series={[{ name, color: "var(--s1)", values: c.points.map((p: any) => (kind === "ext" ? p.maxLoad : p.bestReps)), endLabel: true, area: true }, { name: "Séance", color: "var(--s1)", values: c.points.map((p: any) => (kind === "ext" ? p.maxLoad : p.bestReps)), mode: "dots" }]} />
          <p className="small muted" style={{ marginTop: 4 }}>Seules les séries du même appareil et de la même convention de charge sont comparées.</p></Figure>; }))}
    </section>
    <section><h2 style={{ marginTop: 0 }}>Records</h2>
      {rec.data?.records.length === 0 && <Empty>Aucun record pour l’instant. Ils apparaissent avec vos séries de travail validées ; les échauffements sont exclus.</Empty>}
      {rec.data?.records.slice(0, 30).map((r: any) => <div className="item" key={r.key}><div className="grow"><b>{r.exercise}</b> — {r.label}<div className="small muted">{Object.values(r.context).filter(Boolean).join(" · ") || "contexte libre"} · {fmtShort(r.date)}</div></div><b className="mono">{nf(r.value, 1)} {r.unit}</b></div>)}
      <p className="small muted">Aucun record n’est déclaré en comparant deux machines différentes. Une série corrigée ou supprimée recalcule les records.</p></section>
  </div>;
}
