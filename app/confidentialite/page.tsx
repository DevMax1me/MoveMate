import Link from "next/link";
export const metadata = { title: "Confidentialité" };
export default function Privacy() {
  return (
    <div className="main" id="contenu" style={{ maxWidth: 560, paddingBottom: 40 }}>
      <div className="topbar"><Link className="word" href="/">TERMINATOR</Link></div>
      <h1>Confidentialité et protection des données</h1>
      <p className="notice">Version de travail : le texte juridique définitif (base légale, responsable de traitement, hébergement, AIPD) doit être validé par un interlocuteur qualifié avant ouverture publique.</p>
      <h2>Nature des données</h2>
      <p>Le croisement du poids, des apports et de l’activité peut révéler des informations sur votre santé. Le service est conçu avec une protection renforcée : accès contrôlé par propriétaire, aucune vente, aucune publicité ciblée, aucun traceur tiers non essentiel, aucun entraînement de modèle sur vos données privées.</p>
      <h2>Données collectées</h2>
      <p>Adresse électronique, mot de passe (haché), journal alimentaire, pesées et mensurations facultatives, séances, activités, notes, profil de mode de vie. Pas d’adresse postale, de géolocalisation, de dossier médical ni de contacts.</p>
      <h2>Agent personnalisé</h2>
      <p>Facultatif. Avant activation, l’écran « Mon agent » indique précisément ce qui est transmis à un éventuel fournisseur, pourquoi et pour combien de temps. Sans fournisseur configuré, l’agent fonctionne localement. Le retrait de l’activation arrête les envois ; vous pouvez effacer la mémoire associée.</p>
      <h2>Conservation</h2>
      <ul>
        <li>Journaux et carnet : pendant l’usage du compte ; avertissement après 24 mois d’inactivité.</li>
        <li>Conversations de l’agent : 90 jours ; faits mémorisés jusqu’au retrait ou à la suppression.</li>
        <li>Suppression du compte : accès bloqué immédiatement, données privées purgées.</li>
        <li>Exports temporaires : lien valable 24 h, supprimé après téléchargement.</li>
        <li>Journaux techniques : sans valeur métier (jamais de poids, repas ni notes).</li>
      </ul>
      <h2>Vos droits</h2>
      <p>Export (JSON, CSV), correction, suppression et consultation de la mémoire de l’agent sont disponibles dans « Mon compte » et « Mon agent ». Service réservé aux adultes, sans usage médical : il ne pose aucun diagnostic et ne prescrit rien.</p>
      <p><Link href="/">Accueil</Link></p>
    </div>
  );
}
