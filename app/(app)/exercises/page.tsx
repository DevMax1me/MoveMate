"use client";
import { useState } from "react";
import { api, useApi } from "@/lib/client";
import { ErrorBox, Empty, Field, Modal, Notice, toast } from "@/components/ui";

export default function Exercises() {
  const [q, setQ] = useState(""), [place, setPlace] = useState(""), [type, setType] = useState(""), [level, setLevel] = useState(""), [eq, setEq] = useState(""), [compat, setCompat] = useState(false);
  const qs = new URLSearchParams({ q, place, type, level, equipment: eq, compatible: compat ? "1" : "" }); for (const [k, v] of [...qs]) if (!v) qs.delete(k);
  const { data, error, reload } = useApi<any>(`/exercises?${qs}`);
  const [sel, setSel] = useState<string | null>(null), [create, setCreate] = useState(false);
  return <div>
    <div className="row spread"><h1 style={{ margin: 0 }}>Exercices</h1><button className="primary" onClick={() => setCreate(true)}>＋ Exercice privé</button></div>
    <p className="muted small">Le catalogue décrit des mouvements ; il ne constitue pas un programme prescrit. « Maison » ne signifie pas toujours « sans matériel » : la compatibilité dépend du matériel déclaré dans votre profil.</p>
    <div className="grid g3" style={{ margin: "8px 0" }}>
      <input type="search" placeholder="Rechercher…" aria-label="Rechercher" value={q} onChange={(e) => setQ(e.target.value)} />
      <select aria-label="Lieu" value={place} onChange={(e) => setPlace(e.target.value)}><option value="">Maison + salle</option><option value="home">Maison</option><option value="gym">Salle</option></select>
      <select aria-label="Type de mouvement" value={type} onChange={(e) => setType(e.target.value)}><option value="">Tous mouvements</option>{["poussée", "tirage", "jambes", "tronc", "cardio", "mobilité"].map((t) => <option key={t}>{t}</option>)}</select>
      <select aria-label="Niveau" value={level} onChange={(e) => setLevel(e.target.value)}><option value="">Tous niveaux</option>{["débutant", "intermédiaire", "avancé"].map((t) => <option key={t}>{t}</option>)}</select>
      <select aria-label="Matériel" value={eq} onChange={(e) => setEq(e.target.value)}><option value="">Tout matériel</option><option value="none">Sans matériel</option>{["haltères", "barre", "banc", "élastique", "machine"].map((t) => <option key={t}>{t}</option>)}</select>
      <label className="chk"><input type="checkbox" checked={compat} onChange={(e) => setCompat(e.target.checked)} />Compatibles avec mon matériel</label></div>
    {error && <ErrorBox error={error} retry={reload} />}
    {data?.exercises.length === 0 && <Empty>Aucun exercice ne correspond à ces filtres.</Empty>}
    <div className="grid g2">{data?.exercises.map((e: any) => <button key={e.id} className="card" style={{ textAlign: "left", display: "block", width: "100%" }} onClick={() => setSel(e.ex_key)}>
      <b>{e.name}</b>{e.alias && <span className="muted small"> · {e.alias}</span>}
      <div className="small muted">{e.movement} · {e.primary_muscles.join(", ")} · {e.level}</div>
      <div className="row" style={{ marginTop: 4, gap: ".3rem" }}>{e.place !== "gym" && <span className="badge">maison</span>}{e.place !== "home" && <span className="badge">salle</span>}<span className="badge">{e.equipment.length ? e.equipment.join(", ") : "sans matériel"}</span>{!e.compatible && <span className="badge warn">matériel manquant</span>}{e.private && <span className="badge acc">privé</span>}</div></button>)}</div>
    {sel && <Detail k={sel} onClose={() => setSel(null)} onPick={setSel} />}
    {create && <CreateEx onClose={() => setCreate(false)} onSaved={() => { setCreate(false); reload(); }} />}
  </div>;
}

