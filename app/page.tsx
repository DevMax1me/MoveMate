import Link from "next/link";
export default function Home() {
  return (
    <div className="pub">
      <div className="hero">
        <p className="muted small" style={{ letterSpacing: ".1em" }}>PLATEFORME DE SUIVI ALIMENTAIRE ET SPORTIF</p>
        <h1 style={{ fontSize: "2.2rem" }}>Terminator</h1>
        <p>Repas et calories · Poids et progression · Entraînements maison et salle</p>
        <p className="muted">Chaque compte a son profil, sa mémoire privée et un accompagnement qui part de vos habitudes, pas d’un programme imposé.</p>
        <div className="row" style={{ justifyContent: "center", marginTop: 16 }}>
          <Link className="btn primary" href="/register">Créer un compte</Link>
          <Link className="btn" href="/login">Se connecter</Link>
        </div>
      </div>
      <div className="grid g2">
        <div className="card"><h3>Noter un repas</h3><p className="muted">Total calorique et macronutriments, valeurs inconnues jamais comptées comme zéro.</p></div>
        <div className="card"><h3>Réaliser une séance</h3><p className="muted">Charges et répétitions réellement effectuées, minuteur de repos, comparaisons honnêtes.</p></div>
        <div className="card"><h3>Comprendre sa progression</h3><p className="muted">Moyenne mobile sur 7 jours, couverture affichée, aucune date de réussite inventée.</p></div>
        <div className="card"><h3>Un agent qui propose, vous décidez</h3><p className="muted">Chaque proposition explique ce qu’elle utilise et ne s’applique qu’après votre confirmation.</p></div>
      </div>
      <p className="muted small" style={{ marginTop: 24 }}>Service réservé aux adultes, sans usage médical. <Link href="/confidentialite">Politique de confidentialité</Link></p>
    </div>
  );
}
