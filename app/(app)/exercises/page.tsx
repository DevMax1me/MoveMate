"use client";
import { useState } from "react";
import { api, useApi } from "@/lib/client";
import { ErrorBox, Empty, Field, Modal, Notice, toast } from "@/components/ui";
import { EQUIPMENT } from "@/lib/equipment";
import { MUSCLE_GROUPS, groupById, groupsOf } from "@/lib/muscles";
import { PATTERN_CHOICES } from "@/lib/figures";
import BodyMap from "@/components/BodyMap";
import MoveFigure, { FigureStrip } from "@/components/MoveFigure";

const PAGE = 36;

export default function Exercises() {
  const [q, setQ] = useState(""), [place, setPlace] = useState(""), [type, setType] = useState(""), [level, setLevel] = useState(""), [eq, setEq] = useState(""), [compat, setCompat] = useState(false), [muscle, setMuscle] = useState(""), [shown, setShown] = useState(PAGE);
  const qs = new URLSearchParams({ q, place, type, level, equipment: eq, muscle, compatible: compat ? "1" : "" }); for (const [k, v] of [...qs]) if (!v) qs.delete(k);
  const { data, error, reload } = useApi<any>(`/exercises?${qs}`);
  const [sel, setSel] = useState<string | null>(null), [create, setCreate] = useState(false);
  const facets: Record<string, number> = data?.facets ?? {};
  const pick = (id: string | null) => { setMuscle(id ?? ""); setShown(PAGE); };
  const active = [place, type, level, eq].filter(Boolean).length + (compat ? 1 : 0);
  const group = muscle ? groupById(muscle) : null;
  const reset = () => { setQ(""); setPlace(""); setType(""); setLevel(""); setEq(""); setCompat(false); setMuscle(""); setShown(PAGE); };
  return <div>
    <div className="row spread"><h1 style={{ margin: 0 }}>Exercices</h1><button className="primary" onClick={() => setCreate(true)}>＋ Exercice privé</button></div>
    <p className="muted small">{data ? <b>{data.total} exercice{data.total > 1 ? "s" : ""}</b> : "…"} · salle, maison, avec ou sans matériel. Choisissez d’abord le muscle, puis reconnaissez le mouvement grâce au schéma.</p>

    <section className="card mfilter" aria-label="Filtrer par muscle">
      <h2 style={{ marginTop: 0 }}>Quel muscle voulez-vous travailler ?</h2>
      <p className="muted small">Touchez une zone du corps ou une pastille. Le nombre indique les exercices disponibles avec vos autres filtres.</p>
      <div className="mfilter-body">
        <div className="chips" role="group" aria-label="Muscles" style={{ marginTop: 0 }}>
          <button type="button" className="chip-b" aria-pressed={!muscle} onClick={() => pick(null)}>Tous{data ? ` · ${data.total}` : ""}</button>
          {MUSCLE_GROUPS.filter((g) => facets[g.id] || muscle === g.id).map((g) => <button type="button" key={g.id} className="chip-b" aria-pressed={muscle === g.id} onClick={() => pick(muscle === g.id ? null : g.id)}>{g.label} · {facets[g.id] ?? 0}</button>)}
        </div>
        <BodyMap selected={muscle || null} onSelect={pick} counts={facets} />
      </div>
    </section>

    <div className="row" style={{ margin: "12px 0 8px", gap: ".6rem", flexWrap: "wrap" }}>
      <input type="search" style={{ flex: "1 1 220px" }} placeholder="Nom, matériel ou mot de salle : « rowing poulie », « iso lat »…" aria-label="Rechercher" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} />
    </div>
    <details className="morefilters" open={active > 0 || undefined}>
      <summary>Plus de filtres{active ? ` (${active})` : ""}</summary>
      <div className="grid g3" style={{ margin: "8px 0" }}>
        <select aria-label="Lieu" value={place} onChange={(e) => { setPlace(e.target.value); setShown(PAGE); }}><option value="">Maison + salle</option><option value="home">Maison</option><option value="gym">Salle</option></select>
        <select aria-label="Type de mouvement" value={type} onChange={(e) => { setType(e.target.value); setShown(PAGE); }}><option value="">Tous types</option>{["poussée", "tirage", "jambes", "tronc", "cardio", "mobilité"].map((t) => <option key={t}>{t}</option>)}</select>
        <select aria-label="Niveau" value={level} onChange={(e) => { setLevel(e.target.value); setShown(PAGE); }}><option value="">Tous niveaux</option>{["débutant", "intermédiaire", "avancé"].map((t) => <option key={t}>{t}</option>)}</select>
        <select aria-label="Matériel" value={eq} onChange={(e) => { setEq(e.target.value); setShown(PAGE); }}><option value="">Tout matériel</option><option value="none">Sans matériel</option>{["haltères", "kettlebell", "barre", "banc", "rack", "smith", "poulie", "machine", "barre de traction", "barres parallèles", "anneaux", "élastique", "swiss ball", "medecine ball", "roue abdominale", "step", "vélo", "rameur", "tapis"].map((t) => <option key={t}>{t}</option>)}</select>
        <label className="chk"><input type="checkbox" checked={compat} onChange={(e) => { setCompat(e.target.checked); setShown(PAGE); }} />Compatibles avec mon matériel</label>
      </div>
    </details>

    <p className="small" aria-live="polite" style={{ margin: "8px 0" }}>
      {data && <><b>{data.exercises.length}</b> résultat{data.exercises.length > 1 ? "s" : ""}{group ? <> pour <b>{group.label}</b></> : null}{(muscle || q || active) ? <> · <button className="ghost" onClick={reset}>Tout réinitialiser</button></> : null}</>}
    </p>
    {error && <ErrorBox error={error} retry={reload} />}
    {data?.exercises.length === 0 && <Empty>Aucun exercice ne correspond à ces filtres.<div style={{ marginTop: 8 }} className="row"><button onClick={reset}>Réinitialiser</button>{q.trim() && <button className="primary" onClick={() => setCreate(true)}>Créer « {q.trim()} » en exercice privé</button>}</div></Empty>}

    <div className="exgrid">{data?.exercises.slice(0, shown).map((e: any) => <button key={e.id} className="card excard" style={{ textAlign: "left", display: "block", width: "100%" }} onClick={() => setSel(e.ex_key)} aria-label={`${e.name} : voir le détail`}>
      <FigureStrip ex={e} />
      <h3>{e.name}</h3>{e.alias && <div className="muted small">{e.alias}</div>}
      <div className="small muted">{e.primary_muscles.join(", ")} · {e.level}</div>
      <div className="row" style={{ marginTop: 6, gap: ".3rem" }}>
        {e.secondaryOnly && <span className="badge acc">muscle secondaire</span>}
        {e.place !== "gym" && <span className="badge">maison</span>}{e.place !== "home" && <span className="badge">salle</span>}
        <span className="badge">{e.equipment.length ? e.equipment.join(", ") : "sans matériel"}</span>
        {!e.compatible && <span className="badge warn">matériel manquant</span>}{e.private && <span className="badge acc">privé</span>}
      </div></button>)}</div>
    {data && data.exercises.length > shown && <div className="row" style={{ justifyContent: "center", marginTop: 18 }}><button onClick={() => setShown(shown + PAGE)}>Afficher plus ({data.exercises.length - shown} restants)</button></div>}
    <p className="muted small" style={{ marginTop: 18 }}>Le catalogue décrit des mouvements ; il ne constitue pas un programme prescrit. « Maison » ne signifie pas toujours « sans matériel » : la compatibilité dépend du matériel déclaré dans votre profil.</p>
    {sel && <Detail k={sel} onClose={() => setSel(null)} onPick={setSel} />}
    {create && <CreateEx initialName={q.trim()} onClose={() => setCreate(false)} onSaved={() => { setCreate(false); reload(); }} />}
  </div>;
}

