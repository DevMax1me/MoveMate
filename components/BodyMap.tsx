"use client";
import { MUSCLE_GROUPS } from "@/lib/muscles";

// Silhouette de face et de dos ; chaque zone est un groupe musculaire cliquable (filtre) ou simplement colorée (fiche d'exercice).
type Shape = { g: string; v: "f" | "b"; el: "rect" | "ellipse" | "poly"; p: number[]; rx?: number };
const S: Shape[] = [
  { g: "epaules", v: "f", el: "ellipse", p: [30, 39, 9, 6] }, { g: "epaules", v: "f", el: "ellipse", p: [70, 39, 9, 6] },
  { g: "pectoraux", v: "f", el: "rect", p: [33, 42, 16, 15], rx: 6 }, { g: "pectoraux", v: "f", el: "rect", p: [51, 42, 16, 15], rx: 6 },
  { g: "biceps", v: "f", el: "rect", p: [19, 46, 8, 24], rx: 4 }, { g: "biceps", v: "f", el: "rect", p: [73, 46, 8, 24], rx: 4 },
  { g: "avant-bras", v: "f", el: "rect", p: [16, 72, 8, 28], rx: 4 }, { g: "avant-bras", v: "f", el: "rect", p: [76, 72, 8, 28], rx: 4 },
  { g: "abdominaux", v: "f", el: "rect", p: [41, 59, 18, 32], rx: 5 },
  { g: "obliques", v: "f", el: "rect", p: [33, 59, 7, 28], rx: 3 }, { g: "obliques", v: "f", el: "rect", p: [60, 59, 7, 28], rx: 3 },
  { g: "quadriceps", v: "f", el: "rect", p: [33, 100, 15, 44], rx: 7 }, { g: "quadriceps", v: "f", el: "rect", p: [52, 100, 15, 44], rx: 7 },
  { g: "adducteurs", v: "f", el: "rect", p: [47.5, 102, 5, 28], rx: 2 },
  { g: "mollets", v: "f", el: "rect", p: [35, 150, 11, 34], rx: 5 }, { g: "mollets", v: "f", el: "rect", p: [54, 150, 11, 34], rx: 5 },
  { g: "trapezes", v: "b", el: "poly", p: [50, 27, 63, 36, 50, 56, 37, 36] },
  { g: "epaules", v: "b", el: "ellipse", p: [30, 39, 9, 6] }, { g: "epaules", v: "b", el: "ellipse", p: [70, 39, 9, 6] },
  { g: "dos", v: "b", el: "rect", p: [33, 47, 16.5, 32], rx: 7 }, { g: "dos", v: "b", el: "rect", p: [50.5, 47, 16.5, 32], rx: 7 },
  { g: "triceps", v: "b", el: "rect", p: [19, 46, 8, 24], rx: 4 }, { g: "triceps", v: "b", el: "rect", p: [73, 46, 8, 24], rx: 4 },
  { g: "avant-bras", v: "b", el: "rect", p: [16, 72, 8, 28], rx: 4 }, { g: "avant-bras", v: "b", el: "rect", p: [76, 72, 8, 28], rx: 4 },
  { g: "lombaires", v: "b", el: "rect", p: [42, 80, 16, 12], rx: 4 },
  { g: "fessiers", v: "b", el: "rect", p: [33, 94, 16, 17], rx: 8 }, { g: "fessiers", v: "b", el: "rect", p: [51, 94, 16, 17], rx: 8 },
  { g: "ischio", v: "b", el: "rect", p: [33, 113, 15, 34], rx: 7 }, { g: "ischio", v: "b", el: "rect", p: [52, 113, 15, 34], rx: 7 },
  { g: "mollets", v: "b", el: "rect", p: [35, 150, 11, 34], rx: 5 }, { g: "mollets", v: "b", el: "rect", p: [54, 150, 11, 34], rx: 5 },
];
const OUT: [string, number[]][] = [["head", [50, 13, 10]], ["torso", [29, 32, 42, 64]], ["armL", [15, 36, 14, 66]], ["armR", [71, 36, 14, 66]], ["legL", [31, 96, 18, 90]], ["legR", [51, 96, 18, 90]]];

export default function BodyMap({ selected, onSelect, primary = [], secondary = [], counts, compact }: {
  selected?: string | null; onSelect?: (id: string | null) => void; primary?: string[]; secondary?: string[]; counts?: Record<string, number>; compact?: boolean;
}) {
  const interactive = !!onSelect;
  const label = (g: string) => MUSCLE_GROUPS.find((m) => m.id === g)?.label ?? g;
  const cls = (g: string) => (selected === g || primary.includes(g) ? "on" : secondary.includes(g) ? "sec" : counts && !counts[g] ? "off" : "");
  const render = (s: Shape, i: number, dx: number) => {
    const common = { className: `bm ${cls(s.g)}`, key: i } as const;
    if (s.el === "rect") return <rect {...common} x={s.p[0] + dx} y={s.p[1]} width={s.p[2]} height={s.p[3]} rx={s.rx ?? 3} />;
    if (s.el === "ellipse") return <ellipse {...common} cx={s.p[0] + dx} cy={s.p[1]} rx={s.p[2]} ry={s.p[3]} />;
    const pts = s.p.map((n, k) => (k % 2 === 0 ? n + dx : n)).join(",").replace(/(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),?/g, "$1,$2 ");
    return <polygon {...common} points={pts.trim()} />;
  };
  return (
    <div className={`bodymap ${compact ? "compact" : ""}`}>
      <svg viewBox="0 0 220 196" role={interactive ? "group" : "img"} aria-label={interactive ? "Carte des muscles : touchez une zone pour filtrer" : `Muscles sollicités : ${primary.map(label).join(", ")}`}>
        {[0, 120].map((dx) => <g key={dx} className="bm-outline">{OUT.map(([k, p]) => (k === "head" ? <circle key={k} cx={p[0] + dx} cy={p[1]} r={p[2]} /> : <rect key={k} x={p[0] + dx} y={p[1]} width={p[2]} height={p[3]} rx={8} />))}</g>)}
        <text x="50" y="193" textAnchor="middle" className="bm-cap">Face</text><text x="170" y="193" textAnchor="middle" className="bm-cap">Dos</text>
        {S.map((s, i) => {
          const el = render(s, i, s.v === "b" ? 120 : 0);
          if (!interactive) return el;
          return (
            <g key={i} role="button" tabIndex={0} aria-label={`${label(s.g)}${counts ? ` (${counts[s.g] ?? 0} exercices)` : ""}`} aria-pressed={selected === s.g}
              onMouseDown={(e) => e.preventDefault()} onClick={() => onSelect!(selected === s.g ? null : s.g)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect!(selected === s.g ? null : s.g))}>
              {el}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
