"use client";
import { useEffect, useRef, useState } from "react";
import { api, useApi, fmtDate, fmtShort, nf, shiftDate, uuid, ApiFail } from "@/lib/client";
import { useMe } from "@/components/Shell";
import { ErrorBox, Empty, Field, Loading, Modal, Notice, Tabs, toast } from "@/components/ui";
import { parseNum } from "@/lib/calc";

export default function Training() {
  const [tab, setTab] = useState<"session" | "routines" | "planning" | "history">("session");
  return <div><h1>Entraînement</h1><Tabs tabs={[["session", "Séance"], ["routines", "Routines"], ["planning", "Planning"], ["history", "Historique"]]} value={tab} onChange={setTab} />
    {tab === "session" ? <Session /> : tab === "routines" ? <Routines /> : tab === "planning" ? <Planning /> : <History />}</div>;
}

// ---------------- Séance active ----------------
type Row = { key: string; idem: string; status: "draft" | "saving" | "saved" | "failed"; reps: string; load: string; secs: string; distance: string; rpe: string; kind: "work" | "warmup"; bodyweight: boolean; assisted: boolean; confirmed_default: boolean; error?: string; id?: string };

function Session() {
  const { data, error, loading, reload } = useApi<any>("/workouts/active");
  const routines = useApi<any>("/routines");
  const today = useApi<any>("/stats/today");
  const [starting, setStarting] = useState(false);
  const router = null as never | null; void router;
  async function start(body: any) {
    setStarting(true);
    try { await api("/workouts/start", { body: { ...body, idem: uuid() } }); await reload(); } catch (e: any) { toast(e.message); reload(); } finally { setStarting(false); }
  }
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  if (data?.workout) return <Active w={data.workout} reload={reload} />;
  return <div className="stack">
    {today.data?.planned?.length > 0 && <div className="card"><h2 style={{ margin: 0 }}>Prévue aujourd’hui</h2>{today.data.planned.map((p: any) => <div className="item" key={p.id}><div className="grow"><b>{p.routine_name}</b></div><button className="primary" disabled={starting} onClick={() => start({ routine_key: p.routine_key, planned_id: p.id })}>Démarrer</button></div>)}</div>}
    <div className="card"><h2 style={{ margin: 0 }}>Démarrer une routine</h2>
      {routines.data?.routines.length === 0 && <p className="muted">Vous n’avez pas encore de routine personnelle. Dupliquez un modèle de démonstration ou créez la vôtre depuis l’onglet Routines.</p>}
      {routines.data?.routines.map((r: any) => <div className="item" key={r.id}><div className="grow"><b>{r.name}</b><div className="small muted">{r.items.length} exercices · {r.place === "gym" ? "salle" : "maison"}</div></div><button className="primary" disabled={starting} onClick={() => start({ routine_key: r.routine_key })}>Démarrer</button></div>)}
    </div>
    <div className="card"><h2 style={{ margin: 0 }}>Séance libre</h2><p className="muted">Sans routine : ajoutez les exercices au fil de la séance.</p><button disabled={starting} onClick={() => start({})}>Démarrer une séance libre</button></div>
  </div>;
}

