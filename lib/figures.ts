// Schémas de mouvement : bonhomme filaire (vue de profil ou de face) animé entre une pose de départ et une pose d'arrivée.
// Pur TypeScript, sans dépendance : testable, et le même dessin sert aux vignettes et à l'animation.
// Angles en degrés. Segments (jambes, bras) : mesurés depuis « pointe vers le bas », positif vers l'avant (la droite de l'écran).
// Tronc : mesuré depuis « pointe vers le haut », positif = penché vers l'avant. Repère SVG : y vers le bas, le sol est à y = 0 pour les poses ancrées à la cheville.

export type V = [number, number];
export type Pose = {
  anchor: "ankle" | "hip" | "wrist";
  tor: number; head?: number;
  th: number; sh: number; th2?: number; sh2?: number;       // jambe proche / jambe éloignée
  ua: number; fa: number; ua2?: number; fa2?: number;        // bras proche / bras éloigné
  hand?: V; foot?: V; bend?: 1 | -1; legBend?: 1 | -1;       // cinématique inverse (main ou pied visés, relatifs à l'ancrage)
  lift?: number; toe?: number;
};
export type Impl = "bar" | "db" | "kb" | "cable" | "handle" | "none";
export type Furn = "bench" | "seat" | "pullbar" | "dipbars" | "floor";
export type Spec = {
  id: string; view: "side" | "front"; a: Pose; b: Pose; impl: Impl; furn: Furn[]; pulley?: V;
  labels: [string, string]; hold?: boolean; hot: { arms?: boolean; legs?: boolean; torso?: boolean };
  front?: { a: Front; b: Front };
};
export type Front = { la: number; ra: number; spread: number; shrug?: number; tilt?: number; lift?: number; lbend?: number; twist?: number; knee?: number; legOut?: number };

const LT = 0.55, LU = 0.28, LF = 0.26, LH = 0.42, LS = 0.42, HEAD = 0.105, FOOT = 0.13;
const rad = (d: number) => (d * Math.PI) / 180;
const dn = (a: number, l: number): V => [l * Math.sin(rad(a)), l * Math.cos(rad(a))];       // vers le bas
const upv = (a: number, l: number): V => [l * Math.sin(rad(a)), -l * Math.cos(rad(a))];     // vers le haut
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];

function ik(s: V, w: V, l1: number, l2: number, bend: number): { e: V; w: V } {
  const dx = w[0] - s[0], dy = w[1] - s[1];
  let d = Math.hypot(dx, dy) || 1e-6;
  const max = l1 + l2 - 1e-3, min = Math.abs(l1 - l2) + 1e-3;
  d = Math.min(Math.max(d, min), max);
  const ux = dx / (Math.hypot(dx, dy) || 1), uy = dy / (Math.hypot(dx, dy) || 1);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
  const px = s[0] + a * ux, py = s[1] + a * uy;
  return { e: [px - bend * h * uy, py + bend * h * ux], w: [s[0] + d * ux, s[1] + d * uy] };
}

export type Joints = { H: V; K: V; A: V; K2: V; A2: V; S: V; N: V; HD: V; E: V; W: V; E2: V; W2: V; toe: V };
export function joints(p: Pose): Joints {
  const H0: V = [0, 0];
  const th2 = p.th2 ?? p.th, sh2 = p.sh2 ?? p.sh;
  let K = add(H0, dn(p.th, LH)), A = add(K, dn(p.sh, LS));
  const K2 = add(H0, dn(th2, LH)), A2 = add(K2, dn(sh2, LS));
  const S = add(H0, upv(p.tor, LT)), N = add(S, upv(p.tor, 0.07)), HD = add(N, upv(p.tor + (p.head ?? 0), HEAD));
  const E0 = add(S, dn(p.ua, LU)), W0 = add(E0, dn(p.fa, LF));
  const ua2 = p.ua2 ?? p.ua, fa2 = p.fa2 ?? p.fa;
  const E20 = add(S, dn(ua2, LU)), W20 = add(E20, dn(fa2, LF));
  const shift: V = p.anchor === "ankle" ? [-A[0], -A[1]] : p.anchor === "wrist" ? [-W0[0], -W0[1]] : [0, 0];
  const mv = (v: V): V => [v[0] + shift[0], v[1] + shift[1] - (p.lift ?? 0)];
  let J = { H: mv(H0), K: mv(K), A: mv(A), K2: mv(K2), A2: mv(A2), S: mv(S), N: mv(N), HD: mv(HD), E: mv(E0), W: mv(W0), E2: mv(E20), W2: mv(W20), toe: [0, 0] as V };
  if (p.hand) { const r = ik(J.S, [p.hand[0], p.hand[1] - (p.lift ?? 0)], LU, LF, p.bend ?? 1); J = { ...J, E: r.e, W: r.w, E2: r.e, W2: r.w }; }
  if (p.foot) { const r = ik(J.H, add(J.H, p.foot), LH, LS, p.legBend ?? 1); J = { ...J, K: r.e, A: r.w, K2: r.e, A2: r.w }; }
  J.toe = add(J.A, [FOOT * Math.cos(rad((p.toe ?? 0) * 55)), -FOOT * Math.sin(rad((p.toe ?? 0) * 55))]);
  return J;
}

const NUM: (keyof Pose)[] = ["tor", "head", "th", "sh", "th2", "sh2", "ua", "fa", "ua2", "fa2", "lift", "toe"];
export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const o: any = { ...a };
  for (const k of NUM) { const x = (a as any)[k], y = (b as any)[k]; if (x != null || y != null) o[k] = (x ?? (b as any)[k === "th2" ? "th" : k] ?? 0) + (((y ?? x) ?? 0) - (x ?? 0)) * t; }
  if (a.hand && b.hand) o.hand = [a.hand[0] + (b.hand[0] - a.hand[0]) * t, a.hand[1] + (b.hand[1] - a.hand[1]) * t];
  if (a.foot && b.foot) o.foot = [a.foot[0] + (b.foot[0] - a.foot[0]) * t, a.foot[1] + (b.foot[1] - a.foot[1]) * t];
  return o;
}
const P = (o: Partial<Pose>): Pose => ({ anchor: "ankle", tor: 0, th: 0, sh: 0, ua: 0, fa: 0, ...o });

