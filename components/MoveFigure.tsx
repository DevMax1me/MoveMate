"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { figureSvg, specFor, type ExLike } from "@/lib/figures";

/** Vignette : deux images « départ → fin » côte à côte, sans animation (légère pour les listes). */
export function FigureStrip({ ex }: { ex: ExLike }) {
  const spec = useMemo(() => specFor(ex), [ex.name, ex.pattern, ex.equipment?.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const a = useMemo(() => figureSvg(spec, 0, 1.15, 1.7), [spec]), b = useMemo(() => figureSvg(spec, 1, 1.15, 1.7), [spec]);
  return (
    <div className="strip" role="img" aria-label={`Schéma : ${spec.labels[0]}, puis ${spec.labels[1]}`}>
      <svg viewBox={a.viewBox} dangerouslySetInnerHTML={{ __html: a.inner }} />
      <span className="arrow" aria-hidden="true">→</span>
      <svg viewBox={b.viewBox} dangerouslySetInnerHTML={{ __html: b.inner }} />
    </div>
  );
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** Schéma animé : va-et-vient entre le départ et la fin, avec pause aux extrémités. Respecte « réduire les animations ». */
export default function MoveFigure({ ex }: { ex: ExLike }) {
  const spec = useMemo(() => specFor(ex), [ex.name, ex.pattern, ex.equipment?.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const [t, setT] = useState(0), [playing, setPlaying] = useState(false), [reduced, setReduced] = useState(false);
  const raf = useRef<number | null>(null);
  useEffect(() => { const m = window.matchMedia("(prefers-reduced-motion: reduce)"); setReduced(m.matches); setPlaying(!m.matches); }, []);
  useEffect(() => { if (spec.hold) setT(1); }, [spec]);
  useEffect(() => {
    if (spec.hold || !playing) return; // position tenue : rien à animer
    const start = performance.now(), MOVE = 1500, PAUSE = 450, CYCLE = 2 * (MOVE + PAUSE);
    const loop = (now: number) => {
      const c = (now - start) % CYCLE;
      const v = c < MOVE ? ease(c / MOVE) : c < MOVE + PAUSE ? 1 : c < 2 * MOVE + PAUSE ? 1 - ease((c - MOVE - PAUSE) / MOVE) : 0;
      setT(v);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [playing, spec]);
  const fig = figureSvg(spec, spec.hold && playing ? 1 : t, 1.3, 2.1);
  const phase = t < 0.25 ? spec.labels[0] : t > 0.75 ? spec.labels[1] : `${spec.labels[0]} → ${spec.labels[1]}`;
  return (
    <div className="movefig">
      <svg viewBox={fig.viewBox} role="img" aria-label={`Schéma du mouvement : ${spec.labels[0]}, puis ${spec.labels[1]}`} dangerouslySetInnerHTML={{ __html: fig.inner }} />
      <div className="row spread" style={{ marginTop: 6, alignItems: "flex-start" }}>
        <p className="small" aria-live="polite" style={{ margin: 0, minHeight: "2.6em" }}><b>{spec.hold && playing ? spec.labels[1] : phase}</b></p>
        <div className="row" style={{ gap: ".3rem" }}>
          <button className="round" aria-label={playing ? "Mettre en pause" : "Lancer l’animation"} onClick={() => setPlaying(!playing)}><svg viewBox="0 0 24 24" aria-hidden="true">{playing ? <path d="M8 5v14M16 5v14" /> : <path d="M7 4l12 8-12 8z" />}</svg></button>
        </div>
      </div>
      <div className="row" style={{ gap: ".4rem", marginTop: 4 }} role="group" aria-label="Étapes du mouvement">
        <button className="chip-b" aria-pressed={!playing && t === 0} onClick={() => { setPlaying(false); setT(0); }}>1 · Départ</button>
        <button className="chip-b" aria-pressed={!playing && t === 1} onClick={() => { setPlaying(false); setT(1); }}>2 · {spec.hold ? "Position tenue" : "Fin du mouvement"}</button>
      </div>
      {reduced && <p className="small muted">Animation désactivée par vos réglages : utilisez les boutons Départ et Fin.</p>}
      <p className="small muted" style={{ marginTop: 6 }}>Schéma simplifié : il montre l’idée du mouvement, pas la technique complète ni la charge. En cas de doute, regardez la vidéo.</p>
    </div>
  );
}