function Detail({ k, onClose, onPick }: { k: string; onClose: () => void; onPick: (k: string) => void }) {
  const { data, reload } = useApi<any>(`/exercises/${k}`);
  const [report, setReport] = useState(false), [msg, setMsg] = useState("");
  if (!data) return <Modal title="Exercice" onClose={onClose}><p className="muted">Chargement…</p></Modal>;
  const e = data.exercise;
  const prim = groupsOf(e.primary_muscles), sec = groupsOf(e.secondary_muscles).filter((g) => !prim.includes(g));
  return <Modal title={e.name} onClose={onClose}>
    <MoveFigure key={e.ex_key} ex={e} />
    <div className="grid g2" style={{ marginTop: 14, alignItems: "center" }}>
      <BodyMap compact primary={prim} secondary={sec} />
      <div>
        <p style={{ margin: 0 }}><b>Muscles travaillés</b></p>
        <p className="small" style={{ margin: ".2rem 0" }}>Principal : {e.primary_muscles.join(", ") || "—"}</p>
        {e.secondary_muscles.length > 0 && <p className="small muted" style={{ margin: ".2rem 0" }}>Secondaire : {e.secondary_muscles.join(", ")}</p>}
        <p className="small muted" style={{ margin: ".4rem 0 0" }}>{e.movement} · {e.level} · suivi : {{ reps_load: "répétitions et charge", time: "durée", distance: "durée et distance" }[e.metric as string]}</p>
      </div>
    </div>
    <p style={{ marginTop: 10 }}><span className="badge">{e.equipment.length ? e.equipment.join(", ") : "sans matériel"}</span> {e.place !== "gym" && <span className="badge">maison</span>} {e.place !== "home" && <span className="badge">salle</span>}</p>
    {!e.compatible && <Notice>Matériel manquant dans votre profil : {e.missing.join(", ")}.</Notice>}

    <h3>Exécution</h3><p>{e.steps}</p><h3>Erreurs fréquentes</h3><p>{e.mistakes}</p>

    <VideoBlock exKey={e.ex_key} name={e.name} media={data.media} onChange={reload} />

    {data.similar?.length > 0 && <>
      <h3>Exercices qui ressemblent à celui-ci</h3>
      <p className="muted small">Même zone du corps et même type de mouvement. Utile pour vérifier que vous parlez bien du bon exercice, ou pour trouver une variante avec votre matériel.</p>
      <div className="similar">{data.similar.map((s: any) => <button key={s.ex_key} className="card" onClick={() => onPick(s.ex_key)} aria-label={`Voir ${s.name}`}><FigureStrip ex={s} /><b className="small">{s.name}</b>{!s.compatible && <div><span className="badge warn">matériel manquant</span></div>}</button>)}</div>
    </>}
    {data.easier && <p>Variante plus simple : <button className="ghost" onClick={() => onPick(data.easier.ex_key)}>{data.easier.name}</button></p>}
    {data.alternative && <p>Alternative selon le matériel : <button className="ghost" onClick={() => onPick(data.alternative.ex_key)}>{data.alternative.name}</button></p>}
    <p className="small muted">Cette fiche décrit un mouvement ; elle ne prescrit ni série, ni intensité, ni repos.</p>
    {!report ? <button className="ghost" onClick={() => setReport(true)}>Signaler une erreur</button> : <div><Field label="Votre signalement"><textarea value={msg} onChange={(x) => setMsg(x.target.value)} /></Field><button onClick={async () => { await api("/reports", { body: { kind: "exercise", ref_id: e.ex_key, message: msg } }).then(() => { toast("Merci, signalement transmis"); setReport(false); }).catch((x) => toast(x.message)); }}>Envoyer</button></div>}
  </Modal>;
}