// ---------------- Archétypes (vue de profil) ----------------
type Arch = { a: Pose; b: Pose; impl?: Impl; furn?: Furn[]; pulley?: V; labels?: [string, string]; hold?: boolean; hot?: Spec["hot"] };
const L: Record<string, Arch> = {
  pushup: { a: P({ tor: 67, th: -67, sh: -67, hand: [1.28, 0], bend: -1 }), b: P({ tor: 82, th: -82, sh: -82, hand: [1.28, 0], bend: -1 }), furn: ["floor"], hot: { arms: true, torso: true }, labels: ["Bras tendus", "Poitrine vers le sol"] },
  bench: { a: P({ anchor: "hip", tor: -90, th: 70, sh: 0, ua: 180, fa: 180 }), b: P({ anchor: "hip", tor: -90, th: 70, sh: 0, ua: 38, fa: 172 }), impl: "bar", furn: ["bench"], hot: { arms: true, torso: true }, labels: ["Bras tendus", "Charge vers la poitrine"] },
  benchInc: { a: P({ anchor: "hip", tor: -55, th: 80, sh: 5, ua: 175, fa: 178 }), b: P({ anchor: "hip", tor: -55, th: 80, sh: 5, ua: 40, fa: 170 }), impl: "bar", furn: ["bench"], hot: { arms: true, torso: true }, labels: ["Bras tendus", "Charge vers le haut de la poitrine"] },
  floorPress: { a: P({ anchor: "hip", tor: -90, th: 70, sh: 0, ua: 180, fa: 180 }), b: P({ anchor: "hip", tor: -90, th: 70, sh: 0, ua: 65, fa: 175 }), impl: "db", furn: ["floor"], hot: { arms: true, torso: true }, labels: ["Bras tendus", "Coudes au sol"] },
  ohp: { a: P({ ua: 20, fa: 165 }), b: P({ ua: 172, fa: 178 }), impl: "bar", hot: { arms: true, torso: true }, labels: ["Charge aux épaules", "Bras tendus au-dessus de la tête"] },
  seatPress: { a: P({ anchor: "hip", th: 90, sh: 0, ua: 20, fa: 165 }), b: P({ anchor: "hip", th: 90, sh: 0, ua: 172, fa: 178 }), impl: "handle", furn: ["seat"], hot: { arms: true, torso: true }, labels: ["Poignées aux épaules", "Bras tendus"] },
  liedFly: { a: P({ anchor: "hip", tor: -90, th: 70, sh: 0, ua: -85, fa: -95 }), b: P({ anchor: "hip", tor: -90, th: 70, sh: 0, ua: 178, fa: 180 }), impl: "db", furn: ["bench"], hot: { arms: true, torso: true }, labels: ["Bras ouverts, coudes légèrement fléchis", "Bras refermés au-dessus de la poitrine"] },
  cableFly: { a: P({ tor: 8, ua: -55, fa: -70 }), b: P({ tor: 8, ua: 45, fa: 60 }), impl: "cable", pulley: [-0.2, -2.0], hot: { arms: true, torso: true }, labels: ["Bras ouverts derrière", "Mains rapprochées devant"] },
  pushdown: { a: P({ tor: 5, ua: 4, fa: 125 }), b: P({ tor: 5, ua: 4, fa: 6 }), impl: "cable", pulley: [0.25, -2.0], hot: { arms: true }, labels: ["Avant-bras fléchis", "Bras tendus vers le bas"] },
  overheadExt: { a: P({ ua: 176, fa: -8 }), b: P({ ua: 176, fa: 178 }), impl: "db", hot: { arms: true }, labels: ["Avant-bras derrière la tête", "Bras tendus"] },
  skull: { a: P({ anchor: "hip", tor: -90, th: 70, sh: 0, ua: 180, fa: -55 }), b: P({ anchor: "hip", tor: -90, th: 70, sh: 0, ua: 180, fa: 178 }), impl: "bar", furn: ["bench"], hot: { arms: true }, labels: ["Barre vers le front", "Bras tendus"] },
  dip: { a: P({ anchor: "wrist", tor: 8, th: -8, sh: -40, ua: 0, fa: 0 }), b: P({ anchor: "wrist", tor: 14, th: -8, sh: -40, ua: -50, fa: 40 }), furn: ["dipbars"], hot: { arms: true, torso: true }, labels: ["Bras tendus", "Coudes à 90°"] },
  pullup: { a: P({ anchor: "wrist", th: 4, sh: -30, ua: 180, fa: 180 }), b: P({ anchor: "wrist", th: 4, sh: -30, ua: 0, fa: 180 }), furn: ["pullbar"], hot: { arms: true, torso: true }, labels: ["Suspendu, bras tendus", "Menton au-dessus de la barre"] },
  pulldown: { a: P({ anchor: "hip", tor: -6, th: 90, sh: 0, ua: 175, fa: 178 }), b: P({ anchor: "hip", tor: -14, th: 90, sh: 0, ua: 8, fa: 148 }), impl: "cable", pulley: [0.1, -2.0], furn: ["seat"], hot: { arms: true, torso: true }, labels: ["Bras tendus en haut", "Barre vers le haut de la poitrine"] },
  seatedRow: { a: P({ anchor: "hip", tor: 14, th: 80, sh: 10, ua: 85, fa: 88 }), b: P({ anchor: "hip", tor: -6, th: 80, sh: 10, ua: -35, fa: 78 }), impl: "cable", pulley: [1.7, 0.5], furn: ["seat"], hot: { arms: true, torso: true }, labels: ["Bras tendus devant", "Coudes tirés vers l'arrière"] },
  bentRow: { a: P({ tor: 65, th: 24, sh: -12, ua: 0, fa: 0 }), b: P({ tor: 65, th: 24, sh: -12, ua: -125, fa: 5 }), impl: "bar", hot: { arms: true, torso: true }, labels: ["Bras tendus, dos plat", "Coudes vers le plafond"] },
  invRow: { a: P({ anchor: "ankle", tor: 82, th: -82, sh: -82, hand: [1.05, -0.72], bend: 1 }), b: P({ anchor: "ankle", tor: 62, th: -62, sh: -62, hand: [1.05, -0.72], bend: 1 }), furn: ["pullbar"], hot: { arms: true, torso: true }, labels: ["Bras tendus sous la barre", "Poitrine vers la barre"] },
  curl: { a: P({ ua: 5, fa: 4 }), b: P({ ua: 8, fa: 152 }), impl: "db", hot: { arms: true }, labels: ["Bras le long du corps", "Avant-bras montés"] },
  backExt: { a: P({ anchor: "hip", tor: -100, th: 80, sh: 80, ua: 5, fa: 5 }), b: P({ anchor: "hip", tor: -70, th: 80, sh: 80, ua: 5, fa: 5 }), furn: ["floor"], hot: { torso: true, legs: true }, labels: ["À plat", "Buste relevé sans cambrer"] },
  squat: { a: P({ tor: 4, ua: 90, fa: 90 }), b: P({ tor: 42, th: 96, sh: -24, ua: 90, fa: 90 }), hot: { legs: true }, labels: ["Debout", "Cuisses à l'horizontale"] },
  squatBar: { a: P({ tor: 4, ua: -40, fa: 30 }), b: P({ tor: 45, th: 96, sh: -24, ua: -40, fa: 30 }), impl: "bar", hot: { legs: true }, labels: ["Barre sur les épaules", "Cuisses à l'horizontale"] },
  goblet: { a: P({ tor: 4, ua: 22, fa: 160 }), b: P({ tor: 30, th: 96, sh: -24, ua: 22, fa: 160 }), impl: "db", hot: { legs: true }, labels: ["Charge contre la poitrine", "Cuisses à l'horizontale"] },
  legPress: { a: P({ anchor: "hip", tor: -52, th: 0, sh: 0, ua: 15, fa: 70, foot: [0.78, -0.30], legBend: -1 }), b: P({ anchor: "hip", tor: -52, th: 0, sh: 0, ua: 15, fa: 70, foot: [0.30, -0.14], legBend: -1 }), furn: ["seat"], hot: { legs: true }, labels: ["Jambes tendues", "Genoux fléchis, dos plaqué"] },
  lunge: { a: P({ tor: 2, th: 0, sh: 0, ua: 0, fa: 0 }), b: P({ tor: 2, th: 82, sh: -4, th2: -28, sh2: -112, ua: 0, fa: 0 }), hot: { legs: true }, labels: ["Debout", "Genou avant à 90°"] },
  hinge: { a: P({ tor: 2, ua: 2, fa: 0 }), b: P({ tor: 78, th: 12, sh: -4, ua: 8, fa: 0 }), impl: "bar", hot: { legs: true, torso: true }, labels: ["Debout", "Hanches en arrière, dos plat"] },
  deadlift: { a: P({ tor: 60, th: 58, sh: -34, ua: 6, fa: 0 }), b: P({ tor: 2, th: 0, sh: 0, ua: 2, fa: 0 }), impl: "bar", hot: { legs: true, torso: true }, labels: ["Barre au sol, dos plat", "Debout, hanches tendues"] },
  swing: { a: P({ tor: 62, th: 28, sh: -10, ua: -15, fa: -5 }), b: P({ tor: 4, th: 0, sh: 0, ua: 88, fa: 90 }), impl: "kb", hot: { legs: true, torso: true }, labels: ["Hanches en arrière", "Hanches tendues, bras à l'horizontale"] },
  bridge: { a: P({ tor: -92, th: 145, sh: 14, ua: 90, fa: 90 }), b: P({ tor: -122, th: 78, sh: -8, ua: 112, fa: 112 }), furn: ["floor"], hot: { legs: true }, labels: ["Hanches au sol", "Hanches montées, fessiers serrés"] },
  kickback: { a: P({ anchor: "hip", tor: -88, th: 4, sh: 88, ua: 0, fa: 0 }), b: P({ anchor: "hip", tor: -88, th: 112, sh: 112, ua: 0, fa: 0 }), furn: ["floor"], hot: { legs: true }, labels: ["Genou fléchi sous le corps", "Jambe tendue vers l'arrière"] },
  legCurl: { a: P({ anchor: "hip", tor: 90, th: -90, sh: -90, ua: 175, fa: 178 }), b: P({ anchor: "hip", tor: 90, th: -90, sh: -178, ua: 175, fa: 178 }), furn: ["bench"], hot: { legs: true }, labels: ["Jambes tendues", "Talons vers les fessiers"] },
  legExt: { a: P({ anchor: "hip", tor: -6, th: 90, sh: 4, ua: 20, fa: 90 }), b: P({ anchor: "hip", tor: -6, th: 90, sh: 88, ua: 20, fa: 90 }), furn: ["seat"], hot: { legs: true }, labels: ["Genoux fléchis", "Jambes tendues"] },
  calf: { a: P({ toe: 0, ua: 5, fa: 5 }), b: P({ toe: 1, lift: 0.06, ua: 5, fa: 5 }), hot: { legs: true }, labels: ["Talons au sol", "Sur la pointe des pieds"] },
  jump: { a: P({ tor: 40, th: 96, sh: -24, ua: -50, fa: -40 }), b: P({ tor: 5, th: 8, sh: 2, ua: 150, fa: 150, lift: 0.35, toe: 1 }), hot: { legs: true }, labels: ["Flexion", "Saut, extension complète"] },
  plank: { a: P({ anchor: "ankle", tor: 67, th: -67, sh: -67 }), b: P({ anchor: "ankle", tor: 67, th: -67, sh: -67, lift: 0.0 }), hold: true, furn: ["floor"], hot: { torso: true }, labels: ["Corps aligné", "Tenir la position"] },
  plankFore: { a: P({ anchor: "ankle", tor: 78, th: -78, sh: -78, ua: 0, fa: 90 }), b: P({ anchor: "ankle", tor: 78, th: -78, sh: -78, ua: 0, fa: 90 }), hold: true, furn: ["floor"], hot: { torso: true }, labels: ["Corps aligné, appui sur les avant-bras", "Tenir la position"] },
  climber: { a: P({ anchor: "ankle", tor: 67, th: -67, sh: -67, th2: 62, sh2: -75 }), b: P({ anchor: "ankle", tor: 67, th: -67, sh: -67, th2: -67, sh2: -67 }), furn: ["floor"], hot: { torso: true, legs: true }, labels: ["Genou vers la poitrine", "Jambe tendue, on alterne"] },
  crunch: { a: P({ anchor: "hip", tor: -92, th: 60, sh: 0, ua: 88, fa: 88 }), b: P({ anchor: "hip", tor: -40, th: 60, sh: 0, ua: 70, fa: 70, head: 10 }), furn: ["floor"], hot: { torso: true }, labels: ["Allongé", "Haut du dos enroulé"] },
  legRaise: { a: P({ anchor: "hip", tor: -90, th: 88, sh: 88, ua: 88, fa: 88 }), b: P({ anchor: "hip", tor: -90, th: 178, sh: 178, ua: 88, fa: 88 }), furn: ["floor"], hot: { torso: true, legs: true }, labels: ["Jambes presque au sol", "Jambes à la verticale"] },
  hangRaise: { a: P({ anchor: "wrist", th: 4, sh: 4, ua: 180, fa: 180 }), b: P({ anchor: "wrist", th: 86, sh: 86, ua: 180, fa: 180 }), furn: ["pullbar"], hot: { torso: true, legs: true }, labels: ["Suspendu", "Jambes à l'horizontale"] },
  carry: { a: P({ tor: 3, th: 20, sh: 0, th2: -20, sh2: -10, ua: 0, fa: 0 }), b: P({ tor: 3, th: -20, sh: -10, th2: 20, sh2: 0, ua: 0, fa: 0 }), impl: "db", hot: { arms: true, torso: true, legs: true }, labels: ["Pas gauche", "Pas droit"] },
  walk: { a: P({ tor: 6, th: 24, sh: 0, th2: -22, sh2: -18, ua: -30, fa: -10, ua2: 30, fa2: 50 }), b: P({ tor: 6, th: -22, sh: -18, th2: 24, sh2: 0, ua: 30, fa: 50, ua2: -30, fa2: -10 }), hot: { legs: true }, labels: ["Pas gauche", "Pas droit"] },
  run: { a: P({ tor: 14, th: 55, sh: -20, th2: -35, sh2: -95, ua: -50, fa: 40, ua2: 50, fa2: 120, lift: 0.08 }), b: P({ tor: 14, th: -35, sh: -95, th2: 55, sh2: -20, ua: 50, fa: 120, ua2: -50, fa2: 40, lift: 0.08 }), hot: { legs: true }, labels: ["Foulée", "Foulée opposée"] },
  bike: { a: P({ anchor: "hip", tor: 40, th: 60, sh: 20, th2: 20, sh2: -30, ua: 60, fa: 80 }), b: P({ anchor: "hip", tor: 40, th: 20, sh: -30, th2: 60, sh2: 20, ua: 60, fa: 80 }), furn: ["seat"], hot: { legs: true }, labels: ["Pédale basse", "Pédale haute"] },
  rowerg: { a: P({ anchor: "hip", tor: 30, th: 140, sh: 20, ua: 85, fa: 88 }), b: P({ anchor: "hip", tor: -20, th: 80, sh: 10, ua: -25, fa: 78 }), furn: ["seat"], hot: { legs: true, torso: true, arms: true }, labels: ["Jambes fléchies, bras tendus", "Jambes tendues, bras tirés"] },
  stretchFold: { a: P({ tor: 2, ua: 2, fa: 0 }), b: P({ tor: 95, th: 6, sh: 2, ua: 8, fa: 0 }), hold: true, hot: { legs: true, torso: true }, labels: ["Debout", "Penché en avant, dos détendu"] },
  stretchQuad: { a: P({ tor: 0, ua: 0, fa: 0 }), b: P({ tor: 4, th2: -8, sh2: -168, ua2: -35, fa2: -150 }), hold: true, hot: { legs: true }, labels: ["Debout", "Talon vers la fesse"] },
  stretchLunge: { a: P({ tor: 2, th: 82, sh: -4, th2: -28, sh2: -112 }), b: P({ tor: -4, th: 84, sh: -4, th2: -30, sh2: -108, ua: 160, fa: 175 }), hold: true, hot: { legs: true }, labels: ["Fente basse", "On avance le bassin, bras vers le haut"] },
  child: { a: P({ anchor: "hip", tor: 8, th: 80, sh: -86, ua: 4, fa: 4 }), b: P({ anchor: "hip", tor: 104, th: 80, sh: -86, ua: 92, fa: 92 }), hold: true, furn: ["floor"], hot: { torso: true }, labels: ["À genoux", "Buste vers le sol, bras tendus"] },
  cobra: { a: P({ anchor: "hip", tor: 86, th: -90, sh: -90, hand: [0.55, 0], bend: -1 }), b: P({ anchor: "hip", tor: 52, th: -90, sh: -90, hand: [0.40, 0], bend: -1 }), hold: true, furn: ["floor"], hot: { torso: true }, labels: ["Allongé sur le ventre", "Buste relevé, bassin au sol"] },
  catcow: { a: P({ anchor: "hip", tor: -88, th: 90, sh: 0, ua: 90, fa: 0 }), b: P({ anchor: "hip", tor: -82, th: 90, sh: 0, ua: 90, fa: 0, head: 25 }), furn: ["floor"], hot: { torso: true }, labels: ["Dos creux", "Dos rond"] },
  breathe: { a: P({ tor: 0, ua: 4, fa: 4 }), b: P({ tor: 0, ua: 30, fa: 30, head: -4 }), hot: { torso: true }, labels: ["Détendu", "Mouvement lent et contrôlé"] },
};

