"use client";
import { useEffect, useRef, useState } from "react";
import { api, useApi, nf } from "@/lib/client";
import { Empty, ErrorBox, Loading, Notice, Tabs, toast } from "@/components/ui";
import { useMe } from "@/components/Shell";
import Mascot from "@/components/Mascot";

export default function Agent() {
  const me = useMe();
  const st = useApi<any>("/agent/status");
  const [tab, setTab] = useState<"chat" | "memory">("chat");
  const [busy, setBusy] = useState(false);
  if (st.error) return <ErrorBox error={st.error} retry={st.reload} />;
  if (!st.data) return <Loading />;
  const s = st.data;
  async function toggle(enabled: boolean, purge = false) { setBusy(true); try { await api("/me/ai", { body: { enabled, purge } }); toast(enabled ? "Agent activé" : "Agent désactivé : vos journaux restent utilisables"); location.reload(); } catch (e: any) { toast(e.message); setBusy(false); } }
  if (!s.ai_enabled) return <div><h1>Mon agent</h1>
    <div className="card stack"><div className="row" style={{ alignItems: "center", gap: 14 }}><Mascot mood="wink" size={72} color="var(--pink)" /><b style={{ fontSize: "1.2rem", letterSpacing: "-.02em" }}>Termi, ton petit compagnon de carnet</b></div><p>L’agent propose des bilans expliqués, des recettes et des routines adaptées à votre profil. Il <b>propose</b> ; rien n’est écrit dans votre journal sans votre confirmation.</p>
      <Notice kind="info"><b>Ce qui est transmis :</b> {s.transmitted}<br /><b>Finalité :</b> reformuler des réponses déjà calculées. <b>Conservation :</b> conversations {s.retentionDays} jours ; faits mémorisés jusqu’à retrait. Aucune réutilisation pour entraîner un modèle. Retirer l’activation arrête les envois.</Notice>
      <p className="small muted">L’agent ne diagnostique pas, ne prescrit pas, ne garantit aucun résultat. Sans l’agent, tous vos journaux, recettes et routines restent utilisables.</p>
      <button className="primary" disabled={busy} onClick={() => toggle(true)}>Activer l’agent</button></div></div>;
  return <div><div className="row spread"><h1 style={{ margin: 0 }}>Mon agent</h1><span className="badge">{s.used}/{s.quota} messages aujourd’hui</span></div>
    <Tabs tabs={[["chat", "Conversation"], ["memory", "Ce que mon agent sait de moi"]]} value={tab} onChange={setTab} />
    {tab === "chat" ? <Chat onUsed={st.reload} /> : <Memory enabled={s.memory_enabled} />}
    <div className="card" style={{ marginTop: 14 }}><div className="row spread"><span className="small muted">Moteur : {s.provider ?? "règles locales"} · règles {s.rulesVersion}</span><button className="danger" disabled={busy} onClick={() => confirm("Désactiver l’agent ? Vous pourrez aussi effacer la mémoire.") && toggle(false, confirm("Effacer aussi la mémoire et les conversations ?"))}>Désactiver l’agent</button></div></div>
  </div>;
}

function Chat({ onUsed }: { onUsed: () => void }) {
  const conv = useApi<any>("/agent/conversation");
  const props = useApi<any>("/agent/proposals?status=pending");
  const [msg, setMsg] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [conv.data]);
  async function send(text: string) {
    if (!text.trim()) return; setBusy(true); setErr(null);
    try { await api("/agent/chat", { body: { message: text } }); setMsg(""); await Promise.all([conv.reload(), props.reload()]); onUsed(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  const quick = ["Fais le bilan de ma semaine", "Propose-moi une recette", "Prépare-moi une routine", "Aide-moi à organiser ma semaine"];
  return <div className="stack">
    <div className="card"><div className="chat" aria-live="polite">
      {conv.data?.messages.length === 0 && <Empty>Posez une question ou choisissez un raccourci.</Empty>}
      {conv.data?.messages.map((m: any) => <div key={m.id} className={`msg ${m.role}`}>{m.content}
        {m.role === "agent" && m.citations && Array.isArray(m.citations) && m.citations.length > 0 && <div className="small" style={{ marginTop: 6 }}><b>Fiches :</b> {m.citations.map((c: any) => `${c.title} (${c.status}${c.source_date ? ", " + c.source_date : ""})`).join(" · ")}</div>}
        {m.role === "agent" && m.citations?.uses && <div className="small muted" style={{ marginTop: 6 }}>Utilisé : {m.citations.uses.join(" · ")}</div>}</div>)}
      <div ref={end} /></div>
      {err && <Notice kind="err">{err}</Notice>}
      <div className="row" style={{ margin: "8px 0" }}>{quick.map((q) => <button key={q} disabled={busy} onClick={() => send(q)}>{q}</button>)}</div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); send(msg); }}><input className="grow" aria-label="Votre message" value={msg} maxLength={2000} onChange={(e) => setMsg(e.target.value)} placeholder="Votre message…" /><button className="primary" disabled={busy || !msg.trim()}>{busy ? "…" : "Envoyer"}</button></form>
      <div className="row spread" style={{ marginTop: 6 }}><span className="small muted">L’agent aide à l’organisation et au suivi ; il ne donne pas d’avis médical.</span><button className="ghost" onClick={async () => { await api("/agent/conversation", { method: "DELETE" }); conv.reload(); }}>Effacer la conversation</button></div></div>
    <Proposals list={props.data?.proposals ?? []} reload={() => { props.reload(); }} />
  </div>;
}

