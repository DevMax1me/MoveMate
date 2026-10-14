"use client";
// Graphiques SVG maison, écrits selon la méthode dataviz : marques fines, grille en hairline pleine, une seule échelle,
// bulles de survol pour toutes les séries, clavier, légende dès 2 séries, tableau équivalent, mode sombre via variables CSS.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

const MARGIN = { t: 12, r: 12, b: 26, l: 44 };
const nfr = (n: number, d = 1) => n.toLocaleString("fr-FR", { maximumFractionDigits: d });

/** Largeur réelle du conteneur : le texte garde sa taille sur téléphone (pas de viewBox réduit). */
function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.floor(e.contentRect.width))));
    ro.observe(el); setW(Math.max(240, Math.floor(el.getBoundingClientRect().width)));
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Graduations « propres » (1, 2, 5 × 10ⁿ). */
export function niceTicks(lo: number, hi: number, count = 4): number[] {
  if (hi <= lo) { hi = lo + 1; }
  const raw = (hi - lo) / count, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const out: number[] = [];
  let v = Math.ceil(lo / step - 1e-9) * step;
  for (; v < hi - 1e-9; v += step) out.push(+v.toFixed(10));
  out.push(+v.toFixed(10)); // la dernière graduation couvre toujours le maximum (cible comprise)
  return out;
}
const tickLabel = (v: number) => (Math.abs(v) >= 1000 ? `${nfr(v / 1000, 1)} k` : nfr(v, Math.abs(v) < 10 && v % 1 ? 1 : 0));
function xLabelIdx(n: number, width: number): Set<number> {
  const max = Math.max(2, Math.floor((width - MARGIN.l) / 64)), step = Math.max(1, Math.ceil(n / max));
  const s = new Set<number>(); for (let i = n - 1; i >= 0; i -= step) s.add(i); return s;
}

// ---------- éléments communs ----------
export type TipRow = { color: string; name: string; value: string };
function Tip({ x, y, width, title, rows, note }: { x: number; y: number; width: number; title: string; rows: TipRow[]; note?: string }) {
  const right = x > width * 0.55;
  return (
    <div className="tip" role="status" style={{ top: 0, [right ? "right" : "left"]: right ? width - x + 12 : x + 12 } as React.CSSProperties}>
      <div className="d">{title}</div>
      {rows.map((r) => <div className="r" key={r.name}><span className="k" style={{ background: r.color }} /><span>{r.name}</span><b>{r.value}</b></div>)}
      {note && <div className="small muted" style={{ marginTop: 2 }}>{note}</div>}
    </div>
  );
}
export function Key({ color, kind = "line", hollow }: { color: string; kind?: "line" | "dot" | "bar" | "tick"; hollow?: boolean }) {
  return (
    <svg className="k" width="18" height="10" aria-hidden="true">
      {kind === "line" && <line x1="0" x2="18" y1="5" y2="5" stroke={color} strokeWidth="3" strokeLinecap="round" />}
      {kind === "dot" && <circle cx="9" cy="5" r="4" fill={color} />}
      {kind === "bar" && <rect x="3" y="0" width="12" height="10" rx="2" fill={color} opacity={hollow ? 0.38 : 1} />}
      {kind === "tick" && <line x1="1" x2="17" y1="5" y2="5" stroke={color} strokeWidth="3.5" strokeLinecap="round" />}
    </svg>
  );
}
export function Legend({ items }: { items: { label: string; color: string; kind?: "line" | "dot" | "bar" | "tick"; hollow?: boolean }[] }) {
  return <div className="legend">{items.map((i) => <span key={i.label}><Key color={i.color} kind={i.kind} hollow={i.hollow} />{i.label}</span>)}</div>;
}

/** Cadre commun : titre, note, légende, graphique, équivalent tableau. */
export function Figure({ title, note, legend, table, children, busy }: { title: string; note?: ReactNode; legend?: ReactNode; table?: { head: string[]; rows: (string | number | null)[][] }; children: ReactNode; busy?: boolean }) {
  return (
    <figure className="fig" style={{ opacity: busy ? 0.6 : 1 }}>
      <figcaption><span className="t">{title}</span>{note && <span className="n">{note}</span>}</figcaption>
      {children}
      {legend}
      {table && (
        <details><summary>Voir en tableau</summary>
          <table><thead><tr>{table.head.map((h, i) => <th key={h} className={i ? "n" : ""}>{h}</th>)}</tr></thead>
            <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j ? "n" : ""}>{c ?? "—"}</td>)}</tr>)}</tbody></table>
        </details>
      )}
    </figure>
  );
}