// ---------------- Archétypes (vue de face) ----------------
const F: Record<string, { a: Front; b: Front; impl?: Impl; labels: [string, string]; hot: Spec["hot"]; hold?: boolean }> = {
  lateral: { a: { la: 6, ra: 6, spread: 4 }, b: { la: 90, ra: 90, spread: 4 }, impl: "db", hot: { arms: true }, labels: ["Bras le long du corps", "Bras à l'horizontale"] },
  rear: { a: { la: 14, ra: 14, spread: 4, tilt: 0 }, b: { la: 88, ra: 88, spread: 4 }, impl: "db", hot: { arms: true, torso: true }, labels: ["Bras vers le bas, buste penché", "Bras ouverts, omoplates serrées"] },
  shrug: { a: { la: 4, ra: 4, spread: 4, shrug: 0 }, b: { la: 4, ra: 4, spread: 4, shrug: 1 }, impl: "db", hot: { torso: true }, labels: ["Épaules basses", "Épaules vers les oreilles"] },
  jack: { a: { la: 6, ra: 6, spread: 6 }, b: { la: 160, ra: 160, spread: 28, lift: 0.05 }, hot: { legs: true, arms: true }, labels: ["Pieds joints", "Bras et jambes ouverts"] },
  legAbduct: { a: { la: 6, ra: 6, spread: 4, legOut: 0 }, b: { la: 6, ra: 6, spread: 4, legOut: 38 }, hot: { legs: true }, labels: ["Jambes jointes", "Jambe écartée sur le côté"] },
  sidebend: { a: { la: 6, ra: 6, spread: 6, tilt: 0 }, b: { la: 6, ra: 6, spread: 6, tilt: -22 }, impl: "db", hot: { torso: true }, labels: ["Debout", "Flexion sur le côté"] },
  twist: { a: { la: 80, ra: 80, spread: 6, twist: -1 }, b: { la: 80, ra: 80, spread: 6, twist: 1 }, hot: { torso: true }, labels: ["Rotation à gauche", "Rotation à droite"] },
  cossack: { a: { la: 6, ra: 6, spread: 4, knee: 0 }, b: { la: 6, ra: 6, spread: 4, knee: 1 }, hot: { legs: true }, labels: ["Jambes écartées", "Fente latérale"] },
  armCircle: { a: { la: 20, ra: 20, spread: 4 }, b: { la: 150, ra: 150, spread: 4 }, hot: { arms: true }, labels: ["Bras bas", "Bras montés en cercle"] },
  armCross: { a: { la: 6, ra: 90, spread: 4 }, b: { la: 6, ra: 90, spread: 4 }, hold: true, hot: { arms: true }, labels: ["Bras tendu devant", "Tenir l'étirement"] },
};

