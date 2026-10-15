"use client";
import { MUSCLE_GROUPS } from "@/lib/muscles";

// Silhouette de face et de dos, dessinée avec des courbes lisses : chaque muscle est une zone cliquable (filtre)
// ou simplement colorée (fiche d'exercice). Les formes sont décrites pour le côté gauche de l'image puis reflétées.
type P = [number, number];
const mir = (pts: P[]): P[] => pts.map(([x, y]) => [100 - x, y]);
const f1 = (n: number) => +n.toFixed(2);
/** Courbe fermée lisse passant par les points (Catmull-Rom → Bézier). */
function smooth(pts: P[]): string {
  const n = pts.length;
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return d + "Z";
}
const both = (left: P[]) => [smooth(left), smooth(mir(left))];

// --- corps (commun aux deux vues) ---
const TORSO_L: P[] = [[44, 31], [36, 33], [29, 36], [27, 41], [31, 50], [33, 60], [36, 74], [37, 84], [34, 96], [33, 106], [41, 111]];
const TORSO = smooth([...TORSO_L, [50, 112], ...mir(TORSO_L).reverse()]);
const ARM_L: P[] = [[27, 34], [21, 38], [18, 48], [16, 62], [14, 74], [11, 88], [9, 100], [7, 110], [9, 118], [14, 118], [17, 108], [20, 96], [23, 84], [26, 72], [29, 60], [31, 50], [31, 40]];
const LEG_L: P[] = [[33, 102], [31, 114], [31, 128], [33, 142], [34, 152], [33, 166], [34, 178], [33, 186], [30, 192], [31, 196], [40, 196], [43, 190], [43, 180], [44, 166], [45, 152], [47, 140], [48, 126], [48.6, 112], [48.6, 106]];
const HEAD = "M41.4 14a8.6 10.6 0 1 0 17.2 0a8.6 10.6 0 1 0 -17.2 0Z";
const BODY = [HEAD, smooth([[45, 21], [55, 21], [56, 33], [44, 33]]), TORSO, ...both(ARM_L), ...both(LEG_L)];

