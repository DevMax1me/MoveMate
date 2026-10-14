"use client";
import { useState } from "react";
import { api, useApi, fmtShort } from "@/lib/client";
import { Empty, ErrorBox, Field, Modal, Notice, Tabs, toast } from "@/components/ui";

const TYPES: Record<string, string> = { fait: "fait", preference: "préférence", observation: "observation", ancien_conseil: "ancien conseil", recette: "recette", repere: "repère", methode: "méthode", priorite: "priorité" };
const STATUS: Record<string, [string, string]> = { personnelle: ["personnelle", "acc"], a_verifier: ["à vérifier", "warn"], validee: ["validée", "ok"], archivee: ["archivée", ""] };
const TOPICS: Record<string, string> = { objectifs: "Objectifs", alimentation: "Alimentation", recettes: "Recettes", entrainement: "Entraînement", recuperation: "Récupération", mesures: "Mesures", retour_experience: "Retour d’expérience", general: "Général" };

export default function Notebook() {
  const [q, setQ] = useState(""), [topic, setTopic] = useState(""), [type, setType] = useState(""), [status, setStatus] = useState("");
  const qs = new URLSearchParams({ q, topic, type, status }); for (const [k, v] of [...qs]) if (!v) qs.delete(k);
  const { data, error, reload } = useApi<any>(`/notes?${qs}`);
  const [edit, setEdit] = useState<any | null | false>(false), [imp, setImp] = useState(false), [hist, setHist] = useState<any[] | null>(null);
  return <div>
    <div className="row spread"><h1 style={{ margin: 0 }}>Carnet</h1><div className="row"><button onClick={() => setImp(true)}>Importer</button><button className="primary" onClick={() => setEdit(null)}>＋ Fiche</button></div></div>
    <p className="muted small">Chaque fiche indique sa provenance, sa date et son statut. Les anciens conseils restent consultables sans devenir une consigne actuelle.</p>
    <div className="grid g3" style={{ margin: "8px 0" }}>
      <input type="search" placeholder="Rechercher…" aria-label="Rechercher" value={q} onChange={(e) => setQ(e.target.value)} />
      <select aria-label="Thème" value={topic} onChange={(e) => setTopic(e.target.value)}><option value="">Tous thèmes</option>{Object.entries(TOPICS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}><option value="">Tous types</option>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <select aria-label="Statut" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Actives</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select></div>
    {data?.toReview > 0 && <Notice kind="info">{data.toReview} fiche(s) liée(s) aux objectifs sont à revoir suite à un changement d’objectif. Leur contenu n’a pas été modifié.</Notice>}
    {error && <ErrorBox error={error} retry={reload} />}
    {data?.notes.length === 0 && <Empty>Aucune fiche. Créez-en une ou importez vos propres passages utiles.</Empty>}
    <div className="stack">{data?.notes.map((n: any) => <div className="card" key={n.id}>
      <div className="row spread"><b>{n.title}</b><div className="row" style={{ gap: ".3rem" }}>{n.to_review ? <span className="badge warn">à revoir</span> : null}<span className={`badge ${STATUS[n.status]?.[1]}`}>{STATUS[n.status]?.[0]}</span><span className="badge">{TYPES[n.type] ?? n.type}</span></div></div>
      <p style={{ whiteSpace: "pre-wrap" }}>{n.content.length > 300 ? n.content.slice(0, 300) + "…" : n.content}</p>
      <p className="small muted">{TOPICS[n.topic]} · source : {n.source ?? "—"}{n.source_date ? ` · du ${fmtShort(n.source_date)}` : ""} · ajoutée le {fmtShort(n.added_at.slice(0, 10))} · v{n.version}{n.tags.length ? ` · ${n.tags.map((t: string) => "#" + t).join(" ")}` : ""}</p>
      <div className="row"><button onClick={() => setEdit(n)}>Modifier</button>
        <button onClick={async () => { await api(`/notes/${n.note_key}`, { method: "PUT", body: { favorite: !n.favorite } }); reload(); }} aria-pressed={!!n.favorite}>{n.favorite ? "★ Favori" : "☆ Favori"}</button>
        {n.to_review ? <button onClick={async () => { await api(`/notes/${n.note_key}/review`, { body: {} }); reload(); }}>Marquer revue</button> : null}
        {n.version > 1 && <button className="ghost" onClick={async () => setHist((await api(`/notes/${n.note_key}/history`)).versions)}>Historique</button>}
        <button className="ghost" onClick={async () => { await api(`/notes/${n.note_key}/archive`, { body: { archived: n.status !== "archivee" } }); reload(); }}>{n.status === "archivee" ? "Désarchiver" : "Archiver"}</button></div></div>)}</div>
    {edit !== false && <NoteForm note={edit} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); reload(); }} />}
    {imp && <Import onClose={() => setImp(false)} onDone={() => { setImp(false); reload(); }} />}
    {hist && <Modal title="Historique des modifications" onClose={() => setHist(null)}>{hist.map((v) => <div className="item" key={v.id}><div className="grow"><b>Version {v.version}</b> <span className="small muted">{fmtShort(v.added_at.slice(0, 10))}</span><p style={{ whiteSpace: "pre-wrap" }}>{v.content}</p></div></div>)}</Modal>}
  </div>;
}