const nz = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export type ExLike = { name: string; pattern?: string | null; equipment?: string[]; primary_muscles?: string[]; movement?: string };

/** Choisit le schéma qui décrit le mieux l'exercice (nom d'abord, modèle ensuite). Toujours un résultat. */
export function specFor(ex: ExLike): Spec {
  const n = nz(ex.name), pat = ex.pattern ?? "", eq = (ex.equipment ?? []).join(" ");
  const has = (re: RegExp) => re.test(n);
  const impl = (): Impl => (/kettlebell/.test(n + eq) ? "kb" : /poulie|elastique/.test(n + eq) ? "cable" : /machine|levier|iso-?lateral|hammer/.test(n) ? "handle" : /barre|smith/.test(n + eq) && !/halteres/.test(n) ? "bar" : /halteres|bouteilles|sac a dos/.test(n + eq) ? "db" : "none");
  const side = (id: string, over: Partial<Arch> = {}): Spec => { const a = L[id]; return { id, view: "side", a: a.a, b: a.b, impl: over.impl ?? a.impl ?? "none", furn: over.furn ?? a.furn ?? [], pulley: a.pulley, labels: a.labels ?? ["Départ", "Fin"], hold: a.hold, hot: a.hot ?? {} }; };
  const front = (id: string, impl?: Impl): Spec => { const f = F[id]; return { id, view: "front", a: P({}), b: P({}), impl: impl ?? f.impl ?? "none", furn: [], labels: f.labels, hold: f.hold, hot: f.hot, front: { a: f.a, b: f.b } }; };
  const withImpl = (id: string): Spec => side(id, { impl: impl() === "none" ? undefined : impl() });

  // --- étirements et mobilité (par mots-clés) ---
  if (pat === "stretch" || pat === "mob") {
    if (has(/quadriceps/)) return side("stretchQuad");
    if (has(/ischio|lombaires|genoux poitrine|chien/)) return side("stretchFold");
    if (has(/fleschisseurs|hanche|psoas|fente|pigeon|90\/90|adducteurs|papillon|squat profond/)) return side("stretchLunge");
    if (has(/enfant|fessiers allonge|rotation allongee|open book/)) return side("child");
    if (has(/cobra/)) return side("cobra");
    if (has(/chat-vache|quatre pattes/)) return side("catcow");
    if (has(/epaules|pectoraux|triceps|avant-bras|dislocations|wall slide|cercles d'epaules|halo/)) return front(has(/croise|triceps|pectoraux|avant-bras/) ? "armCross" : "armCircle");
    return side("breathe");
  }
  // --- cardio ---
  if (pat === "cardioSteady" || pat === "cardioHiit") {
    if (has(/velo|spinning|assault/)) return side("bike");
    if (has(/rameur|skierg|aviron/)) return side("rowerg");
    if (has(/jumping|corde|burpees|danse|zumba|aerobic|boxe|frappe|battle|sprawl/)) return front("jack");
    if (has(/course|sprint|talons|genoux|montees de genoux|footing|fractionnee|escalier|elliptique|traineau/)) return side("run");
    return side("walk");
  }
  // --- exercices de force : mots-clés précis d'abord ---
  if (has(/tractions? |^tractions|suspension|toes-to-bar/) && !has(/australiennes|assistees machine/)) return has(/releves|toes-to-bar|genoux suspendu|jambes suspendu/) ? side("hangRaise") : side("pullup");
  if (has(/releves de (genoux|jambes) (suspendu|chaise|machine)|toes-to-bar|windshield|dragon/)) return side("hangRaise");
  if (has(/australiennes|rowing inverse/)) return side("invRow");
  if (has(/mountain|sprawl/)) return side("climber");
  if (pat === "plank") return has(/mountain/) ? side("climber") : has(/haute|bras tendus|dynamique|shoulder|pike|araign|inversee|laterale|ball/) ? side("plank") : side("plankFore");
  if (pat === "crunch") return side("crunch");
  if (pat === "legraise") return side("legRaise");
  if (pat === "rot") return has(/flexion laterale|hip dips/) ? front("sidebend") : front("twist");
  if (pat === "carry") return withImpl("carry");
  if (pat === "lateral") return has(/frontales/) ? withImpl("curl") : front("lateral", impl() === "none" ? "db" : impl());
  if (pat === "rear") return has(/face pull|rotation externe/) ? side("seatedRow", { impl: "cable" }) : front("rear");
  if (pat === "shrug") return has(/tirage menton/) ? front("lateral", impl()) : front("shrug", impl() === "none" ? "db" : impl());
  if (pat === "dip") return side("dip");
  if (pat === "tricepsExt") return has(/au-dessus|nuque|deux mains|une main au/) ? withImpl("overheadExt") : has(/front|allonge|tate|jm|au sol/) ? withImpl("skull") : has(/kickback/) ? side("bentRow", { impl: "db" }) : withImpl("pushdown");
  if (pat === "curl") return has(/poignets|avant-bras/) ? withImpl("curl") : withImpl("curl");
  if (pat === "pushUp") return side("pushup");
  if (pat === "fly") return has(/poulie|crossover|pec deck|machine/) && !has(/banc|couche|incline/) ? withImpl("cableFly") : withImpl("liedFly");
  if (pat === "pushH") return has(/au sol/) ? side("floorPress", { impl: impl() === "none" ? "db" : impl() }) : has(/incline/) ? withImpl("benchInc") : withImpl("bench");
  if (pat === "pushV") return has(/assis|machine|arnold|presse|z-press|iso/) ? withImpl("seatPress") : withImpl("ohp");
  if (pat === "pullV") return has(/tirage|pull-?over|bras tendus|machine/) ? withImpl("pulldown") : side("pullup");
  if (pat === "pullH") return has(/penche|barre|haltere|kroc|kettlebell|landmine|t-bar|pendlay|gorille|renegat|meadows|sac a dos|serviette|inverse/) && !has(/machine|poulie|appui poitrine|assis|tirage horizontal/) ? withImpl("bentRow") : withImpl("seatedRow");
  if (pat === "lowback") return side("backExt");
  if (pat === "squat") return has(/presse|hack|machine|pendulaire|belt|leg press/) ? side("legPress") : has(/goblet|kettlebell|sumo haltere|sac a dos|haltere/) ? withImpl("goblet") : has(/barre|smith|avant|zercher|overhead|jefferson|banc|securite/) ? side("squatBar") : side("squat");
  if (pat === "lunge") return has(/laterale|cossack/) ? front("cossack") : withImpl("lunge");
  if (pat === "hinge") return has(/swing|kettlebell (clean|snatch)|clean|snatch/) ? side("swing") : has(/conventionnel|sumo|trap|rack pull|deficit|terre/) && !has(/roumain|jambes tendues/) ? withImpl("deadlift") : withImpl("hinge");
  if (pat === "olympic") return side("deadlift", { impl: "bar" });
  if (pat === "glute") return has(/kickback|donkey|fire hydrant|extension de hanche/) ? side("kickback") : has(/abduction|adduction|clamshell|marche laterale|laterale/) ? front("legAbduct") : side("bridge");
  if (pat === "legiso") return side("legCurl");
  if (pat === "legext") return side("legExt");
  if (pat === "calf") return side("calf", { impl: impl() === "none" ? "none" : "db" });
  if (pat === "plyo") return has(/pompes/) ? side("pushup") : side("jump");
  return side("breathe");
}

// ---------------- Rendu SVG ----------------
export type RenderOpts = { t: number; mode?: "figure" | "strip"; w?: number };

// ---- Mannequin : membres épais et effilés (capsules), contour + remplissage ----
const R = { thigh: [0.092, 0.066], shin: [0.062, 0.042], foot: [0.04, 0.034], torso: [0.1, 0.088], neck: [0.042, 0.038], uarm: [0.056, 0.046], farm: [0.046, 0.035], hand: 0.042, head: 0.1 } as const;
const n3 = (x: number) => +x.toFixed(3);
/** Capsule effilée entre deux articulations (rayons r0 en a, r1 en b), en un seul tracé. */
function capsule(a: V, b: V, r0: number, r1: number): string {
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
  if (d <= Math.abs(r0 - r1) + 1e-4) { const [c, r] = r0 >= r1 ? [a, r0] : [b, r1]; return disc(c, r); }
  const ux = dx / d, uy = dy / d, nx = -uy, ny = ux, sn = (r0 - r1) / d, cs = Math.sqrt(1 - sn * sn);
  const mp: V = [nx * cs + ux * sn, ny * cs + uy * sn], mm: V = [-nx * cs + ux * sn, -ny * cs + uy * sn];
  const q = (c: V, r: number, m: V) => `${n3(c[0] + r * m[0])} ${n3(c[1] + r * m[1])}`;
  return `M${q(a, r0, mp)}L${q(b, r1, mp)}A${r1} ${r1} 0 ${sn < 0 ? 1 : 0} 0 ${q(b, r1, mm)}L${q(a, r0, mm)}A${r0} ${r0} 0 ${sn > 0 ? 1 : 0} 0 ${q(a, r0, mp)}Z`;
}
const disc = (c: V, r: number) => `M${n3(c[0] - r)} ${n3(c[1])}a${r} ${r} 0 1 0 ${n3(2 * r)} 0a${r} ${r} 0 1 0 ${n3(-2 * r)} 0Z`;
const poly = (pts: V[]) => `M${pts.map((p) => `${n3(p[0])} ${n3(p[1])}`).join("L")}Z`;
/** Une partie du corps : tous les contours d'abord, puis tous les remplissages (le contour intérieur disparaît, seule la silhouette reste). */
const part = (shapes: string[], cls = "") => shapes.map((d) => `<path d="${d}" class="fg-o"/>`).join("") + shapes.map((d) => `<path d="${d}" class="fg-f ${cls}"/>`).join("");
const legShapes = (H: V, K: V, A: V, toe: V) => [capsule(H, K, R.thigh[0], R.thigh[1]), capsule(K, A, R.shin[0], R.shin[1]), capsule(A, toe, R.foot[0], R.foot[1])];
const f = (n: number) => +n.toFixed(3);
const seg = (a: V, b: V, cls: string) => `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" class="${cls}"/>`;

function sideInner(s: Spec, t: number) {
  const A = joints(s.a), B = joints(s.b), J = joints(lerpPose(s.a, s.b, t));
  const ground = Math.max(A.A[1], A.A2[1], B.A[1], B.A2[1], J.A[1]) + 0.01;
  const hot = s.hot;
  const out: string[] = [];
  // sol
  out.push(`<line x1="${f(Math.min(A.S[0], A.A[0], B.S[0], B.A[0]) - 0.6)}" y1="${f(ground)}" x2="${f(Math.max(A.S[0], A.A[0], B.S[0], B.A[0], A.W[0]) + 0.9)}" y2="${f(ground)}" class="fg-ground"/>`);
  // mobilier
  for (const fu of s.furn) {
    if (fu === "bench" || fu === "seat") {
      const top = A.H[1] + 0.075;
      const dirx = A.S[0] - A.H[0], diry = A.S[1] - A.H[1], len = Math.hypot(dirx, diry) || 1, nx = -diry / len, ny = dirx / len;
      const back: V = [A.H[0] + dirx - (nx > 0 ? nx : -nx) * 0.0, A.H[1] + diry];
      void back;
      const sx = A.H[0] + (nx * 0.07 * (ny > 0 ? 1 : -1)), sy = A.H[1] + 0.07;
      out.push(`<polyline points="${f(A.H[0] - 0.12)},${f(top)} ${f(A.H[0] + 0.5)},${f(top)}" class="fg-furn"/>`);
      out.push(`<line x1="${f(A.H[0] + 0.05)}" y1="${f(top)}" x2="${f(A.H[0] + 0.05)}" y2="${f(ground)}" class="fg-furn"/><line x1="${f(A.H[0] + 0.42)}" y1="${f(top)}" x2="${f(A.H[0] + 0.42)}" y2="${f(ground)}" class="fg-furn"/>`);
      out.push(`<line x1="${f(A.H[0] - 0.1)}" y1="${f(top)}" x2="${f(A.S[0] - 0.05)}" y2="${f(A.S[1] + 0.08)}" class="fg-furn"/>`);
      void sx; void sy;
    }
    if (fu === "pullbar") out.push(`<line x1="${f(A.W[0] - 0.28)}" y1="${f(A.W[1] - 0.02)}" x2="${f(A.W[0] + 0.28)}" y2="${f(A.W[1] - 0.02)}" class="fg-furn"/><line x1="${f(A.W[0] + 0.28)}" y1="${f(A.W[1] - 0.02)}" x2="${f(A.W[0] + 0.28)}" y2="${f(ground)}" class="fg-furn"/>`);
    if (fu === "dipbars") out.push(`<line x1="${f(A.W[0] - 0.2)}" y1="${f(A.W[1] + 0.03)}" x2="${f(A.W[0] + 0.2)}" y2="${f(A.W[1] + 0.03)}" class="fg-furn"/><line x1="${f(A.W[0])}" y1="${f(A.W[1] + 0.03)}" x2="${f(A.W[0])}" y2="${f(ground)}" class="fg-furn"/>`);
  }
  // poulie : câble
  if (s.impl === "cable" && s.pulley) {
    const px = A.A[0] + s.pulley[0] + (s.a.anchor === "hip" ? A.H[0] - A.A[0] : 0), py = (s.a.anchor === "hip" ? A.H[1] : A.A[1]) + s.pulley[1];
    out.push(`<line x1="${f(px)}" y1="${f(py)}" x2="${f(J.W[0])}" y2="${f(J.W[1])}" class="fg-cable"/><circle cx="${f(px)}" cy="${f(py)}" r="0.04" class="fg-furn-fill"/>`);
  }
  // mannequin : membres éloignés (plus clairs), tronc, jambe proche, tête, bras proche
  const dToe: V = [J.toe[0] - J.A[0], J.toe[1] - J.A[1]], toe2: V = [J.A2[0] + dToe[0], J.A2[1] + dToe[1]];
  out.push(part(legShapes(J.H, J.K2, J.A2, toe2), `far ${hot.legs ? "hot" : ""}`));
  const twoArms = J.E2[0] !== J.E[0] || J.E2[1] !== J.E[1];
  if (twoArms) out.push(part([capsule(J.S, J.E2, R.uarm[0], R.uarm[1]), capsule(J.E2, J.W2, R.farm[0], R.farm[1]), disc(J.W2, R.hand)], `far ${hot.arms ? "hot" : ""}`));
  out.push(part([capsule(J.H, J.S, R.torso[0], R.torso[1]), capsule(J.S, J.N, R.neck[0], R.neck[1])], hot.torso ? "hot" : ""));
  out.push(part(legShapes(J.H, J.K, J.A, J.toe), hot.legs ? "hot" : ""));
  out.push(part([disc(J.HD, R.head)], "head"));
  out.push(part([capsule(J.S, J.E, R.uarm[0], R.uarm[1]), capsule(J.E, J.W, R.farm[0], R.farm[1]), disc(J.W, R.hand)], hot.arms ? "hot" : ""));
  // accessoire tenu en main
  const [wx, wy] = J.W;
  if (s.impl === "bar") out.push(`<circle cx="${f(wx)}" cy="${f(wy)}" r="0.12" class="fg-plate"/><circle cx="${f(wx)}" cy="${f(wy)}" r="0.022" class="fg-dot"/>`);
  else if (s.impl === "db") out.push(`<circle cx="${f(wx)}" cy="${f(wy)}" r="0.055" class="fg-dot"/>`);
  else if (s.impl === "kb") out.push(`<circle cx="${f(wx)}" cy="${f(wy + 0.09)}" r="0.075" class="fg-dot"/>`);
  else if (s.impl === "handle" || s.impl === "cable") out.push(`<circle cx="${f(wx)}" cy="${f(wy)}" r="0.028" class="fg-dot"/>`);
  // cadre
  const pts = [A, B, J].flatMap((j) => [j.H, j.S, j.HD, j.A, j.A2, j.W, j.K, j.E]);
  if (s.impl === "cable" && s.pulley) pts.push([A.A[0] + s.pulley[0], (s.a.anchor === "hip" ? A.H[1] : A.A[1]) + s.pulley[1]]);
  pts.push([A.S[0] - 0.5, ground], [A.A[0] + 0.9, ground]);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { inner: out.join(""), box: [Math.min(...xs) - 0.16, Math.min(...ys) - 0.16, Math.max(...xs) + 0.16, Math.max(...ys) + 0.05] as [number, number, number, number] };
}

const fr = (p: Front, k: "l" | "r") => (k === "l" ? p.la : p.ra);
function frontInner(s: Spec, t: number) {
  const a = s.front!.a, b = s.front!.b;
  const lerp = (x: number | undefined, y: number | undefined) => (x ?? 0) + ((y ?? x ?? 0) - (x ?? 0)) * t;
  const p: Front = { la: lerp(a.la, b.la), ra: lerp(a.ra, b.ra), spread: lerp(a.spread, b.spread), shrug: lerp(a.shrug, b.shrug), tilt: lerp(a.tilt, b.tilt), lift: lerp(a.lift, b.lift), twist: lerp(a.twist, b.twist), knee: lerp(a.knee, b.knee), legOut: lerp(a.legOut, b.legOut) };
  const out: string[] = [];
  const kneeBend = (p.knee ?? 0) * 0.16, hipY = -(LH + LS) + kneeBend + (p.lift ? -p.lift : 0);
  const H: V = [0, hipY], tilt = rad(p.tilt ?? 0);
  const S: V = [H[0] + Math.sin(tilt) * LT, H[1] - Math.cos(tilt) * LT - (p.shrug ?? 0) * 0.0];
  const sw = 0.19, shr = (p.shrug ?? 0) * 0.05;
  const SL: V = [S[0] - sw * Math.cos(tilt), S[1] - sw * Math.sin(tilt) - shr], SR: V = [S[0] + sw * Math.cos(tilt), S[1] + sw * Math.sin(tilt) - shr];
  const arm = (sh: V, ang: number, side: number): [V, V] => { const e = add(sh, [side * LU * Math.sin(rad(ang)), LU * Math.cos(rad(ang))]); const wv = add(e, [side * LF * Math.sin(rad(ang * 0.9)), LF * Math.cos(rad(ang * 0.9))]); return [e, wv]; };
  const [EL, WL] = arm(SL, p.la, -1), [ER, WR] = arm(SR, p.ra, 1);
  const hw = 0.09, spread = Math.sin(rad(p.spread)) * (LH + LS);
  const gnd = 0;
  const hl: V = [H[0] - hw, H[1]], hr: V = [H[0] + hw, H[1]];
  const out_ = p.legOut ?? 0;
  const kl: V = [hl[0] - spread * 0.5 - (p.knee ?? 0) * 0.12, hl[1] + LH * 0.95], al: V = [hl[0] - spread - (p.knee ?? 0) * 0.3, gnd];
  const kr: V = [hr[0] + spread * 0.5 + Math.sin(rad(out_)) * LH, hr[1] + LH * Math.cos(rad(out_)) * 0.95], ar: V = [hr[0] + spread + Math.sin(rad(out_)) * (LH + LS) * 0.9, Math.min(gnd, hr[1] + (LH + LS) * Math.cos(rad(out_)))];
  const tw = (p.twist ?? 0) * 0.16;
  out.push(`<line x1="-0.9" y1="0" x2="0.9" y2="0" class="fg-ground"/>`);
  const hot = s.hot;
  const WL2: V = s.id === "twist" ? [S[0] + tw * 1.4, S[1] + 0.3] : WL, WR2: V = s.id === "twist" ? [S[0] + tw * 1.4, S[1] + 0.3] : WR;
  const EL2: V = s.id === "twist" ? [S[0] - 0.12 + tw, S[1] + 0.18] : EL, ER2: V = s.id === "twist" ? [S[0] + 0.12 + tw, S[1] + 0.18] : ER;
  const footL: V = [al[0] - 0.09, al[1]], footR: V = [ar[0] + 0.09, ar[1]];
  const hc = hot.legs ? "hot" : "";
  out.push(part([capsule(hl, kl, R.thigh[0] * 0.92, R.thigh[1]), capsule(kl, al, R.shin[0], R.shin[1]), capsule(al, footL, R.foot[0], R.foot[1])], hc));
  out.push(part([capsule(hr, kr, R.thigh[0] * 0.92, R.thigh[1]), capsule(kr, ar, R.shin[0], R.shin[1]), capsule(ar, footR, R.foot[0], R.foot[1])], hc));
  // tronc : un seul contour lisse (épaules arrondies, taille, bassin)
  const hipW = 0.16, waist = 0.115, mid = (H[1] + S[1]) / 2 + 0.05, top = Math.min(SL[1], SR[1]) - 0.05;
  const q = (x: number, y: number) => `${n3(x)} ${n3(y)}`;
  const torso = `M${q(SL[0] - 0.045, SL[1] + 0.04)}Q${q(SL[0] - 0.05, top)} ${q(SL[0] + 0.05, top)}L${q(SR[0] - 0.05, top)}Q${q(SR[0] + 0.05, top)} ${q(SR[0] + 0.045, SR[1] + 0.04)}`
    + `C${q(SR[0] + 0.0, SR[1] + 0.22)} ${q(H[0] + waist + 0.01, mid - 0.1)} ${q(H[0] + waist, mid)}C${q(H[0] + waist, mid + 0.07)} ${q(H[0] + hipW, H[1] - 0.02)} ${q(H[0] + hipW, H[1] + 0.05)}`
    + `Q${q(H[0] + hipW, H[1] + 0.12)} ${q(H[0] + hipW - 0.05, H[1] + 0.12)}L${q(H[0] - hipW + 0.05, H[1] + 0.12)}Q${q(H[0] - hipW, H[1] + 0.12)} ${q(H[0] - hipW, H[1] + 0.05)}`
    + `C${q(H[0] - hipW, H[1] - 0.02)} ${q(H[0] - waist, mid + 0.07)} ${q(H[0] - waist, mid)}C${q(H[0] - waist - 0.01, mid - 0.1)} ${q(SL[0] - 0.0, SL[1] + 0.22)} ${q(SL[0] - 0.045, SL[1] + 0.04)}Z`;
  out.push(part([capsule(S, [S[0] + Math.sin(tilt) * 0.12, S[1] - Math.cos(tilt) * 0.12], R.neck[0], R.neck[1])], ""));
  out.push(part([torso], hot.torso ? "hot" : ""));
  const ac = hot.arms ? "hot" : "";
  out.push(part([capsule(SL, EL2, R.uarm[0], R.uarm[1]), capsule(EL2, WL2, R.farm[0], R.farm[1]), disc(WL2, R.hand)], ac));
  out.push(part([capsule(SR, ER2, R.uarm[0], R.uarm[1]), capsule(ER2, WR2, R.farm[0], R.farm[1]), disc(WR2, R.hand)], ac));
  const head: V = [S[0] + Math.sin(tilt) * 0.17, S[1] - Math.cos(tilt) * 0.17];
  out.push(part([disc(head, R.head)], "head"));
  if (s.impl === "db" || s.impl === "kb") out.push(`<circle cx="${f(WL2[0])}" cy="${f(WL2[1])}" r="0.055" class="fg-dot"/><circle cx="${f(WR2[0])}" cy="${f(WR2[1])}" r="0.055" class="fg-dot"/>`);
  const pts: V[] = [[-0.55, 0], [0.55, 0], [-0.55, -2.0], [0.55, -2.0], WL, WR, S, ar, al, head];
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  return { inner: out.join(""), box: [Math.min(...xs), Math.min(...ys) - 0.05, Math.max(...xs), Math.max(...ys) + 0.04] as [number, number, number, number] };
}

/** Marqueur SVG complet (sans balise externe de style : les classes fg-* sont stylées dans globals.css). */
export function figureSvg(s: Spec, t: number, aspect = 1.35, maxAspect = aspect): { viewBox: string; inner: string } {
  const r = s.view === "side" ? sideInner(s, t) : frontInner(s, t);
  // le cadre est calculé sur l'ensemble du mouvement pour que l'image ne « danse » pas pendant l'animation
  const box = s.view === "side" ? [sideInner(s, 0).box, sideInner(s, 1).box, r.box] : [r.box];
  let [x0, y0, x1, y1] = [Math.min(...box.map((b) => b[0])), Math.min(...box.map((b) => b[1])), Math.max(...box.map((b) => b[2])), Math.max(...box.map((b) => b[3]))];
  let w = x1 - x0, h = y1 - y0; const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  // le cadre reste entre deux formats : une figure allongée (gainage, étirement) n'est pas noyée dans un grand vide
  if (w / h < aspect) w = h * aspect; else if (w / h > maxAspect) h = w / maxAspect;
  w *= 1.16; h *= 1.16;
  return { viewBox: `${f(cx - w / 2)} ${f(cy - h / 2)} ${f(w)} ${f(h)}`, inner: r.inner };
}
export const ARCHETYPES = [...Object.keys(L), ...Object.keys(F)];

/** Accès direct à un archétype (planche-contact de contrôle, tests). */
export function specById(id: string): Spec {
  if (L[id]) { const a = L[id]; return { id, view: "side", a: a.a, b: a.b, impl: a.impl ?? "none", furn: a.furn ?? [], pulley: a.pulley, labels: a.labels ?? ["Départ", "Fin"], hold: a.hold, hot: a.hot ?? {} }; }
  const fr2 = F[id]; return { id, view: "front", a: P({}), b: P({}), impl: fr2.impl ?? "none", furn: [], labels: fr2.labels, hold: fr2.hold, hot: fr2.hot, front: { a: fr2.a, b: fr2.b } };
}

/** Types de mouvement proposés à la création d'un exercice privé (choisit le schéma). */
export const PATTERN_CHOICES: [string, string][] = [
  ["pushUp", "Pompe (poussée au sol)"], ["pushH", "Développé couché / presse pectorale"], ["pushV", "Développé épaules"], ["fly", "Écarté / pec deck"], ["lateral", "Élévation latérale"], ["rear", "Oiseau / arrière d'épaule"],
  ["tricepsExt", "Extension triceps"], ["dip", "Dips"], ["pullV", "Traction / tirage vertical"], ["pullH", "Rowing / tirage horizontal"], ["curl", "Curl biceps"], ["shrug", "Haussement d'épaules"],
  ["squat", "Squat / presse"], ["lunge", "Fentes / step-up"], ["hinge", "Charnière de hanche / soulevé de terre"], ["glute", "Pont fessier / hip thrust"], ["legiso", "Leg curl (ischio-jambiers)"], ["legext", "Leg extension"], ["calf", "Mollets"],
  ["plank", "Gainage"], ["crunch", "Crunch / abdominaux"], ["legraise", "Relevé de jambes"], ["rot", "Rotation / flexion du tronc"], ["carry", "Marche chargée"], ["cardioSteady", "Cardio régulier"], ["cardioHiit", "Cardio par intervalles"], ["mob", "Mobilité"], ["stretch", "Étirement"],
];
