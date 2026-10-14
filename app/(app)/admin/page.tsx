"use client";
import { useState } from "react";
import { api, useApi } from "@/lib/client";
import { useMe } from "@/components/Shell";
import { Empty, ErrorBox, Field, Loading, Modal, Notice, Tabs, toast } from "@/components/ui";

export default function Admin() {
  const me = useMe();
  const [tab, setTab] = useState<"overview" | "exercises" | "reports" | "support">("overview");
  if (me.role !== "admin") return <Notice kind="err">Réservé à l’administration.</Notice>;
  return <div><h1>Administration</h1>
    <Notice kind="info">L’administration gère les contenus publics, pas les journaux privés. Les statistiques sont agrégées.</Notice>
    <Tabs tabs={[["overview", "Vue d’ensemble"], ["exercises", "Catalogue"], ["reports", "Signalements"], ["support", "Support et audit"]]} value={tab} onChange={setTab} />
    {tab === "overview" ? <Overview /> : tab === "exercises" ? <Ex /> : tab === "reports" ? <Reports /> : <Support />}</div>;
}
function Overview() {
  const s = useApi<any>("/admin/stats"), u = useApi<any>("/admin/users");
  if (s.error) return <ErrorBox error={s.error} retry={s.reload} />;
  if (!s.data) return <Loading />;
  const d = s.data;
  return <div className="stack"><div className="grid g3">{[["Comptes", d.users], ["Exercices publics", d.exercises], ["Aliments publics", d.foods], ["Signalements ouverts", d.reportsOpen], ["Fiches à relire", d.exercisesNeedingReview], ["Médias sans droits complets", d.exercisesWithMediaMissingRights]].map(([l, v]) => <div className="card" key={l as string}><div className="big">{v}</div><div className="small muted">{l}</div></div>)}</div>
    <div className="card"><h2 style={{ margin: 0 }}>Comptes</h2>{u.data?.users.map((x: any) => <div className="item" key={x.id}><div className="grow">{x.email}</div><span className="badge">{x.role}</span></div>)}</div></div>;
}
function Ex() {
  const { data, error, reload } = useApi<any>("/admin/exercises");
  const [edit, setEdit] = useState<any | null>(null);
  return <div className="card">{error && <ErrorBox error={error} retry={reload} />}
    <p className="small muted">Les explications publiques sont relues avant publication. Une image ou vidéo n’est intégrée qu’avec auteur, source et licence.</p>
    {data?.exercises.map((e: any) => <div className="item" key={e.id}><div className="grow"><b>{e.name}</b> <span className="small muted">v{e.version}</span><div className="small muted">{e.reviewed_at ? `relue le ${e.reviewed_at.slice(0, 10)}` : "à relire"}{e.media_url ? ` · média : ${e.media_license ?? "licence manquante"}` : ""}</div></div><button onClick={() => setEdit(e)}>Éditer</button></div>)}
    {edit && <EditEx e={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}</div>;
}
function EditEx({ e, onClose, onSaved }: { e: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({ steps: e.steps ?? "", mistakes: e.mistakes ?? "", media_url: e.media_url ?? "", media_author: e.media_author ?? "", media_source: e.media_source ?? "", media_license: e.media_license ?? "", reviewed: true }), [err, setErr] = useState<string | null>(null);
  const s = (k: string, v: any) => setF({ ...f, [k]: v });
  return <Modal title={e.name} onClose={onClose}>{err && <Notice kind="err">{err}</Notice>}
    <Field label="Exécution"><textarea value={f.steps} onChange={(x) => s("steps", x.target.value)} /></Field><Field label="Erreurs fréquentes"><textarea value={f.mistakes} onChange={(x) => s("mistakes", x.target.value)} /></Field>
    <Field label="URL du média" hint="facultatif"><input value={f.media_url} onChange={(x) => s("media_url", x.target.value)} /></Field>
    {f.media_url && <><Field label="Auteur"><input value={f.media_author} onChange={(x) => s("media_author", x.target.value)} /></Field><Field label="Source"><input value={f.media_source} onChange={(x) => s("media_source", x.target.value)} /></Field><Field label="Licence"><input value={f.media_license} onChange={(x) => s("media_license", x.target.value)} /></Field></>}
    <label className="chk"><input type="checkbox" checked={f.reviewed} onChange={(x) => s("reviewed", x.target.checked)} />Contenu relu</label>
    <button className="primary" onClick={async () => { try { await api(`/admin/exercises/${e.ex_key}`, { method: "PUT", body: f }); toast("Nouvelle version publiée"); onSaved(); } catch (x: any) { setErr(x.message); } }}>Publier une nouvelle version</button></Modal>;
}
function Reports() {
  const { data, error, reload } = useApi<any>("/admin/reports");
  return <div className="card">{error && <ErrorBox error={error} retry={reload} />}{data?.reports.length === 0 && <Empty>Aucun signalement.</Empty>}
    {data?.reports.map((r: any) => <div className="item" key={r.id}><div className="grow">{r.message}<div className="small muted">{r.kind} {r.ref_id ?? ""} · {r.at.slice(0, 10)}</div></div>{r.status === "ouvert" ? <button onClick={async () => { await api(`/admin/reports/${r.id}`, { method: "PUT", body: { status: "traite" } }); reload(); }}>Marquer traité</button> : <span className="badge ok">traité</span>}</div>)}</div>;
}
function Support() {
  const audit = useApi<any>("/admin/audit");
  const [email, setEmail] = useState(""), [reason, setReason] = useState(""), [msg, setMsg] = useState<string | null>(null);
  return <div className="stack"><div className="card"><h2 style={{ margin: 0 }}>Accès exceptionnel de support</h2>
    <p className="small muted">Motif obligatoire ; l’utilisateur doit autoriser ; durée limitée ; tout est tracé ; seules des informations techniques sont visibles.</p>
    {msg && <Notice kind="info">{msg}</Notice>}
    <Field label="E-mail du compte"><input value={email} onChange={(e) => setEmail(e.target.value)} /></Field><Field label="Motif"><input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    <button disabled={!email || !reason} onClick={async () => { try { const r = await api("/admin/support", { body: { email, reason } }); setMsg(`Demande ${r.id} : ${r.status}`); audit.reload(); } catch (e: any) { setMsg(e.message); } }}>Demander l’accès</button></div>
    <div className="card"><h2 style={{ margin: 0 }}>Journal d’audit</h2>{audit.data?.events.slice(0, 40).map((e: any) => <div className="item" key={e.id}><div className="grow small">{e.action} <span className="muted">{e.detail ?? ""}</span></div><span className="small muted">{e.at.slice(0, 16).replace("T", " ")}</span></div>)}</div></div>;
}