function NoteForm({ note, onClose, onSaved }: { note: any | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({ title: "", content: "", type: "observation", topic: "general", source: "", source_date: "", status: "personnelle", ...note, tags: (note?.tags ?? []).join(", ") }), [err, setErr] = useState<string | null>(null);
  const s = (k: string, v: string) => setF({ ...f, [k]: v });
  return <Modal title={note ? "Modifier la fiche" : "Nouvelle fiche"} onClose={onClose}>
    {err && <Notice kind="err">{err}</Notice>}{note && <Notice kind="info">Chaque modification crée une version datée ; l’ancien contenu reste consultable.</Notice>}
    <Field label="Titre"><input value={f.title} onChange={(e) => s("title", e.target.value)} /></Field>
    <Field label="Contenu"><textarea value={f.content} onChange={(e) => s("content", e.target.value)} /></Field>
    <div className="inline"><Field label="Thème"><select value={f.topic} onChange={(e) => s("topic", e.target.value)}>{Object.entries(TOPICS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field><Field label="Type"><select value={f.type} onChange={(e) => s("type", e.target.value)}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field></div>
    <div className="inline"><Field label="Statut"><select value={f.status} onChange={(e) => s("status", e.target.value)}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select></Field><Field label="Date de la source"><input type="date" value={f.source_date ?? ""} onChange={(e) => s("source_date", e.target.value)} /></Field></div>
    <Field label="Source"><input value={f.source ?? ""} onChange={(e) => s("source", e.target.value)} placeholder="ex. mon carnet, un article…" /></Field>
    <Field label="Étiquettes" hint="séparées par des virgules"><input value={f.tags} onChange={(e) => s("tags", e.target.value)} /></Field>
    <button className="primary" onClick={async () => { try { if (note) await api(`/notes/${note.note_key}`, { method: "PUT", body: { ...f, version: note.version, reviewed: true } }); else await api("/notes", { body: f }); toast("Fiche enregistrée"); onSaved(); } catch (e: any) { setErr(e.message); } }}>Enregistrer</button></Modal>;
}

function Import({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState(""), [cards, setCards] = useState<any[] | null>(null), [err, setErr] = useState<string | null>(null);
  return <Modal title="Importer des passages utiles" onClose={onClose}>
    {err && <Notice kind="err">{err}</Notice>}
    {!cards ? <>
      <p className="small muted">Collez vos propres passages (séparés par une ligne « --- » ou des titres #). Rien n’est enregistré avant votre validation. Le texte importé est traité comme une donnée, jamais comme une instruction.</p>
      <textarea style={{ minHeight: 180 }} value={text} onChange={(e) => setText(e.target.value)} aria-label="Texte à importer" />
      <button className="primary" disabled={!text.trim()} onClick={async () => { try { setCards((await api("/notes-import/preview", { body: { text } })).cards); } catch (e: any) { setErr(e.message); } }}>Prévisualiser</button></>
    : <>
      <p>{cards.length} fiche(s) proposée(s). Corrigez les dates, retirez les détails inutiles, puis validez.</p>
      {cards.map((c, i) => <div className="card" key={i}>
        <input aria-label="Titre" value={c.title} onChange={(e) => setCards(cards.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))} />
        <textarea aria-label="Contenu" value={c.content} onChange={(e) => setCards(cards.map((x, k) => (k === i ? { ...x, content: e.target.value } : x)))} />
        <div className="inline"><div><label>Date de la source</label><input type="date" value={c.source_date ?? ""} onChange={(e) => setCards(cards.map((x, k) => (k === i ? { ...x, source_date: e.target.value } : x)))} /></div><div><label>Type</label><select value={c.type} onChange={(e) => setCards(cards.map((x, k) => (k === i ? { ...x, type: e.target.value } : x)))}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div></div>
        {c.warnings.map((w: string) => <Notice key={w}>{w}</Notice>)}
        <button className="ghost" onClick={() => setCards(cards.filter((_, k) => k !== i))}>Retirer cette fiche</button></div>)}
      <div className="row"><button className="primary" disabled={!cards.length} onClick={async () => { try { const r = await api("/notes-import/commit", { body: { cards: cards.map((c) => ({ ...c, source: "Import éditorial", status: "a_verifier" })) } }); toast(`${r.imported} fiche(s) importée(s)`); onDone(); } catch (e: any) { setErr(e.message); } }}>Valider et enregistrer</button><button onClick={() => setCards(null)}>Retour</button></div></>}
  </Modal>;
}