// ---------- courbes ----------
export type LineSeries = { name: string; color: string; values: (number | null)[]; mode?: "line" | "dots"; area?: boolean; endLabel?: boolean };
export function LineChart({ labels, tipTitles, series, unit = "", height = 210, decimals = 1, notes }: { labels: string[]; tipTitles?: string[]; series: LineSeries[]; unit?: string; height?: number; decimals?: number; notes?: (i: number) => string | undefined }) {
  const [ref, W] = useWidth();
  const [hi, setHi] = useState<number | null>(null);
  const n = labels.length, H = height;
  const all = series.flatMap((s) => s.values).filter((v): v is number => v != null);
  const dom = useMemo(() => {
    if (!all.length) return null;
    let lo = Math.min(...all), up = Math.max(...all);
    const pad = Math.max((up - lo) * 0.18, up === lo ? 0.5 : 0); lo -= pad; up += pad;
    const t = niceTicks(lo, up, 4); return { lo: Math.min(lo, t[0]), up: Math.max(up, t[t.length - 1]), ticks: t };
  }, [all.join(",")]); // eslint-disable-line
  if (!dom) return <p className="empty">Pas encore de données sur cette période.</p>;
  const iw = W - MARGIN.l - MARGIN.r, ih = H - MARGIN.t - MARGIN.b;
  const X = (i: number) => MARGIN.l + (n <= 1 ? iw / 2 : (iw * i) / (n - 1)), Y = (v: number) => MARGIN.t + ih * (1 - (v - dom.lo) / (dom.up - dom.lo));
  const xl = xLabelIdx(n, W);
  const near = (clientX: number, el: Element) => { const r = el.getBoundingClientRect(); const x = clientX - r.left; return Math.max(0, Math.min(n - 1, Math.round(n <= 1 ? 0 : ((x - MARGIN.l) / iw) * (n - 1)))); };
  const key = (e: React.KeyboardEvent) => { if (e.key === "ArrowRight") setHi(Math.min(n - 1, (hi ?? -1) + 1)); else if (e.key === "ArrowLeft") setHi(Math.max(0, (hi ?? n) - 1)); else if (e.key === "Escape") setHi(null); else return; e.preventDefault(); };
  const fmt = (v: number | null) => (v == null ? "—" : `${nfr(v, decimals)}${unit}`);
  const tipY = hi == null ? 0 : Math.min(...series.map((s) => s.values[hi]).filter((v): v is number => v != null).map(Y)) - 8;
  return (
    <div className="plot" ref={ref} tabIndex={0} role="group" aria-label={`Courbe : ${series.map((s) => s.name).join(", ")}. Flèches gauche et droite pour lire les valeurs.`}
      onPointerMove={(e) => setHi(near(e.clientX, e.currentTarget))} onPointerLeave={() => setHi(null)} onKeyDown={key} onBlur={() => setHi(null)}>
      <svg width={W} height={H} aria-hidden="true">
        <g className="grid">{dom.ticks.map((t) => <g key={t}><line x1={MARGIN.l} x2={W - MARGIN.r} y1={Y(t)} y2={Y(t)} /><text x={MARGIN.l - 8} y={Y(t) + 3.5} textAnchor="end">{tickLabel(t)}</text></g>)}</g>
        <line className="axis" x1={MARGIN.l} x2={W - MARGIN.r} y1={H - MARGIN.b} y2={H - MARGIN.b} />
        {labels.map((l, i) => xl.has(i) && <text key={i} x={X(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>{l}</text>)}
        {series.map((s) => {
          const segs: [number, number][][] = []; let cur: [number, number][] = [];
          s.values.forEach((v, i) => { if (v == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push([X(i), Y(v)]); });
          if (cur.length) segs.push(cur);
          const last = [...s.values].map((v, i) => [v, i] as const).filter(([v]) => v != null).pop();
          return (
            <g key={s.name}>
              {s.mode !== "dots" && s.area && segs.map((sg, k) => <path key={"a" + k} d={`M${sg[0][0]},${H - MARGIN.b} ${sg.map((p) => `L${p[0]},${p[1]}`).join(" ")} L${sg[sg.length - 1][0]},${H - MARGIN.b}Z`} fill={s.color} opacity={0.1} />)}
              {s.mode !== "dots" && segs.map((sg, k) => sg.length > 1 && <polyline key={k} fill="none" stroke={s.color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" points={sg.map((p) => p.join(",")).join(" ")} />)}
              {s.mode === "dots" && s.values.map((v, i) => v != null && <circle key={i} className="p" cx={X(i)} cy={Y(v)} r={5} fill={s.color} stroke="var(--card)" strokeWidth={2.5} />)}
              {s.mode !== "dots" && segs.map((sg, k) => sg.length === 1 && <circle key={"s" + k} cx={sg[0][0]} cy={sg[0][1]} r={4} fill={s.color} stroke="var(--card)" strokeWidth={2.5} />)}
              {s.endLabel && last && last[0] != null && (<g><circle cx={X(last[1])} cy={Y(last[0])} r={4.5} fill={s.color} stroke="var(--card)" strokeWidth={2.5} />
                <text className="lbl" x={Math.min(X(last[1]) + 8, W - 4)} y={Y(last[0]) - 9} textAnchor={X(last[1]) > W - 60 ? "end" : "start"}>{fmt(last[0])}</text></g>)}
            </g>
          );
        })}
        {hi != null && <g><line x1={X(hi)} x2={X(hi)} y1={MARGIN.t} y2={H - MARGIN.b} stroke="var(--ink)" strokeOpacity={0.5} strokeWidth={1.5} strokeLinecap="round" />
          {series.map((s) => { const v = s.values[hi]; return v == null ? null : <circle key={s.name} cx={X(hi)} cy={Y(v)} r={5} fill={s.color} stroke="var(--card)" strokeWidth={2.5} />; })}</g>}
      </svg>
      {hi != null && <Tip x={X(hi)} y={tipY} width={W} title={tipTitles?.[hi] ?? labels[hi]} rows={series.filter((s) => s.values[hi] != null).map((s) => ({ color: s.color, name: s.name, value: fmt(s.values[hi]) }))} note={notes?.(hi)} />}
    </div>
  );
}

// ---------- barres ----------
export type Bar = { value: number | null; partial?: boolean; target?: number | null; note?: string };
export function BarChart({ labels, tipTitles, bars, color = "var(--s1)", unit = "", height = 190, valueName = "Valeur", targetName = "Cible", labelLast }: { labels: string[]; tipTitles?: string[]; bars: Bar[]; color?: string; unit?: string; height?: number; valueName?: string; targetName?: string; labelLast?: boolean }) {
  const [ref, W] = useWidth();
  const [hi, setHi] = useState<number | null>(null);
  const n = bars.length, H = height;
  const vals = bars.flatMap((b) => [b.value, b.target]).filter((v): v is number => v != null);
  if (!vals.some((v) => v > 0) && !bars.some((b) => b.value != null)) return <p className="empty">Pas encore de données sur cette période.</p>;
  const ticks = niceTicks(0, Math.max(1, ...vals) * 1.05, 4), top = ticks[ticks.length - 1];
  const iw = W - MARGIN.l - MARGIN.r, ih = H - MARGIN.t - MARGIN.b, slot = iw / n, bw = Math.min(18, Math.max(3, slot * 0.62)), rr = Math.min(bw / 2, 7);
  const Y = (v: number) => MARGIN.t + ih * (1 - v / top), xl = xLabelIdx(n, W);
  const lastIdx = [...bars].map((b, i) => [b, i] as const).filter(([b]) => b.value != null).pop()?.[1];
  const key = (e: React.KeyboardEvent) => { if (e.key === "ArrowRight") setHi(Math.min(n - 1, (hi ?? -1) + 1)); else if (e.key === "ArrowLeft") setHi(Math.max(0, (hi ?? n) - 1)); else if (e.key === "Escape") setHi(null); else return; e.preventDefault(); };
  const showLast = labelLast ?? n <= 14;
  const hasTarget = bars.some((b) => b.target != null), hasPartial = bars.some((b) => b.partial);
  const cx = (i: number) => MARGIN.l + slot * i + slot / 2;
  return (
    <div>
      <div className="plot" ref={ref} tabIndex={0} role="group" aria-label={`Barres : ${valueName}. Flèches gauche et droite pour lire les valeurs.`}
        onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHi(Math.max(0, Math.min(n - 1, Math.floor((e.clientX - r.left - MARGIN.l) / slot)))); }}
        onPointerLeave={() => setHi(null)} onKeyDown={key} onBlur={() => setHi(null)}>
        <svg width={W} height={H} aria-hidden="true">
          <g className="grid">{ticks.map((t) => <g key={t}><line x1={MARGIN.l} x2={W - MARGIN.r} y1={Y(t)} y2={Y(t)} /><text x={MARGIN.l - 8} y={Y(t) + 3.5} textAnchor="end">{tickLabel(t)}</text></g>)}</g>
          {bars.map((b, i) => {
            const on = hi === i;
            return (
              <g key={i} opacity={hi != null && !on ? 0.55 : 1}>
                {b.value != null && b.value > 0 && <path d={`M${cx(i) - bw / 2},${Y(0)} V${Y(Math.max(b.value, 0)) + rr} q0,-${rr} ${rr},-${rr} h${bw - 2 * rr} q${rr},0 ${rr},${rr} V${Y(0)} Z`} fill={color} opacity={b.partial ? 0.38 : 1} />}
                {b.target != null && <line x1={cx(i) - Math.max(bw / 2 + 2, 6)} x2={cx(i) + Math.max(bw / 2 + 2, 6)} y1={Y(b.target)} y2={Y(b.target)} stroke="var(--s2)" strokeWidth={3.5} strokeLinecap="round" />}
                {b.value == null && <circle cx={cx(i)} cy={Y(0) - 5} r={1.6} fill="var(--line)" />}
                {showLast && i === lastIdx && b.value != null && <text className="lbl" x={cx(i)} y={Y(b.value) - 7} textAnchor={cx(i) > W - 40 ? "end" : "middle"}>{nfr(b.value, 0)}{unit}</text>}
              </g>
            );
          })}
          <line className="axis" x1={MARGIN.l} x2={W - MARGIN.r} y1={Y(0)} y2={Y(0)} />
          {labels.map((l, i) => xl.has(i) && <text key={i} x={cx(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>{l}</text>)}
          {hi != null && <rect x={MARGIN.l + slot * hi} y={MARGIN.t} width={slot} height={ih} rx={10} fill="var(--ink)" opacity={0.07} />}
        </svg>
        {hi != null && (() => { const b = bars[hi]; const rows: TipRow[] = [{ color, name: valueName, value: b.value == null ? "—" : `${nfr(b.value, 0)}${unit}` }]; if (b.target != null) rows.push({ color: "var(--s2)", name: targetName, value: `${nfr(b.target, 0)}${unit}` }); return <Tip x={cx(hi)} y={b.value != null ? Y(b.value) - 30 : MARGIN.t} width={W} title={tipTitles?.[hi] ?? labels[hi]} rows={rows} note={b.note} />; })()}
      </div>
      {(hasTarget || hasPartial) && <Legend items={[{ label: valueName, color, kind: "bar" }, ...(hasPartial ? [{ label: "journée non terminée", color, kind: "bar" as const, hollow: true }] : []), ...(hasTarget ? [{ label: targetName, color: "var(--s2)", kind: "tick" as const }] : [])]} />}
    </div>
  );
}

// ---------- chiffres ----------
export function Stat({ label, value, unit, sub }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode }) {
  return <div className="stat"><div className="lbl">{label}</div><div className="big">{value}{unit && <span className="unit">{unit}</span>}</div>{sub && <div className="sub">{sub}</div>}</div>;
}
export function Meter({ label, value, target, unit = "g", color = "var(--ink)" }: { label: string; value: number | null; target?: number | null; unit?: string; color?: string }) {
  const pct = value != null && target ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div className="meter" style={{ ["--c" as string]: color }}><div className="top"><span><i className="dot" />{label}</span><span>{value == null ? "—" : nfr(value, 0)}{target ? ` / ${nfr(target, 0)}` : ""} {unit}</span></div>
      {target ? <div className="rail" role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div> : null}</div>
  );
}