function Proposals({ list, reload }: { list: any[]; reload: () => void }) {
  const [err, setErr] = useState<Record<string, string>>({});
  async function decide(p: any, accept: boolean, remember = false) {
    try { await api(`/agent/proposals/${p.id}/${accept ? "accept" : "reject"}`, { body: { remember } }); toast(accept ? "Proposition appliquée" : "Proposition refusée"); reload(); }
    catch (e: any) { setErr({ ...err, [p.id]: [e.message, ...(e.data?.details ?? [])].join(" — ") }); }
  }
  if (!list.length) return null;
  return <div className="stack"><h2>Propositions en attente</h2>{list.map((p) => <div className="card" key={p.id}>
    <div className="row spread"><b>{{ recipe_draft: "Brouillon de recette", routine_draft: "Brouillon de routine", week_priorities: "Priorités de la semaine", memory_fact: "Mémoriser un fait" }[p.kind as string]}</b><span className="badge warn">à valider</span></div>
    {p.kind === "recipe_draft" && <><p><b>{p.payload.title}</b> · {p.payload.time_min} min · {p.payload.servings} portion(s)</p><ul>{p.payload.ingredients.map((i: any) => <li key={i.key}>{i.name} — {i.qty} {i.unit}</li>)}</ul><p className="small">{p.payload.steps}</p></>}
    {p.kind === "routine_draft" && <><p><b>{p.payload.name}</b> · ≈ {p.payload.estimated_min} min</p><ul>{p.payload.items.map((i: any) => <li key={i.slug}>{i.name} — {i.sets} séries, repos {i.rest} s (répétitions et charges à définir par vous)</li>)}</ul></>}
    {p.kind === "week_priorities" && p.payload.items.map((i: any, k: number) => <div className="item" key={k}><div className="grow"><b>{i.action}</b><div className="small muted">Effort : {i.effort} · Créneau : {i.slot}</div><div className="small">Pourquoi : {i.reason}</div>{i.short_option && <div className="small muted">{i.short_option}</div>}{i.postpone_option && <div className="small muted">{i.postpone_option}</div>}</div></div>)}
    {p.kind === "memory_fact" && <p>« {p.payload.fact} »</p>}
    <p className="small muted">{p.rationale}</p>{p.uses.length > 0 && <p className="small muted">Utilisé : {p.uses.join(" · ")}</p>}
    {err[p.id] && <Notice kind="err">{err[p.id]}</Notice>}
    <div className="row"><button className="primary" onClick={() => decide(p, true)}>{p.kind === "week_priorities" ? "Accepter" : p.kind === "memory_fact" ? "Mémoriser" : "Accepter et créer"}</button><button onClick={() => decide(p, false)}>Refuser</button><button className="ghost" onClick={() => decide(p, false, true)}>Refuser et retenir ma préférence</button></div></div>)}</div>;
}

function Memory({ enabled }: { enabled: boolean }) {
  const { data, error, reload } = useApi<any>("/agent/memory");
  const [fact, setFact] = useState(""), [edit, setEdit] = useState<{ id: string; v: string } | null>(null);
  const me = useMe();
  return <div className="stack">
    <div className="card"><p className="small muted">Voici les faits que l’agent peut utiliser. Une inférence (ex. « tu préfères les séances courtes ») n’est mémorisée qu’après votre confirmation. Vous pouvez corriger, effacer ou désactiver la mémorisation.</p>
      <label className="chk"><input type="checkbox" checked={enabled} onChange={async (e) => { await api("/me/memory", { body: { enabled: e.target.checked } }); location.reload(); }} />Autoriser la mémorisation</label></div>
    {error && <ErrorBox error={error} retry={reload} />}
    <div className="card">{data?.facts.length === 0 && <Empty>Aucun fait mémorisé.</Empty>}
      {data?.facts.map((f: any) => <div className="item" key={f.id}>
        <div className="grow">{edit?.id === f.id ? <input aria-label="Fait" value={edit!.v} onChange={(e) => setEdit({ id: f.id, v: e.target.value })} /> : <>{f.fact}<div className="small muted">{f.source} · {f.created_at.slice(0, 10)}</div></>}</div>
        {edit?.id === f.id ? <button className="primary" onClick={async () => { await api(`/agent/memory/${f.id}`, { method: "PUT", body: { fact: edit!.v } }); setEdit(null); reload(); }}>OK</button> : <button onClick={() => setEdit({ id: f.id, v: f.fact })}>Corriger</button>}
        <button className="danger" aria-label="Effacer" onClick={async () => { await api(`/agent/memory/${f.id}`, { method: "DELETE" }); reload(); }}>✕</button></div>)}
      <div className="row" style={{ marginTop: 10 }}><input className="grow" aria-label="Ajouter un fait" placeholder="Ajouter un fait vous concernant…" value={fact} onChange={(e) => setFact(e.target.value)} maxLength={300} /><button disabled={!fact.trim()} onClick={async () => { await api("/agent/memory", { body: { fact } }); setFact(""); reload(); }}>Ajouter</button></div>
      {data?.facts.length > 0 && <button className="danger" style={{ marginTop: 10 }} onClick={async () => { if (confirm("Effacer toute la mémoire ?")) { await api("/agent/memory", { method: "DELETE" }); reload(); } }}>Tout effacer</button>}</div>
    <p className="small muted">{me.email} · la mémoire est exportée et supprimée avec votre compte.</p>
  </div>;
}
void nf;
