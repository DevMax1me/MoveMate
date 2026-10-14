import Link from "next/link";
import Mascot from "@/components/Mascot";

const TILES = [
  ["Noter un repas", "Calories et macros en trois gestes. Ce qu’on ne sait pas reste « inconnu », jamais compté comme zéro.", "var(--tomato)", "#fff", "happy"],
  ["Faire sa séance", "Charges et répétitions réellement faites, repos chronométré, comparaisons honnêtes.", "var(--violet)", "#fff", "cheer"],
  ["Voir où l’on en est", "Moyenne sur 7 jours, jours manquants laissés vides, aucune date de réussite inventée.", "var(--green)", "#fff", "wink"],
  ["Rester aux commandes", "L’agent propose et explique. Il n’écrit rien sans ton feu vert.", "var(--sun)", "var(--ink)", "happy"],
] as const;

export default function Home() {
  return (
    <div className="main" data-zone="today" style={{ maxWidth: 980, paddingBottom: 48 }}>
      <div className="topbar"><span className="word"><Mascot size={36} mood="wink" color="var(--sun)" />terminator</span><span className="row"><Link className="btn" href="/login">Connexion</Link></span></div>
      <header className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", alignItems: "center", gap: 28, padding: "28px 0 36px" }}>
        <div>
          <p className="badge acc" style={{ fontSize: ".8rem", padding: "0 .9rem" }}>Repas · Poids · Séances</p>
          <h1 style={{ fontSize: "clamp(2.6rem,9vw,4.6rem)", lineHeight: .95, margin: ".9rem 0 1.2rem", paddingBottom: ".6rem" }}>Un carnet qui te ressemble.</h1>
          <p style={{ fontSize: "1.15rem", color: "var(--ink2)", maxWidth: 440 }}>Note ce que tu manges, ce que tu soulèves et ce qui change. À ton rythme, sans te juger, avec un petit compagnon qui garde le fil.</p>
          <div className="row" style={{ marginTop: 24 }}><Link className="btn primary" href="/register">Créer mon carnet</Link><Link className="btn" href="/login">J’ai déjà un compte</Link></div>
        </div>
        <div style={{ position: "relative", minHeight: 330 }} aria-hidden="true">
          <div style={{ position: "absolute", inset: "0 6% 0 6%", background: "var(--sun)", borderRadius: "46% 54% 42% 58% / 52% 44% 56% 48%", transform: "rotate(-6deg)" }} />
          <div style={{ position: "absolute", left: "50%", top: "46%", transform: "translate(-50%,-50%)" }}><Mascot size={190} mood="cheer" color="#fffdf8" /></div>
          <div className="card" style={{ position: "absolute", left: 0, top: 10, transform: "rotate(-5deg)", padding: "10px 16px", borderRadius: 22 }}><div className="small muted">Il te reste</div><b style={{ fontSize: "1.5rem", letterSpacing: "-.03em" }}>642 kcal</b></div>
          <div className="card" style={{ position: "absolute", right: 0, top: 70, transform: "rotate(4deg)", padding: "10px 16px", borderRadius: 22 }}><div className="small muted">Squat</div><b style={{ fontSize: "1.5rem", letterSpacing: "-.03em" }}>8 × 40 kg</b></div>
          <div className="card" style={{ position: "absolute", left: "12%", bottom: 6, transform: "rotate(3deg)", padding: "10px 16px", borderRadius: 22 }}><div className="small muted">Moyenne 7 jours</div><b style={{ fontSize: "1.5rem", letterSpacing: "-.03em" }}>78,4 kg</b></div>
        </div>
      </header>
      <section className="grid g2" style={{ gap: 14 }}>
        {TILES.map(([t, d, bg, fg, mood]) => (
          <div key={t} style={{ background: bg, color: fg, borderRadius: "34px 26px 38px 24px / 26px 36px 24px 34px", padding: "22px 22px 24px", display: "flex", gap: 14, alignItems: "flex-start" }}>
            <Mascot size={54} mood={mood} color="#fffdf8" />
            <div><b style={{ fontSize: "1.25rem", letterSpacing: "-.02em" }}>{t}</b><p style={{ marginTop: 6, opacity: .92 }}>{d}</p></div>
          </div>))}
      </section>
      <p className="muted small" style={{ marginTop: 28 }}>Réservé aux adultes, sans usage médical. <Link href="/confidentialite">Confidentialité</Link></p>
    </div>
  );
}