// --- muscles : [groupe, vue, formes] ---
const DELT: P[] = [[28, 35], [34, 34], [37, 38], [36, 46], [30, 48], [25, 44], [24, 38]];
const ARM_FRONT: P[] = [[22, 47], [28, 46], [28, 56], [25, 68], [19, 70], [18, 60]];
const FOREARM: P[] = [[18, 74], [24, 74], [21, 88], [17, 100], [11, 101], [13, 88]];
const rect = (x: number, y: number, w: number, h: number, r = 2.4) => `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
const ABS = [60, 69, 78].flatMap((y) => [rect(42, y, 7.4, 7.6), rect(50.6, y, 7.4, 7.6)]);
type Zone = { g: string; v: "f" | "b"; d: string[] };
const Z: Zone[] = [
  { g: "epaules", v: "f", d: both(DELT) },
  { g: "pectoraux", v: "f", d: both([[37, 40], [48.6, 40], [48.8, 54], [44, 58], [38, 56], [34, 50], [34, 44]]) },
  { g: "biceps", v: "f", d: both(ARM_FRONT) },
  { g: "avant-bras", v: "f", d: both(FOREARM) },
  { g: "abdominaux", v: "f", d: ABS },
  { g: "obliques", v: "f", d: both([[34, 58], [40.4, 60], [40.4, 88], [37, 90], [35, 76]]) },
  { g: "quadriceps", v: "f", d: both([[34, 106], [43, 108], [43.5, 126], [42, 142], [37, 142], [32, 128], [32, 114]]) },
  { g: "adducteurs", v: "f", d: both([[43.8, 112], [48.2, 110], [48.4, 130], [45, 136]]) },
  { g: "mollets", v: "f", d: both([[35, 152], [43, 152], [42, 176], [36, 176]]) },
  { g: "trapezes", v: "b", d: [smooth([[50, 26], [58, 31], [66, 36], [62, 44], [50, 64], [38, 44], [34, 36], [42, 31]])] },
  { g: "epaules", v: "b", d: both(DELT) },
  { g: "dos", v: "b", d: both([[37, 46], [49, 52], [49, 76], [44, 82], [38, 76], [34, 60], [34, 50]]) },
  { g: "triceps", v: "b", d: both(ARM_FRONT) },
  { g: "avant-bras", v: "b", d: both(FOREARM) },
  { g: "lombaires", v: "b", d: both([[43, 78], [49.4, 76], [49.4, 94], [44, 94]]) },
  { g: "fessiers", v: "b", d: both([[33, 96], [49.4, 96], [49.4, 112], [42, 116], [34, 110]]) },
  { g: "ischio", v: "b", d: both([[33, 118], [47.6, 118], [46, 142], [41, 145], [34, 140]]) },
  { g: "mollets", v: "b", d: both([[35, 148], [44, 148], [43, 166], [39, 178], [36, 168]]) },
];
// groupes présents sur les deux vues : seule la vue de face est annoncée aux lecteurs d'écran
const FRONT = new Set(Z.filter((z) => z.v === "f").map((z) => z.g));

export default function BodyMap({ selected, onSelect, primary = [], secondary = [], counts, compact }: {
  selected?: string | null; onSelect?: (id: string | null) => void; primary?: string[]; secondary?: string[]; counts?: Record<string, number>; compact?: boolean;
}) {
  const interactive = !!onSelect;
  const label = (g: string) => MUSCLE_GROUPS.find((m) => m.id === g)?.label ?? g;
  const cls = (g: string) => (selected === g || primary.includes(g) ? "on" : secondary.includes(g) ? "sec" : counts && !counts[g] ? "off" : "");
  const layer = (kind: "bm-outline" | "bm-base" | "bm-body", dx: number) => <g key={`${kind}${dx}`} transform={`translate(${dx} 0)`} className={kind}>{BODY.map((d, i) => <path key={i} d={d} />)}</g>;
  const zones = (v: "f" | "b", dx: number) => Z.filter((z) => z.v === v).map((z) => {
    const shapes = z.d.map((d, i) => <path key={i} d={d} className={`bm ${cls(z.g)}`} />);
    if (!interactive) return <g key={z.g} transform={`translate(${dx} 0)`}>{shapes}</g>;
    const dup = v === "b" && FRONT.has(z.g), toggle = () => onSelect!(selected === z.g ? null : z.g);
    return (
      <g key={z.g} transform={`translate(${dx} 0)`} role="button" tabIndex={dup ? -1 : 0} aria-hidden={dup || undefined} aria-label={dup ? undefined : `${label(z.g)}${counts ? ` (${counts[z.g] ?? 0} exercices)` : ""}`} aria-pressed={dup ? undefined : selected === z.g}
        onMouseDown={(e) => e.preventDefault()} onClick={toggle} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle())}>
        <title>{`${label(z.g)}${counts ? ` · ${counts[z.g] ?? 0}` : ""}`}</title>
        {shapes}
      </g>
    );
  });
  return (
    <div className={`bodymap ${compact ? "compact" : ""}`}>
      <svg viewBox="0 0 220 206" role={interactive ? "group" : "img"} aria-label={interactive ? "Carte des muscles : touchez une zone pour filtrer" : `Muscles sollicités : ${primary.map(label).join(", ")}`}>
        {layer("bm-outline", 0)}{layer("bm-outline", 120)}{layer("bm-base", 0)}{layer("bm-base", 120)}{layer("bm-body", 0)}{layer("bm-body", 120)}
        <text x="50" y="204" textAnchor="middle" className="bm-cap">Face</text><text x="170" y="204" textAnchor="middle" className="bm-cap">Dos</text>
        {zones("f", 0)}{zones("b", 120)}
      </svg>
    </div>
  );
}
