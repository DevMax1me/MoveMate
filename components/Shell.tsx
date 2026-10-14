"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { api, useApi } from "@/lib/client";
import { Toaster } from "./ui";
import Mascot from "./Mascot";

export type Me = { id: string; email: string; role: "user" | "admin"; name: string | null; tz: string; ai_enabled: boolean; memory_enabled: boolean; today: string };
export const MeContext = createContext<Me | null>(null);
export const useMe = () => useContext(MeContext)!;

const I = {
  today: <><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.3M12 19.2v2.3M2.5 12h2.3M19.2 12h2.3M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" /></>,
  food: <path d="M6.5 3v7a2.5 2.5 0 0 0 5 0V3M9 3v18M17.5 21V3c-2.2 1.4-3.5 4.2-3.5 7.5V14h3.5" />,
  training: <path d="M3 9.5v5M6 7v10M18 7v10M21 9.5v5M6 12h12" />,
  progress: <path d="M3.5 20.5h17M5 16l4.2-5 3.3 3L19 6.5M15 6.5h4v4" />,
  more: <path d="M5.5 12h.01M12 12h.01M18.5 12h.01" strokeWidth="3.4" />,
  notebook: <path d="M6 3.5h11a1.5 1.5 0 0 1 1.5 1.5v14A1.5 1.5 0 0 1 17 20.5H6zM9 8h6M9 12h6" />,
  agent: <path d="M12 3.5l1.7 4.3 4.3 1.7-4.3 1.7L12 15.5l-1.7-4.3L6 9.5l4.3-1.7zM18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />,
  account: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" /></>,
  exercises: <path d="M4 20l5-5m0 0l-2-2 3-3 4 4-3 3zM13 6l2-2 5 5-2 2" />,
  admin: <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />,
};
type Key = keyof typeof I;
const ico = (k: Key) => <svg viewBox="0 0 24 24" aria-hidden="true">{I[k]}</svg>;
// [href, libellé court, libellé complet, icône, couleur de rubrique, couleur du texte dessus]
const MAIN: [string, string, string, Key, string, string][] = [
  ["/today", "Aujourd’hui", "Aujourd’hui", "today", "var(--sun)", "var(--ink)"], ["/food", "Repas", "Alimentation", "food", "var(--tomato)", "var(--on-color)"],
  ["/training", "Sport", "Entraînement", "training", "var(--violet)", "var(--on-color)"], ["/progress", "Progrès", "Progression", "progress", "var(--green)", "var(--on-color)"],
];
const MORE: [string, string, Key, string][] = [["/exercises", "Exercices", "exercises", "var(--violet)"], ["/notebook", "Carnet", "notebook", "var(--sky)"], ["/agent", "Mon agent", "agent", "var(--pink)"], ["/account", "Mon compte", "account", "var(--sun)"]];
const zoneOf = (p: string) => (p.split("/")[1] || "today");
const zoneInk = (z: string) => (z === "today" || z === "account" || z === "admin" ? "var(--ink)" : "var(--on-color)");

type Theme = "auto" | "light" | "dark";
function ThemeToggle() {
  const [t, setT] = useState<Theme>("auto");
  useEffect(() => { try { const v = localStorage.getItem("tm-theme"); if (v === "light" || v === "dark") setT(v); } catch { /* stockage indisponible */ } }, []);
  function next() {
    const n: Theme = t === "auto" ? "light" : t === "light" ? "dark" : "auto";
    setT(n);
    if (n === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", n);
    try { n === "auto" ? localStorage.removeItem("tm-theme") : localStorage.setItem("tm-theme", n); } catch { /* ignoré */ }
  }
  const icon = t === "light" ? <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" /></> : t === "dark" ? <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /> : <><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" /></>;
  return <button className="round" onClick={next} aria-label={`Thème : ${t === "auto" ? "automatique" : t === "light" ? "clair" : "sombre"}. Changer`} title="Thème"><svg viewBox="0 0 24 24" aria-hidden="true">{icon}</svg></button>;
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [more, setMore] = useState(false);
  const active = useApi<{ workout: { id: string; name: string } | null }>(me ? "/workouts/active" : null);
  useEffect(() => { api<{ user: Me | null }>("/me").then((r) => { if (!r.user) router.replace("/login"); else setMe(r.user); }).catch(() => setMe(null)); }, [router]);
  useEffect(() => { setMore(false); active.reload(); /* eslint-disable-next-line */ }, [path]);
  if (me === undefined) return <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }} role="status"><Mascot mood="happy" size={72} /><p className="muted">Un instant…</p></div>;
  if (me === null) return <div className="main"><div className="notice err">Impossible de joindre le serveur. <button onClick={() => location.reload()}>Réessayer</button></div></div>;
  const cur = (h: string) => (path === h || path.startsWith(h + "/") ? "page" : undefined);
  const zone = zoneOf(path);
  const extra: [string, string, Key, string][] = me.role === "admin" ? [["/admin", "Administration", "admin", "var(--sun)"]] : [];
  return (
    <div className="shell" data-zone={zone}>
      <nav className="side" aria-label="Navigation principale">
        <Link className="word" href="/today"><Mascot size={34} mood="wink" color="var(--sun)" />terminator</Link>
        {MAIN.map(([h, , full, k, c, ink]) => <Link key={h} className="nav" href={h} aria-current={cur(h)} style={{ ["--z" as string]: c, ["--zi" as string]: ink }}><span className="chip">{ico(k)}</span>{full}</Link>)}
        <div className="sep" />
        {[...MORE, ...extra].map(([h, l, k, c]) => <Link key={h} className="nav" href={h} aria-current={cur(h)} style={{ ["--z" as string]: c, ["--zi" as string]: c === "var(--sun)" ? "var(--ink)" : "var(--on-color)" }}><span className="chip">{ico(k)}</span>{l}</Link>)}
        <div className="foot row spread"><span className="small muted" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{me.name ?? me.email}</span><ThemeToggle /></div>
      </nav>
      <main className="main" id="contenu">
        <div className="topbar"><Link className="word" href="/today"><Mascot size={34} mood="wink" color="var(--sun)" />terminator</Link><ThemeToggle /></div>
        {active.data?.workout && !path.startsWith("/training") && <div className="banner" role="status"><span>Séance en cours · {active.data.workout.name}</span><Link href="/training">Reprendre</Link></div>}
        <MeContext.Provider value={me}>{children}</MeContext.Provider>
      </main>
      <nav className="dock" aria-label="Navigation principale">
        {MAIN.map(([h, l, , k, c, ink]) => <Link key={h} href={h} aria-current={cur(h)} style={{ ["--z" as string]: c, ["--zi" as string]: ink }}>{ico(k)}{l}</Link>)}
        <button onClick={() => setMore(!more)} aria-expanded={more} aria-label="Plus de rubriques" style={{ ["--z" as string]: "var(--bg)", ["--zi" as string]: "var(--ink)" }} {...(more ? { "aria-current": "page" as const } : {})}>{ico("more")}Plus</button>
      </nav>
      {more && <div className="more" role="menu">{[...MORE, ...extra].map(([h, l, k]) => <Link key={h} href={h} aria-current={cur(h)}><span className="row" style={{ gap: ".7rem" }}>{ico(k)}{l}</span><span aria-hidden="true">→</span></Link>)}</div>}
      <Toaster />
    </div>
  );
}
void zoneInk;