function Active({ w, reload }: { w: any; reload: () => void }) {
  const [rows, setRows] = useState<Record<string, Row[]>>(() => build(w));
  const [extra, setExtra] = useState<{ slug: string; name: string; metric: string }[]>([]);
  const [picker, setPicker] = useState(false), [summary, setSummary] = useState<any | null>(null), [confirmEnd, setConfirmEnd] = useState(false);
  const [rest, setRest] = useState<number>(w.rest_until ?? 0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const left = Math.max(0, Math.ceil((rest - now) / 1000));
  const fromSets = w.sets.filter((s: any) => !w.snapshot.items.some((i: any) => i.slug === s.ex_key)).map((s: any) => ({ slug: s.ex_key, name: s.exercise_name, metric: s.metric, sets: 0, rest: 60 }));
  const items = [...w.snapshot.items, ...[...fromSets, ...extra].filter((e, i, a) => !w.snapshot.items.some((x: any) => x.slug === e.slug) && a.findIndex((y) => y.slug === e.slug) === i)];
  const equipCtx = useRef<Record<string, string>>({});
  const conv = useRef<Record<string, string>>({});

  function build(wk: any): Record<string, Row[]> {
    const out: Record<string, Row[]> = {};
    for (const s of wk.sets) (out[s.ex_key] ??= []).push({ key: s.id, idem: s.idem ?? s.id, status: "saved", id: s.id, reps: s.reps?.toString() ?? "", load: s.load?.toString() ?? "", secs: s.secs?.toString() ?? "", distance: s.distance?.toString() ?? "", rpe: s.rpe?.toString() ?? "", kind: s.kind, bodyweight: !!s.bodyweight, assisted: !!s.assisted, confirmed_default: !!s.confirmed_default });
    return out;
  }
  const blank = (it: any, kind: "work" | "warmup" = "work"): Row => ({ key: uuid(), idem: uuid(), status: "draft", reps: "", load: it.load != null ? String(it.load) : "", secs: it.duration_s ? String(it.duration_s) : "", distance: it.distance_km ? String(it.distance_km) : "", rpe: "", kind, bodyweight: false, assisted: false, confirmed_default: false });
  const patch = (slug: string, key: string, p: Partial<Row>) => setRows((r) => ({ ...r, [slug]: (r[slug] ?? []).map((x) => (x.key === key ? { ...x, ...p } : x)) }));

  async function validate(it: any, row: Row, asPlanned = false) {
    const reps = asPlanned && !row.reps ? parseNum(String(it.reps).split("-")[0]) : parseNum(row.reps);
    patch(it.slug, row.key, { status: "saving", error: undefined });
    try {
      const r = await api(`/workouts/${w.id}/sets`, { body: { idem: row.idem, exercise_key: it.slug, kind: row.kind, reps, load: parseNum(row.load), secs: parseNum(row.secs), distance: parseNum(row.distance), rpe: parseNum(row.rpe), bodyweight: row.bodyweight, assisted: row.assisted, confirmed_default: asPlanned, equipment_ctx: equipCtx.current[it.slug], load_conv: conv.current[it.slug] ?? "", rest_s: row.kind === "work" ? it.rest : 0 } });
      patch(it.slug, row.key, { status: "saved", id: r.set.id, reps: r.set.reps?.toString() ?? row.reps, confirmed_default: asPlanned });
      if (r.rest_until) setRest(r.rest_until);
    } catch (e: any) { patch(it.slug, row.key, { status: "failed", error: e instanceof ApiFail ? e.message : "Échec réseau : la série n'est pas enregistrée. Relancez." }); }
  }
  async function removeSet(slug: string, row: Row) {
    if (row.id) { try { await api(`/sets/${row.id}`, { method: "DELETE" }); } catch (e: any) { return toast(e.message); } }
    setRows((r) => ({ ...r, [slug]: (r[slug] ?? []).filter((x) => x.key !== row.key) }));
  }
  async function finish(state: "terminee" | "interrompue") {
    const unsaved = Object.values(rows).flat().filter((r) => r.status === "saving" || r.status === "failed").length;
    if (unsaved && !confirm(`${unsaved} série(s) non enregistrée(s) seront perdues. Continuer ?`)) return;
    try { setSummary(await api(`/workouts/${w.id}/finish`, { body: { state } })); } catch (e: any) { toast(e.message); }
  }
  async function stopRest() { setRest(0); await api(`/workouts/${w.id}/rest`, { body: { stop: true } }).catch(() => {}); }
  async function addRest() { const t = Math.max(rest, Date.now()) + 30000; setRest(t); await api(`/workouts/${w.id}/rest`, { body: { seconds: Math.ceil((t - Date.now()) / 1000) } }).catch(() => {}); }

  if (summary) return <Summary s={summary} onClose={reload} />;
  return <div className="stack">
    <div className="card"><div className="row spread"><div><h2 style={{ margin: 0 }}>{w.name}</h2><p className="small muted">Démarrée le {fmtDate(w.date)} · {w.place === "gym" ? "salle" : "maison"}{w.snapshot.routine_key ? " · routine figée au démarrage" : " · séance libre"}</p></div>
      <div className="row"><button onClick={() => finish("interrompue")}>Interrompre</button><button className="primary" onClick={() => setConfirmEnd(true)}>Terminer</button></div></div>
      {confirmEnd && <Notice kind="info">Terminer la séance ? Seules les séries validées seront comptées. <div className="row" style={{ marginTop: 6 }}><button className="primary" onClick={() => finish("terminee")}>Oui, terminer</button><button onClick={() => setConfirmEnd(false)}>Non</button></div></Notice>}
    </div>
    {left > 0 && <div className="card" role="timer" aria-live="off"><div className="row spread"><div><span className="big">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span> <span className="muted">repos</span></div><div className="row"><button onClick={addRest}>+30 s</button><button onClick={stopRest}>Arrêter</button></div></div></div>}
    {rest > 0 && left === 0 && <Notice kind="okk">Repos terminé.<button className="ghost" onClick={stopRest}>OK</button></Notice>}
    {items.length === 0 && <Empty>Séance libre : ajoutez un exercice pour commencer.</Empty>}
    {items.map((it: any) => {
      const prev = w.previous?.find((p: any) => p.slug === it.slug)?.last;
      const list = rows[it.slug] ?? [];
      const planned = it.sets - list.filter((r) => r.kind === "work").length;
      const timeBased = it.metric === "time", dist = it.metric === "distance";
      return <div className="card" key={it.slug}>
        <h3 style={{ margin: 0 }}>{it.name}</h3>
        <p className="small muted">{it.sets ? `Prévu : ${it.sets} série(s)${it.reps ? ` · ${it.reps} rép.` : ""}${it.load != null ? ` · ${it.load} kg` : ""} · repos ${it.rest ?? 0} s` : "Exercice libre"}</p>
        {prev && <p className="small">Dernière fois ({fmtShort(prev.date)}{prev.equipment_ctx ? `, ${prev.equipment_ctx}` : ""}{prev.load_conv ? `, charge ${prev.load_conv.replace("_", " ")}` : ""}) : {prev.sets.map((s: any) => `${s.reps ?? ""}${s.load != null ? `×${s.load} kg` : ""}${s.secs ? `${s.secs}s` : ""}${s.distance ? `${s.distance}km` : ""}`).join(" · ")}</p>}
        {!timeBased && !dist && <div className="inline small" style={{ marginBottom: 6 }}>
          <div><label>Appareil / identifiant</label><input defaultValue={prev?.equipment_ctx ?? ""} onChange={(e) => (equipCtx.current[it.slug] = e.target.value)} placeholder="ex. machine A" /></div>
          <div><label>Convention de charge</label><select defaultValue={prev?.load_conv ?? ""} onChange={(e) => (conv.current[it.slug] = e.target.value)}><option value="">libre / barre</option><option value="total">total</option><option value="par_haltere">par haltère</option><option value="machine">machine</option></select></div></div>}
        {list.map((r, n) => <div className="setrow" key={r.key} style={{ gridTemplateColumns: "2.4rem 1fr 1fr auto" }}>
          <div className="small muted">{r.kind === "warmup" ? "É" : n + 1}</div>
          {!timeBased && !dist ? <><div><label>Rép.</label><input inputMode="numeric" value={r.reps} disabled={r.status === "saved" || r.status === "saving"} onChange={(e) => patch(it.slug, r.key, { reps: e.target.value })} /></div><div><label>{r.bodyweight || r.assisted ? "Lest/assist. kg" : "Charge kg"}</label><input inputMode="decimal" value={r.load} disabled={r.status === "saved" || r.status === "saving"} onChange={(e) => patch(it.slug, r.key, { load: e.target.value })} /></div></>
            : <><div><label>{timeBased ? "Durée (s)" : "Durée (min)"}</label><input inputMode="decimal" value={r.secs} disabled={r.status === "saved"} onChange={(e) => patch(it.slug, r.key, { secs: e.target.value })} /></div>{dist ? <div><label>Distance (km)</label><input inputMode="decimal" value={r.distance} disabled={r.status === "saved"} onChange={(e) => patch(it.slug, r.key, { distance: e.target.value })} /></div> : <div />}</>}
          <div className="row" style={{ gap: ".25rem" }}>
            {r.status === "saved" ? <span className="badge ok" role="status">✓ enregistré</span> : r.status === "saving" ? <span className="badge" role="status">enregistrement…</span> : <button className="primary" onClick={() => validate(it, r)}>{r.status === "failed" ? "Relancer" : "Valider"}</button>}
            <button className="ghost" aria-label="Supprimer la série" onClick={() => removeSet(it.slug, r)}>✕</button></div>
          {r.status !== "saved" && r.status !== "saving" && <div className="small" style={{ gridColumn: "1 / -1" }}>
            <label className="chk" style={{ minHeight: 0, display: "inline-flex", marginRight: 12 }}><input type="checkbox" checked={r.kind === "warmup"} onChange={(e) => patch(it.slug, r.key, { kind: e.target.checked ? "warmup" : "work" })} />échauffement</label>
            <label className="chk" style={{ minHeight: 0, display: "inline-flex", marginRight: 12 }}><input type="checkbox" checked={r.bodyweight} onChange={(e) => patch(it.slug, r.key, { bodyweight: e.target.checked })} />poids du corps</label>
            <label className="chk" style={{ minHeight: 0, display: "inline-flex" }}><input type="checkbox" checked={r.assisted} onChange={(e) => patch(it.slug, r.key, { assisted: e.target.checked })} />assistée</label>
            <div className="inline" style={{ marginTop: 4 }}><div><label>Effort perçu (1-10)</label><input inputMode="numeric" value={r.rpe} onChange={(e) => patch(it.slug, r.key, { rpe: e.target.value })} /></div></div></div>}
          {r.error && <div className="notice err" style={{ gridColumn: "1 / -1" }} role="alert">{r.error}</div>}
        </div>)}
        <div className="row" style={{ marginTop: 8 }}>
          <button onClick={() => setRows((r) => ({ ...r, [it.slug]: [...(r[it.slug] ?? []), blank(it)] }))}>＋ Série</button>
          {planned > 0 && it.reps && !timeBased && !dist && <button onClick={() => { const row = blank(it); const l = [...list, row]; setRows((r) => ({ ...r, [it.slug]: l })); validate(it, { ...row, reps: String(it.reps).split("-")[0] }, true); }}>Valider comme prévu</button>}
        </div>
      </div>;
    })}
    <button onClick={() => setPicker(true)}>＋ Ajouter un exercice</button>
    {picker && <ExercisePicker onClose={() => setPicker(false)} onPick={(e) => { setExtra([...extra, { slug: e.ex_key, name: e.name, metric: e.metric, sets: 0, rest: 60 } as any]); setPicker(false); }} />}
  </div>;
}

function Summary({ s, onClose }: { s: any; onClose: () => void }) {
  const sm = s.summary;
  return <div className="card"><h2>Résumé — {s.workout.state === "terminee" ? "séance terminée" : "séance interrompue"}</h2>
    <div className="grid g3"><div><div className="big">{sm.duration_min}<span className="unit">min</span></div></div><div><div className="big">{sm.workSets}<span className="unit">séries validées</span></div></div><div><div className="big">{nf(sm.volume, 0)}<span className="unit">kg de volume externe</span></div></div></div>
    {sm.bodyweightSets > 0 && <p className="small muted">{sm.bodyweightSets} série(s) au poids du corps ou assistées, présentées séparément du volume externe.</p>}
    <p className="small muted">Le volume n’est pas une mesure de calories brûlées.</p>
    {s.exercises.map((e: any) => <div key={e.name} className="item"><div className="grow"><b>{e.name}</b><div className="small muted">{e.sets.map((x: any) => `${x.kind === "warmup" ? "(é) " : ""}${x.reps ?? ""}${x.load != null ? `×${x.load} kg` : ""}${x.secs ? `${x.secs}s` : ""}${x.distance ? `${x.distance}km` : ""}`).join(" · ")}</div></div></div>)}
    {s.workout.state === "interrompue" && <Notice kind="info">Séance interrompue : le réalisé est conservé, sans être déclaré terminé.</Notice>}
    <button className="primary" onClick={onClose}>Fermer</button></div>;
}

function ExercisePicker({ onPick, onClose }: { onPick: (e: any) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const { data } = useApi<any>(`/exercises?q=${encodeURIComponent(q)}`);
  return <Modal title="Choisir un exercice" onClose={onClose}>
    <input type="search" autoFocus placeholder="Rechercher…" aria-label="Rechercher un exercice" value={q} onChange={(e) => setQ(e.target.value)} />
    {data?.exercises.map((e: any) => <div className="item" key={e.id}><div className="grow"><b>{e.name}</b><div className="small muted">{e.movement} · {e.equipment.join(", ") || "sans matériel"}</div></div>{!e.compatible && <span className="badge warn">matériel manquant</span>}<button onClick={() => onPick(e)}>Choisir</button></div>)}
  </Modal>;
}

// ---------------- Routines ----------------
function Routines() {
  const { data, error, reload } = useApi<any>("/routines");
  const [edit, setEdit] = useState<any | null | false>(false);
  async function dup(key: string) { try { const r = await api(`/routines/${key}/duplicate`, { body: {} }); toast("Copie créée dans vos routines"); await reload(); setEdit({ routine_key: r.routine_key, ...(await api("/routines")).routines.find((x: any) => x.routine_key === r.routine_key) }); } catch (e: any) { toast(e.message); } }
  return <div className="stack">
    <div className="row spread"><p className="muted">Une séance démarrée fige une copie de la routine : la modifier ensuite n’affecte ni la séance en cours ni l’historique.</p><button className="primary" onClick={() => setEdit(null)}>＋ Routine</button></div>
    {error && <ErrorBox error={error} retry={reload} />}
    <h2>Mes routines</h2>
    {data?.routines.length === 0 && <Empty>Aucune routine personnelle. Créez-en une ou dupliquez un modèle ci-dessous.</Empty>}
    {data?.routines.map((r: any) => <div className="card" key={r.id}><div className="row spread"><b>{r.name}</b><span className="badge">v{r.version} · {r.place === "gym" ? "salle" : "maison"}</span></div>
      <p className="small muted">{r.items.map((i: any) => `${i.name} ${i.sets}×${i.reps || "?"}`).join(" · ")}</p>
      {r.items.some((i: any) => !i.compatible) && <Notice>Certains exercices ne sont pas compatibles avec votre matériel : {r.items.filter((i: any) => !i.compatible).map((i: any) => i.name).join(", ")}. Ouvrez la routine pour choisir une alternative.</Notice>}
      <div className="row"><button onClick={() => setEdit(r)}>Modifier</button><button onClick={() => dup(r.routine_key)}>Dupliquer</button><button className="danger" onClick={async () => { await api(`/routines/${r.routine_key}`, { method: "DELETE" }); toast("Archivée : les séances passées sont conservées"); reload(); }}>Archiver</button></div></div>)}
    <h2>Modèles de démonstration</h2>
    <p className="small muted">Exemples éditables, séparés de vos routines : séries et intensités sont à définir par vous. Ce ne sont pas un programme prescrit.</p>
    {data?.demos.map((r: any) => <div className="card" key={r.id}><b>{r.name}</b><p className="small muted">{r.items.map((i: any) => i.name).join(" · ")}</p><button onClick={() => dup(r.routine_key)}>Dupliquer pour l’éditer</button></div>)}
    {edit !== false && <Modal title={edit ? "Modifier la routine" : "Nouvelle routine"} onClose={() => setEdit(false)}><RoutineEditor routine={edit} onDone={() => { setEdit(false); reload(); }} /></Modal>}
  </div>;
}

function RoutineEditor({ routine, onDone }: { routine: any | null; onDone: () => void }) {
  const [name, setName] = useState(routine?.name ?? ""), [place, setPlace] = useState(routine?.place ?? "home");
  const [items, setItems] = useState<any[]>(routine?.items ?? []), [picker, setPicker] = useState(false), [err, setErr] = useState<string | null>(null);
  const [alt, setAlt] = useState<Record<string, any>>({});
  const upd = (i: number, p: any) => setItems(items.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= items.length) return; const n = [...items]; [n[i], n[j]] = [n[j], n[i]]; setItems(n); };
  async function showAlt(slug: string) { const r = await api(`/exercises/${slug}`); setAlt({ ...alt, [slug]: r.alternative }); }
  async function save() {
    setErr(null);
    try {
      const body = { version: routine?.user_id ? routine.version : undefined, name, place, items: items.map((i) => ({ slug: i.slug, sets: parseNum(String(i.sets)), warmup_sets: parseNum(String(i.warmup_sets ?? 0)) ?? 0, reps: i.reps ?? "", load: parseNum(String(i.load ?? "")), rest: parseNum(String(i.rest)), duration_s: parseNum(String(i.duration_s ?? "")), distance_km: parseNum(String(i.distance_km ?? "")), intensity: i.intensity ?? "", notes: i.notes ?? "" })) };
      if (routine?.routine_key && routine.user_id) await api(`/routines/${routine.routine_key}`, { method: "PUT", body }); else await api("/routines", { body });
      toast("Routine enregistrée"); onDone();
    } catch (e: any) { setErr(e.message); }
  }
  return <div>
    {err && <Notice kind="err">{err}</Notice>}
    <div className="inline"><Field label="Nom"><input value={name} onChange={(e) => setName(e.target.value)} /></Field><Field label="Lieu"><select value={place} onChange={(e) => setPlace(e.target.value)}><option value="home">Maison</option><option value="gym">Salle</option></select></Field></div>
    {items.map((it, i) => <div className="card" key={i + it.slug}>
      <div className="row spread"><b>{it.name ?? it.slug}</b><div className="row"><button aria-label="Monter" onClick={() => move(i, -1)}>↑</button><button aria-label="Descendre" onClick={() => move(i, 1)}>↓</button><button className="danger" aria-label="Retirer" onClick={() => setItems(items.filter((_, k) => k !== i))}>✕</button></div></div>
      {it.compatible === false && <Notice>Matériel manquant ({(it.missing ?? []).join(", ")}). <button onClick={() => showAlt(it.slug)}>Voir l’alternative</button>{alt[it.slug] && <> Alternative : <b>{alt[it.slug].name}</b> <button onClick={() => { upd(i, { slug: alt[it.slug].ex_key, name: alt[it.slug].name, compatible: alt[it.slug].compatible }); }}>Remplacer</button><span className="small muted"> (nouvelle entrée : performances séparées)</span></>}</Notice>}
      <div className="grid g3"><Field label="Séries"><input inputMode="numeric" value={it.sets ?? ""} onChange={(e) => upd(i, { sets: e.target.value })} /></Field><Field label="Échauff."><input inputMode="numeric" value={it.warmup_sets ?? 0} onChange={(e) => upd(i, { warmup_sets: e.target.value })} /></Field><Field label="Répétitions" hint="ex. 8-12"><input value={it.reps ?? ""} onChange={(e) => upd(i, { reps: e.target.value })} /></Field>
        <Field label="Charge prévue (kg)"><input inputMode="decimal" value={it.load ?? ""} onChange={(e) => upd(i, { load: e.target.value })} /></Field><Field label="Repos (s)"><input inputMode="numeric" value={it.rest ?? 60} onChange={(e) => upd(i, { rest: e.target.value })} /></Field><Field label="Notes"><input value={it.notes ?? ""} onChange={(e) => upd(i, { notes: e.target.value })} /></Field></div>
    </div>)}
    <button onClick={() => setPicker(true)}>＋ Ajouter un exercice</button>
    <div className="row" style={{ marginTop: 12 }}><button className="primary" onClick={save}>Enregistrer</button><button onClick={onDone}>Annuler</button></div>
    {picker && <ExercisePicker onClose={() => setPicker(false)} onPick={(e) => { setItems([...items, { slug: e.ex_key, name: e.name, sets: 3, warmup_sets: 0, reps: "", rest: 60, compatible: e.compatible, missing: e.missing }]); setPicker(false); }} />}
  </div>;
}

// ---------------- Planning ----------------
function Planning() {
  const me = useMe();
  const [from, setFrom] = useState(() => { const d = new Date(me.today + "T00:00:00Z"); return shiftDate(me.today, -((d.getUTCDay() + 6) % 7)); });
  const { data, error, reload } = useApi<any>(`/planned?from=${from}&to=${shiftDate(from, 6)}`);
  const routines = useApi<any>("/routines");
  const [add, setAdd] = useState(false), [rk, setRk] = useState(""), [date, setDate] = useState(me.today), [weekly, setWeekly] = useState(false);
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(from, i));
  async function setStatus(p: any, status: string, scope?: string) { try { await api(`/planned/${p.id}`, { method: "PUT", body: { status, scope } }); reload(); } catch (e: any) { toast(e.message); } }
  return <div className="stack">
    <div className="row spread"><div className="row"><button onClick={() => setFrom(shiftDate(from, -7))} aria-label="Semaine précédente">‹</button><b>Semaine du {fmtShort(from)}</b><button onClick={() => setFrom(shiftDate(from, 7))} aria-label="Semaine suivante">›</button></div><button className="primary" onClick={() => setAdd(true)}>＋ Planifier</button></div>
    {error && <ErrorBox error={error} retry={reload} />}
    {!data?.planned.length && <Empty>Aucune séance prévue cette semaine. Une semaine sans planning n’a pas de pourcentage d’assiduité.</Empty>}
    {days.map((d) => { const ps = data?.planned.filter((p: any) => p.date === d) ?? []; return <div className="card" key={d}><b className="cap" style={{ display: "block" }}>{fmtDate(d)}</b>
      {ps.length === 0 ? <p className="small muted">—</p> : ps.map((p: any) => <div className="item" key={p.id}><div className="grow"><b>{p.routine_name ?? p.routine_key}</b> <span className={`badge ${p.status === "realise" ? "ok" : p.status === "annule" ? "danger" : p.status === "reporte" ? "warn" : ""}`}>{{ prevu: "prévu", realise: "réalisé", reporte: "reporté", annule: "annulé" }[p.status as string]}</span>{p.series_id && <span className="small muted"> · récurrent</span>}</div>
        {p.status !== "realise" && <><button onClick={() => setStatus(p, "reporte")}>Reporter</button><button onClick={() => setStatus(p, "annule")}>Annuler</button></>}
        {p.series_id && p.status !== "realise" && <button className="ghost" onClick={async () => { await api(`/planned/${p.id}?scope=future`, { method: "DELETE" }); reload(); }}>Supprimer la suite</button>}</div>)}</div>; })}
    {add && <Modal title="Planifier une séance" onClose={() => setAdd(false)}>
      <Field label="Routine"><select value={rk} onChange={(e) => setRk(e.target.value)}><option value="">— choisir —</option>{[...(routines.data?.routines ?? []), ...(routines.data?.demos ?? [])].map((r: any) => <option key={r.routine_key} value={r.routine_key}>{r.name}</option>)}</select></Field>
      <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <label className="chk"><input type="checkbox" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} />Répéter chaque semaine (12 semaines)</label>
      <button className="primary" disabled={!rk} onClick={async () => { try { await api("/planned", { body: { routine_key: rk, date, weekly } }); setAdd(false); reload(); } catch (e: any) { toast(e.message); } }}>Planifier</button></Modal>}
  </div>;
}

