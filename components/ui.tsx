"use client";
import { useEffect, useState, type ReactNode } from "react";

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row spread"><h2 style={{ margin: 0 }}>{title}</h2><button className="ghost" onClick={onClose} aria-label="Fermer">✕</button></div>
        <div style={{ marginTop: 10 }}>{children}</div>
      </div>
    </div>
  );
}
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <div className="field"><label>{label}{hint && <span className="small"> — {hint}</span>}</label>{children}</div>;
}
export const Notice = ({ kind = "warn", children }: { kind?: "warn" | "err" | "okk" | "info"; children: ReactNode }) => <div className={`notice ${kind === "warn" ? "" : kind}`} role={kind === "err" ? "alert" : "status"}>{children}</div>;
export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>;
export const Loading = () => <p className="muted" role="status">Chargement…</p>;
export const ErrorBox = ({ error, retry }: { error: string; retry?: () => void }) => <div className="notice err" role="alert">{error} {retry && <button onClick={retry}>Réessayer</button>}</div>;

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: [T, string][]; value: T; onChange: (v: T) => void }) {
  return <div className="tabs" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={value === k} onClick={() => onChange(k)}>{l}</button>)}</div>;
}

let pushToast: (m: string) => void = () => {};
export const toast = (m: string) => pushToast(m);
export function Toaster() {
  const [m, setM] = useState<string | null>(null);
  useEffect(() => { pushToast = (x) => { setM(x); setTimeout(() => setM(null), 3500); }; }, []);
  return m ? <div className="toast" role="status" aria-live="polite">{m}</div> : null;
}

// ---------- Graphiques SVG (lisibles en mode sombre, jamais de couleur seule) ----------
type Pt = { x: number; y: number | null };
export function LineChart({ labels, series, height = 180, unit = "", yMin, yMax }: { labels: string[]; series: { name: string; color: string; values: (number | null)[]; dashed?: boolean; points?: boolean }[]; height?: number; unit?: string; yMin?: number; yMax?: number }) {
  const W = 600, H = height, pl = 36, pr = 8, pt = 10, pb = 22;
  const vals = series.flatMap((s) => s.values).filter((v): v is number => v != null);
  if (!vals.length) return <p className="empty">Pas encore de données sur cette période.</p>;
  let lo = yMin ?? Math.min(...vals), hi = yMax ?? Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.1; if (yMin == null) lo -= pad; if (yMax == null) hi += pad;
  const n = Math.max(labels.length - 1, 1);
  const X = (i: number) => pl + ((W - pl - pr) * i) / n, Y = (v: number) => pt + (H - pt - pb) * (1 - (v - lo) / (hi - lo));
  const ticks = [lo, (lo + hi) / 2, hi];
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Graphique : ${series.map((s) => s.name).join(", ")}`}>
      {ticks.map((t, i) => <g key={i}><line x1={pl} x2={W - pr} y1={Y(t)} y2={Y(t)} stroke="var(--border)" /><text x={pl - 4} y={Y(t) + 3} textAnchor="end">{t.toFixed(1)}{unit}</text></g>)}
      {[0, Math.floor(n / 2), n].filter((v, i, a) => a.indexOf(v) === i).map((i) => <text key={i} x={X(i)} y={H - 6} textAnchor="middle">{labels[i]}</text>)}
      {series.map((s) => {
        const segs: Pt[][] = []; let cur: Pt[] = [];
        s.values.forEach((v, i) => { if (v == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push({ x: X(i), y: Y(v) }); });
        if (cur.length) segs.push(cur);
        return <g key={s.name}>
          {segs.map((sg, k) => sg.length > 1 && <polyline key={k} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? "5 4" : undefined} points={sg.map((p) => `${p.x},${p.y}`).join(" ")} />)}
          {s.points && s.values.map((v, i) => v != null && <circle key={i} cx={X(i)} cy={Y(v)} r={3.5} fill={s.color}><title>{`${labels[i]} : ${v.toFixed(1)}${unit}`}</title></circle>)}
        </g>;
      })}
    </svg>
  );
}
export function BarChart({ labels, values, partial, target, height = 160, unit = "" }: { labels: string[]; values: (number | null)[]; partial?: boolean[]; target?: (number | null)[]; height?: number; unit?: string }) {
  const W = 600, H = height, pl = 52, pb = 22, pt = 8;
  const max = Math.max(1, ...values.filter((v): v is number => v != null), ...((target ?? []).filter((v): v is number => v != null)));
  const bw = (W - pl - 8) / Math.max(values.length, 1);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Graphique en barres">
      <defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="6" fill="var(--c3)" /></pattern></defs>
      <line x1={pl} x2={W - 8} y1={H - pb} y2={H - pb} stroke="var(--border)" /><text x={pl - 4} y={pt + 8} textAnchor="end">{Math.round(max)}{unit}</text>
      {values.map((v, i) => {
        const x = pl + i * bw, h = v == null ? 0 : ((H - pb - pt) * v) / max;
        return <g key={i}>
          {v != null && <rect x={x + bw * 0.15} y={H - pb - h} width={bw * 0.7} height={h} fill={partial?.[i] ? "url(#hatch)" : "var(--c1)"} stroke={partial?.[i] ? "var(--c3)" : "none"}><title>{`${labels[i]} : ${Math.round(v)}${unit}${partial?.[i] ? " (incomplet)" : ""}`}</title></rect>}
          {v == null && <text x={x + bw / 2} y={H - pb - 4} textAnchor="middle">·</text>}
          {target?.[i] != null && <line x1={x} x2={x + bw} y1={H - pb - ((H - pb - pt) * target[i]!) / max} y2={H - pb - ((H - pb - pt) * target[i]!) / max} stroke="var(--c2)" strokeWidth={2} strokeDasharray="4 3" />}
          {(values.length <= 14 || i % Math.ceil(values.length / 8) === 0) && <text x={x + bw / 2} y={H - 6} textAnchor="middle">{labels[i]}</text>}
        </g>;
      })}
    </svg>
  );
}
export const Legend = ({ items }: { items: { color: string; label: string; dashed?: boolean; hatched?: boolean }[] }) => (
  <div className="row small muted" style={{ gap: ".9rem" }}>{items.map((i) => <span key={i.label}><svg width="22" height="8" aria-hidden="true"><line x1="0" x2="22" y1="4" y2="4" stroke={i.color} strokeWidth="3" strokeDasharray={i.dashed ? "5 3" : undefined} /></svg> {i.label}</span>)}</div>
);
