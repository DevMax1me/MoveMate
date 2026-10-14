import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = { title: { default: "Terminator — suivi alimentaire et sportif", template: "%s · Terminator" }, description: "Repas et calories, poids et progression, entraînements maison et salle. Un agent personnalisé qui s'adapte à votre rythme.", manifest: "/manifest.webmanifest", icons: { icon: "/icon.svg" }, applicationName: "Terminator" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f6e5a" };

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <a className="skip" href="#contenu">Aller au contenu</a>
        {children}
      </body>
    </html>
  );
}
