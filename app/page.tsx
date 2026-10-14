import Link from "next/link";

const STEPS = [
  ["01", "Noter un repas", "Total calorique et macros en trois gestes. Ce qui est inconnu reste inconnu : jamais compté comme zéro."],
  ["02", "Faire sa séance", "Charges et répétitions réellement effectuées, repos chronométré, comparaisons seulement entre choses comparables."],
  ["03", "Lire sa progression", "Moyenne mobile sur 7 jours, couverture toujours affichée, aucune date de réussite inventée."],
  ["04", "Garder la main", "L’agent propose, explique ce qu’il utilise, et n’écrit rien sans votre accord."],
];
export default function Home() {
  return (
    <div className="main" style={{ maxWidth: 820, paddingBottom: 40 }}>
      <div className="topbar"><span className="word">TERMINATOR</span><span className="row"><Link className="btn" href="/login">Connexion</Link></span></div>
      <header style={{ padding: "56px 0 40px", borderBottom: "1px solid var(--ink)" }}>
        <p className="mono small" style={{ letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink2)" }}>Suivi alimentaire et sportif</p>
        <h1 style={{ fontSize: "clamp(2.6rem,8vw,4.8rem)", lineHeight: 0.95, letterSpacing: "-.045em", margin: "10px 0 18px" }}>Ce que vous mangez.<br />Ce que vous soulevez.<br /><span style={{ boxShadow: "inset 0 -.22em var(--accent)" }}>Ce qui change.</span></h1>
        <p style={{ maxWidth: 520, fontSize: "1.1rem", color: "var(--ink2)" }}>Un carnet précis pour repas, poids et entraînements, maison ou salle. Chaque compte a son profil, sa mémoire privée et un rythme qui lui est propre.</p>
        <div className="row" style={{ marginTop: 26 }}><Link className="btn primary" href="/register">Créer un compte</Link><Link className="btn" href="/login">J’ai déjà un compte</Link></div>
      </header>
      <section>{STEPS.map(([n, t, d]) => (
        <div key={n} className="item" style={{ alignItems: "baseline", padding: "20px 0", gap: "1.4rem" }}>
          <span className="mono" style={{ color: "var(--accent)", fontWeight: 700 }}>{n}</span>
          <div><b style={{ fontSize: "1.1rem" }}>{t}</b><p className="muted">{d}</p></div>
        </div>))}</section>
      <p className="muted small" style={{ marginTop: 28 }}>Service réservé aux adultes, sans usage médical. <Link href="/confidentialite">Confidentialité</Link></p>
    </div>
  );
}
