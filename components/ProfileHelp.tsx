"use client";
// Aides à la saisie du profil : explications par section, exemples « utilisables », suggestions cliquables.
import { useState, type ReactNode } from "react";

export const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function Section({ n, title, tag, why, uses, children }: { n: number; title: string; tag: "essentiel" | "facultatif"; why: string; uses?: string; children: ReactNode }) {
  return (
    <section className="card psec">
      <div className="row spread" style={{ alignItems: "flex-start" }}>
        <div className="row" style={{ gap: ".7rem", alignItems: "flex-start" }}>
          <span className="pnum" aria-hidden="true">{n}</span>
          <div><h2 style={{ margin: 0 }}>{title}</h2></div>
        </div>
        <span className={`badge ${tag === "essentiel" ? "acc" : ""}`}>{tag === "essentiel" ? "l’essentiel" : "facultatif"}</span>
      </div>
      <p className="muted" style={{ margin: ".6rem 0 .2rem" }}>{why}</p>
      {uses && <p className="small phelp"><b>Ce que l’agent en fait :</b> {uses}</p>}
      <div style={{ marginTop: 14 }}>{children}</div>
    </section>
  );
}

/** Champ texte avec consigne, exemple à reprendre en un clic et, pour les listes, des suggestions à cocher. */
export function HelpField({ label, value, onChange, hint, example, placeholder, suggestions, list, type = "text", inputMode, rows }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string; example?: string; placeholder?: string; suggestions?: string[]; list?: boolean; type?: string; inputMode?: "numeric" | "decimal"; rows?: number;
}) {
  const [showEx, setShowEx] = useState(false);
  const current = list ? splitList(value) : [];
  const has = (t: string) => current.some((c) => norm(c) === norm(t));
  const toggle = (t: string) => onChange(has(t) ? current.filter((c) => norm(c) !== norm(t)).join(", ") : [...current, t].join(", "));
  const id = "f-" + norm(label).replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {rows ? <textarea id={id} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /> : <input id={id} type={type} inputMode={inputMode} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}
      {hint && <p className="small phelp">{hint}</p>}
      {suggestions && <div className="chips" role="group" aria-label={`Suggestions pour ${label}`}>{suggestions.map((s) => <button type="button" key={s} className="chip-b" aria-pressed={has(s)} onClick={() => toggle(s)}>{has(s) ? "✓ " : "+ "}{s}</button>)}</div>}
      {example && <div className="small" style={{ marginTop: 6 }}>
        <button type="button" className="ghost" style={{ minHeight: 32, padding: ".1rem .5rem" }} onClick={() => setShowEx(!showEx)} aria-expanded={showEx}>{showEx ? "Masquer l’exemple" : "Voir un exemple"}</button>
        {showEx && <div className="example"><span>{example}</span> <button type="button" className="ghost" style={{ minHeight: 32 }} onClick={() => { onChange(example); setShowEx(false); }}>Utiliser</button></div>}
      </div>}
    </div>
  );
}

export function Choice({ label, value, onChange, options, hint }: { label: string; value: string; onChange: (v: string) => void; options: [string, string, string][]; hint?: string }) {
  const sel = options.find((o) => o[0] === value);
  return (
    <div className="field">
      <label>{label}</label>
      <div className="chips" role="radiogroup" aria-label={label}>{options.map(([v, l]) => <button type="button" key={v || "none"} role="radio" aria-checked={value === v} className="chip-b" onClick={() => onChange(v)}>{l}</button>)}</div>
      <p className="small phelp">{sel?.[2] ?? hint}</p>
    </div>
  );
}

export function Completeness({ done, total, missing }: { done: number; total: number; missing: string[] }) {
  const pct = Math.round((done / total) * 100);
  return (
    <div className="card" style={{ marginBottom: 6 }}>
      <div className="row spread"><b>{done === total ? "L’essentiel est renseigné" : `L’essentiel : ${done} sur ${total}`}</b><span className="small muted">{pct} %</span></div>
      <div className="bar" role="progressbar" aria-label="Profil renseigné" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} style={{ margin: "8px 0" }}><i style={{ width: `${Math.max(pct, 4)}%` }} /></div>
      <p className="small muted">{done === total ? "Le reste est facultatif : plus vous en dites, plus les propositions collent à votre quotidien. Rien n’est obligatoire, vous pouvez aussi tout laisser vide." : `Pour de meilleures propositions, il manque : ${missing.join(", ")}. Tout est modifiable à tout moment, et l’agent ne devine jamais à votre place.`}</p>
    </div>
  );
}
