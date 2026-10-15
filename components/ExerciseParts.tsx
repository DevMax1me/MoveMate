"use client";
import { useMemo, useState } from "react";
import { useApi } from "@/lib/client";
import { Modal } from "@/components/ui";
import BodyMap from "@/components/BodyMap";
import MoveFigure, { FigureStrip } from "@/components/MoveFigure";
import { MUSCLE_GROUPS, groupsOf } from "@/lib/muscles";
import { explain } from "@/lib/explain";
import { eqLabel } from "@/lib/equipment";

/** Fiches abrégées des exercices déjà choisis (routine, séance) pour afficher schéma, muscles et explication. */
export function useBrief(keys: string[]) {
  const k = [...new Set(keys.filter(Boolean))].sort().join(",");
  const { data } = useApi<{ brief: Record<string, any> }>(k ? `/exercise-brief?keys=${encodeURIComponent(k)}` : null);
  return data?.brief ?? {};
}

/** « C'est quoi cet exercice ? » : schéma animé, muscles, explication en langage courant, mots du nom expliqués, exécution. */
export function ExerciseInfo({ ex }: { ex: any }) {
  const x = useMemo(() => explain(ex), [ex]);
  const prim = groupsOf(ex.primary_muscles ?? []), sec = groupsOf(ex.secondary_muscles ?? []).filter((g) => !prim.includes(g));
  return <div className="exinfo">
    <MoveFigure key={ex.ex_key} ex={ex} />
    <h4>En clair</h4>
    <p style={{ margin: "0 0 .3rem" }}>{x.summary}</p>
    {x.how && <p className="small muted" style={{ margin: 0 }}>{x.how}</p>}
    <div className="grid g2" style={{ marginTop: 10, alignItems: "center" }}>
      <BodyMap compact primary={prim} secondary={sec} />
      <div className="small">
        <div><b>Principal :</b> {(ex.primary_muscles ?? []).join(", ") || "—"}</div>
        {ex.secondary_muscles?.length > 0 && <div className="muted"><b>Secondaire :</b> {ex.secondary_muscles.join(", ")}</div>}
      </div>
    </div>
    {x.terms.length > 0 && <><h4>Les mots du nom, expliqués</h4><dl className="terms">{x.terms.map((t) => <div key={t.term}><dt>{t.term}</dt><dd>{t.def}</dd></div>)}</dl></>}
    {ex.steps && <><h4>Comment le faire</h4><p style={{ margin: 0 }}>{ex.steps}</p></>}
    {ex.mistakes && <><h4>Erreurs fréquentes</h4><p style={{ margin: 0 }}>{ex.mistakes}</p></>}
  </div>;
}

/** Ligne compacte pour une routine ou une séance : schéma, muscles et « c'est quoi ? » repliable. */
export function ExerciseRecap({ ex }: { ex: any | undefined }) {
  const x = useMemo(() => (ex ? explain(ex) : null), [ex]);
  if (!ex || !x) return null;
  return <details className="recap">
    <summary>
      <span className="recap-strip"><FigureStrip ex={ex} /></span>
      <span className="small" style={{ minWidth: 0 }}><b>{(ex.primary_muscles ?? []).join(", ")}</b><span className="clamp2 muted" style={{ display: "-webkit-box" }}>{x.summary}</span><span className="recap-more">Voir le mouvement ▾</span></span>
    </summary>
    <ExerciseInfo ex={ex} />
  </details>;
}

const PICK = 30;

/** Choix d'un exercice pour une routine ou une séance : on part du muscle, on reconnaît le mouvement au schéma, on lit l'explication avant de choisir. */
export function ExercisePicker({ onPick, onClose }: { onPick: (e: any) => void; onClose: () => void }) {
  const [q, setQ] = useState(""), [muscle, setMuscle] = useState(""), [compat, setCompat] = useState(false), [open, setOpen] = useState<string | null>(null), [shown, setShown] = useState(PICK);
  const qs = new URLSearchParams({ q: q.trim(), muscle, compatible: compat ? "1" : "" }); for (const [k, v] of [...qs]) if (!v) qs.delete(k);
  const { data } = useApi<any>(`/exercises?${qs}`);
  const facets: Record<string, number> = data?.facets ?? {};
  return <Modal title="Choisir un exercice" onClose={onClose}>
    <p className="muted small" style={{ marginTop: 0 }}>Commencez par le muscle que vous voulez travailler, puis regardez le schéma : « C’est quoi ? » explique chaque exercice en mots simples.</p>
    <div className="chips" role="group" aria-label="Muscle" style={{ marginTop: 0 }}>
      <button type="button" className="chip-b" aria-pressed={!muscle} onClick={() => { setMuscle(""); setShown(PICK); }}>Tous</button>
      {MUSCLE_GROUPS.filter((g) => facets[g.id] || muscle === g.id).map((g) => <button type="button" key={g.id} className="chip-b" aria-pressed={muscle === g.id} onClick={() => { setMuscle(muscle === g.id ? "" : g.id); setShown(PICK); }}>{g.label} · {facets[g.id] ?? 0}</button>)}
    </div>
    <input type="search" style={{ marginTop: 10 }} placeholder="Nom ou mot de salle : « rowing », « iso lat », « presse »…" aria-label="Rechercher un exercice" value={q} onChange={(e) => { setQ(e.target.value); setShown(PICK); }} />
    <label className="chk" style={{ margin: "6px 0" }}><input type="checkbox" checked={compat} onChange={(e) => { setCompat(e.target.checked); setShown(PICK); }} />Seulement ce que mon matériel permet</label>
    {data && <p className="small muted" aria-live="polite" style={{ margin: "4px 0 8px" }}>{data.exercises.length} exercice{data.exercises.length > 1 ? "s" : ""}</p>}
    {data?.exercises.length === 0 && <p className="muted">Aucun exercice ne correspond. Essayez un autre mot ou retirez un filtre.</p>}
    {data?.exercises.slice(0, shown).map((e: any) => {
      const x = explain(e), isOpen = open === e.ex_key;
      return <div className="pickrow" key={e.id}>
        <div className="pickhead">
          <div className="pickstrip"><FigureStrip ex={e} /></div>
          <div style={{ minWidth: 0 }}>
            <b>{e.name}</b>{e.alias && <span className="muted small"> · {e.alias}</span>}
            <div className="small muted">{(e.primary_muscles ?? []).join(", ")} · {e.level}</div>
            <p className="small clamp2" style={{ margin: ".2rem 0" }}>{x.summary}</p>
            <div className="row" style={{ gap: ".3rem" }}><span className="badge">{eqLabel(e.equipment)}</span>{e.secondaryOnly && <span className="badge acc">muscle secondaire</span>}{!e.compatible && <span className="badge warn">matériel manquant</span>}</div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : e.ex_key)}>{isOpen ? "Masquer" : "C’est quoi ?"}</button>
          <button className="primary" onClick={() => onPick(e)}>Choisir</button>
        </div>
        {isOpen && <ExerciseInfo ex={e} />}
      </div>;
    })}
    {data && data.exercises.length > shown && <div className="row" style={{ justifyContent: "center", marginTop: 12 }}><button onClick={() => setShown(shown + PICK)}>Afficher plus ({data.exercises.length - shown})</button></div>}
  </Modal>;
}