type Embed = { kind: "youtube" | "vimeo" | "file" | "link"; src: string } | null;

/** Le lecteur ne se charge qu'après un clic : tant que vous ne lancez rien, aucun site tiers n'est contacté. */
function Player({ embed, title }: { embed: NonNullable<Embed>; title: string }) {
  const [on, setOn] = useState(false);
  if (embed.kind === "link") return <p><a className="btn" href={embed.src} target="_blank" rel="noopener noreferrer">Ouvrir la vidéo ↗</a> <span className="small muted">(ce site ne permet pas la lecture ici)</span></p>;
  if (!on) return <button className="vid vid-start" onClick={() => setOn(true)} aria-label={`Lire la vidéo : ${title}`}>
    <span className="play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5l12 7-12 7z" /></svg></span>
    <span className="small">Lire la vidéo ici</span>
    <span className="small vid-note">{embed.kind === "file" ? "Fichier vidéo externe" : embed.kind === "youtube" ? "Chargée depuis YouTube (mode sans cookies)" : "Chargée depuis Vimeo"} — rien n’est contacté avant votre clic.</span>
  </button>;
  return <div className="vid">{embed.kind === "file"
    ? <video src={embed.src} controls playsInline preload="metadata" title={title} />
    : <iframe src={embed.src} title={title} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" />}</div>;
}

function VideoBlock({ exKey, name, media, onChange }: { exKey: string; name: string; media: { public: any; mine: any; search: string }; onChange: () => void }) {
  const [url, setUrl] = useState(""), [title, setTitle] = useState(""), [err, setErr] = useState<string | null>(null), [edit, setEdit] = useState(false);
  const pub = media.public, mine = media.mine;
  const save = async () => { setErr(null); try { await api(`/exercises/${exKey}/media`, { body: { url, title } }); toast("Lien enregistré"); setUrl(""); setTitle(""); setEdit(false); onChange(); } catch (x: any) { setErr(x.message); } };
  const remove = async () => { await api(`/exercises/${exKey}/media`, { method: "DELETE" }).then(() => { toast("Lien retiré"); onChange(); }).catch((x) => toast(x.message)); };
  return <section aria-label="Vidéo">
    <h3>Voir le mouvement en vidéo</h3>
    {pub?.embed && <>
      <Player embed={pub.embed} title={`Vidéo : ${name}`} />
      <p className="small muted">Média : <a href={pub.url} rel="noopener noreferrer" target="_blank">{pub.source}</a> — {pub.author}, {pub.license}</p>
    </>}
    {mine?.embed && <>
      <p className="small" style={{ marginBottom: 4 }}><b>Ma vidéo{mine.title ? ` : ${mine.title}` : ""}</b></p>
      <Player embed={mine.embed} title={`Ma vidéo : ${name}`} />
      <p className="small muted">Lien ajouté par vous, visible de vous seul. <button className="ghost" onClick={remove}>Retirer</button></p>
    </>}
    {!pub && !mine && <p className="small muted">Aucune vidéo n’est fournie avec cette fiche : nous n’hébergeons pas de vidéos d’autres personnes. Cherchez-en une, puis collez le lien ci-dessous pour la regarder ici, dans l’application.</p>}
    <div className="row" style={{ gap: ".5rem", flexWrap: "wrap" }}>
      <a className="btn" href={media.search} target="_blank" rel="noopener noreferrer">Chercher une vidéo sur YouTube ↗</a>
      {!edit && <button onClick={() => setEdit(true)}>{mine ? "Changer mon lien" : "Coller un lien de vidéo"}</button>}
    </div>
    {edit && <div style={{ marginTop: 10 }}>
      {err && <Notice kind="err">{err}</Notice>}
      <Field label="Lien de la vidéo" hint="YouTube, Vimeo ou fichier .mp4 / .webm en https"><input type="url" inputMode="url" placeholder="https://www.youtube.com/watch?v=…" value={url} onChange={(e) => setUrl(e.target.value)} /></Field>
      <Field label="Titre" hint="facultatif, pour vous y retrouver"><input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></Field>
      <div className="row"><button className="primary" onClick={save} disabled={!url.trim()}>Enregistrer pour moi</button><button className="ghost" onClick={() => setEdit(false)}>Annuler</button></div>
      <p className="small muted">Le lien reste privé. Vous n’êtes pas autorisé à republier la vidéo d’un tiers : seul le lien est conservé.</p>
    </div>}
  </section>;
}

function CreateEx({ initialName = "", onClose, onSaved }: { initialName?: string; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({ name: initialName, movement: "autre", primary_muscles: "", equipment: "", place: "both", level: "débutant", metric: "reps_load", steps: "", pattern: "" }), [err, setErr] = useState<string | null>(null);
  const s = (k: string, v: string) => setF({ ...f, [k]: v });
  const muscles: string[] = f.primary_muscles.split(",").map((x: string) => x.trim()).filter(Boolean);
  const toggleMuscle = (label: string) => s("primary_muscles", (muscles.includes(label) ? muscles.filter((x) => x !== label) : [...muscles, label]).join(", "));
  return <Modal title="Exercice privé" onClose={onClose}>
    {err && <Notice kind="err">{err}</Notice>}
    <Field label="Nom"><input value={f.name} onChange={(e) => s("name", e.target.value)} /></Field>
    <div className="inline"><Field label="Mouvement"><input value={f.movement} onChange={(e) => s("movement", e.target.value)} /></Field><Field label="Lieu"><select value={f.place} onChange={(e) => s("place", e.target.value)}><option value="both">Maison et salle</option><option value="home">Maison</option><option value="gym">Salle</option></select></Field></div>
    <Field label="Muscles principaux" hint="touchez pour choisir">
      <div className="chips">{MUSCLE_GROUPS.filter((g) => g.map).map((g) => { const on = muscles.includes(g.label); return <button type="button" key={g.id} className="chip-b" aria-pressed={on} onClick={() => toggleMuscle(g.label)}>{on ? "✓ " : "+ "}{g.label}</button>; })}</div>
    </Field>
    <Field label="Schéma du mouvement" hint="choisissez ce qui y ressemble le plus : le schéma de la fiche en dépend">
      <select value={f.pattern} onChange={(e) => s("pattern", e.target.value)}><option value="">Automatique (selon le nom)</option>{PATTERN_CHOICES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
    </Field>
    <Field label="Matériel nécessaire" hint="ne cochez rien si aucun"><div className="chips">{EQUIPMENT.map((m) => { const on = f.equipment.split(",").map((x: string) => x.trim()).includes(m); return <button type="button" key={m} className="chip-b" aria-pressed={on} onClick={() => s("equipment", (on ? f.equipment.split(",").map((x: string) => x.trim()).filter((x: string) => x && x !== m) : [...f.equipment.split(",").map((x: string) => x.trim()).filter(Boolean), m]).join(","))}>{on ? "✓ " : "+ "}{m}</button>; })}</div></Field>
    <div className="inline"><Field label="Suivi"><select value={f.metric} onChange={(e) => s("metric", e.target.value)}><option value="reps_load">répétitions et charge</option><option value="time">durée</option><option value="distance">distance</option></select></Field><Field label="Niveau"><select value={f.level} onChange={(e) => s("level", e.target.value)}><option>débutant</option><option>intermédiaire</option><option>avancé</option></select></Field></div>
    <Field label="Exécution" hint="facultatif"><textarea value={f.steps} onChange={(e) => s("steps", e.target.value)} /></Field>
    <button className="primary" onClick={async () => { try { await api("/exercises", { body: f }); toast("Exercice créé"); onSaved(); } catch (e: any) { setErr(e.message); } }}>Créer</button></Modal>;
}