function Detail({ k, onClose, onPick }: { k: string; onClose: () => void; onPick: (k: string) => void }) {
  const { data } = useApi<any>(`/exercises/${k}`);
  const [report, setReport] = useState(false), [msg, setMsg] = useState("");
  if (!data) return <Modal title="Exercice" onClose={onClose}><p className="muted">Chargement…</p></Modal>;
  const e = data.exercise;
  return <Modal title={e.name} onClose={onClose}>
    <p className="muted small">{e.movement} · principal : {e.primary_muscles.join(", ")}{e.secondary_muscles.length ? ` · secondaire : ${e.secondary_muscles.join(", ")}` : ""} · {e.level} · suivi : {{ reps_load: "répétitions et charge", time: "durée", distance: "durée et distance" }[e.metric as string]}</p>
    <p><span className="badge">{e.equipment.length ? e.equipment.join(", ") : "sans matériel"}</span></p>
    {!e.compatible && <Notice>Matériel manquant dans votre profil : {e.missing.join(", ")}.</Notice>}
    {e.media_url ? <p className="small">Média : <a href={e.media_url} rel="noopener noreferrer" target="_blank">{e.media_source}</a> — {e.media_author}, {e.media_license}</p> : <p className="small muted">Pas de média pour cet exercice.</p>}
    <h3>Exécution</h3><p>{e.steps}</p><h3>Erreurs fréquentes</h3><p>{e.mistakes}</p>
    {data.easier && <p>Variante plus simple : <button className="ghost" onClick={() => onPick(data.easier.ex_key)}>{data.easier.name}</button></p>}
    {data.alternative && <p>Alternative selon le matériel : <button className="ghost" onClick={() => onPick(data.alternative.ex_key)}>{data.alternative.name}</button></p>}
    <p className="small muted">Cette fiche décrit un mouvement ; elle ne prescrit ni série, ni intensité, ni repos.</p>
    {!report ? <button className="ghost" onClick={() => setReport(true)}>Signaler une erreur</button> : <div><Field label="Votre signalement"><textarea value={msg} onChange={(x) => setMsg(x.target.value)} /></Field><button onClick={async () => { await api("/reports", { body: { kind: "exercise", ref_id: e.ex_key, message: msg } }).then(() => { toast("Merci, signalement transmis"); setReport(false); }).catch((x) => toast(x.message)); }}>Envoyer</button></div>}
  </Modal>;
}

function CreateEx({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({ name: "", movement: "autre", primary_muscles: "", equipment: "", place: "both", level: "débutant", metric: "reps_load", steps: "" }), [err, setErr] = useState<string | null>(null);
  const s = (k: string, v: string) => setF({ ...f, [k]: v });
  return <Modal title="Exercice privé" onClose={onClose}>
    {err && <Notice kind="err">{err}</Notice>}
    <Field label="Nom"><input value={f.name} onChange={(e) => s("name", e.target.value)} /></Field>
    <div className="inline"><Field label="Mouvement"><input value={f.movement} onChange={(e) => s("movement", e.target.value)} /></Field><Field label="Lieu"><select value={f.place} onChange={(e) => s("place", e.target.value)}><option value="both">Maison et salle</option><option value="home">Maison</option><option value="gym">Salle</option></select></Field></div>
    <Field label="Muscles principaux" hint="séparés par des virgules"><input value={f.primary_muscles} onChange={(e) => s("primary_muscles", e.target.value)} /></Field>
    <Field label="Matériel requis" hint="ex. haltères, banc"><input value={f.equipment} onChange={(e) => s("equipment", e.target.value)} /></Field>
    <div className="inline"><Field label="Suivi"><select value={f.metric} onChange={(e) => s("metric", e.target.value)}><option value="reps_load">répétitions et charge</option><option value="time">durée</option><option value="distance">distance</option></select></Field><Field label="Niveau"><select value={f.level} onChange={(e) => s("level", e.target.value)}><option>débutant</option><option>intermédiaire</option><option>avancé</option></select></Field></div>
    <Field label="Exécution" hint="facultatif"><textarea value={f.steps} onChange={(e) => s("steps", e.target.value)} /></Field>
    <button className="primary" onClick={async () => { try { await api("/exercises", { body: f }); toast("Exercice créé"); onSaved(); } catch (e: any) { setErr(e.message); } }}>Créer</button></Modal>;
}