// ---------------- Historique & activités ----------------
function History() {
  const me = useMe();
  const w = useApi<any>("/workouts?limit=50");
  const a = useApi<any>("/activities");
  const [open, setOpen] = useState<any | null>(null), [form, setForm] = useState(false);
  return <div className="stack">
    <div className="card"><div className="row spread"><h2 style={{ margin: 0 }}>Activités hors musculation</h2><button className="primary" onClick={() => setForm(true)}>＋ Activité</button></div>
      <p className="small muted">Marche, course, vélo… saisies à la main. Aucune géolocalisation ni fréquence cardiaque.</p>
      {a.data?.activities.length === 0 && <Empty>Aucune activité enregistrée.</Empty>}
      {a.data?.activities.slice(0, 15).map((x: any) => <div className="item" key={x.id}><div className="grow"><b>{x.type}</b> <span className="small muted">{fmtShort(x.date)} · {x.duration_min ? `${nf(x.duration_min, 0)} min` : ""}{x.distance_km ? ` · ${nf(x.distance_km)} km` : ""}{x.steps ? ` · ${x.steps} pas` : ""}{x.energy_kcal ? ` · dépense ${nf(x.energy_kcal, 0)} kcal (${x.energy_source})` : ""}</span></div><button className="ghost" aria-label="Supprimer" onClick={async () => { await api(`/activities/${x.id}`, { method: "DELETE" }); a.reload(); }}>✕</button></div>)}
    </div>
    <div className="card"><h2 style={{ margin: 0 }}>Séances</h2>
      {w.data?.workouts.length === 0 && <Empty>Aucune séance pour l’instant. Démarrez une routine ou une séance libre.</Empty>}
      {w.data?.workouts.map((x: any) => <div className="item" key={x.id}><button className="ghost grow" style={{ justifyContent: "flex-start", textAlign: "left", padding: 0 }} onClick={async () => setOpen(await api(`/workouts/${x.id}`))}><span><b>{x.name}</b> <span className={`badge ${x.state === "terminee" ? "ok" : x.state === "interrompue" ? "warn" : "acc"}`}>{{ terminee: "terminée", interrompue: "interrompue", en_cours: "en cours" }[x.state as string]}</span><div className="small muted">{fmtShort(x.date)} · {x.summary.duration_min} min · {x.summary.workSets} séries · {nf(x.summary.volume, 0)} kg</div></span></button></div>)}</div>
    {open && <Modal title={open.workout.name} onClose={() => setOpen(null)}><Summary s={open} onClose={() => setOpen(null)} /></Modal>}
    {form && <ActivityForm today={me.today} onClose={() => setForm(false)} onSaved={() => { setForm(false); a.reload(); }} />}
  </div>;
}
function ActivityForm({ today, onClose, onSaved }: { today: string; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({ type: "Marche", date: today, duration_min: "", distance_km: "", steps: "", rpe: "", note: "", energy_kcal: "", energy_source: "estimation personnelle" }), [err, setErr] = useState<string | null>(null);
  const s = (k: string, v: string) => setF({ ...f, [k]: v });
  return <Modal title="Nouvelle activité" onClose={onClose}>
    {err && <Notice kind="err">{err}</Notice>}
    <div className="inline"><Field label="Type"><select value={f.type} onChange={(e) => s("type", e.target.value)}>{["Marche", "Course", "Tennis", "Vélo", "Cardio mixte", "Autre"].map((t) => <option key={t}>{t}</option>)}</select></Field><Field label="Date"><input type="date" value={f.date} onChange={(e) => s("date", e.target.value)} /></Field></div>
    <div className="inline"><Field label="Durée (min)"><input inputMode="decimal" value={f.duration_min} onChange={(e) => s("duration_min", e.target.value)} /></Field><Field label="Distance (km)" hint="facultatif"><input inputMode="decimal" value={f.distance_km} onChange={(e) => s("distance_km", e.target.value)} /></Field><Field label="Pas" hint="facultatif"><input inputMode="numeric" value={f.steps} onChange={(e) => s("steps", e.target.value)} /></Field></div>
    <Field label="Intensité ressentie (1-10)" hint="facultatif"><input inputMode="numeric" value={f.rpe} onChange={(e) => s("rpe", e.target.value)} /></Field>
    <div className="inline"><Field label="Dépense notée (kcal)" hint="facultatif"><input inputMode="decimal" value={f.energy_kcal} onChange={(e) => s("energy_kcal", e.target.value)} /></Field><Field label="Provenance"><select value={f.energy_source} onChange={(e) => s("energy_source", e.target.value)}><option>montre</option><option>machine</option><option>estimation personnelle</option></select></Field></div>
    <p className="small muted">La dépense est affichée séparément des apports et n’entre dans aucun calcul de déficit.</p>
    <button className="primary" onClick={async () => { try { await api("/activities", { body: { ...f, duration_min: parseNum(f.duration_min), distance_km: parseNum(f.distance_km), steps: parseNum(f.steps), rpe: parseNum(f.rpe), energy_kcal: parseNum(f.energy_kcal) } }); toast("Activité enregistrée"); onSaved(); } catch (e: any) { setErr(e.message); } }}>Enregistrer</button></Modal>;
}
