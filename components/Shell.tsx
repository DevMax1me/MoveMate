"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { api, useApi } from "@/lib/client";
import { Toaster } from "./ui";

export type Me = { id: string; email: string; role: "user" | "admin"; name: string | null; tz: string; ai_enabled: boolean; memory_enabled: boolean; today: string };
export const MeContext = createContext<Me | null>(null);
export const useMe = () => useContext(MeContext)!;

const I = {
  today: <path d="M4 5h16v14H4zM4 9h16M8 3v4M16 3v4M8 13h3" />,
  food: <path d="M7 3v8a2 2 0 0 0 2 2v8M7 3v5M11 3v5M9 3v18M17 3c-2 2-3 5-3 8h3v10" />,
  training: <path d="M2 12h3M19 12h3M5 8v8M8 6v12M16 6v12M19 8v8M8 12h8" />,
  progress: <path d="M3 3v18h18M7 15l4-5 3 3 5-7" />,
  more: <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth="3" />,
};
const MAIN = [["/today", "Aujourd’hui", "today"], ["/food", "Repas", "food"], ["/training", "Sport", "training"], ["/progress", "Progrès", "progress"]] as const;
const MORE = [["/exercises", "Exercices"], ["/notebook", "Carnet"], ["/agent", "Mon agent"], ["/account", "Mon compte"]] as const;
const FULL: Record<string, string> = { "/today": "Aujourd’hui", "/food": "Alimentation", "/training": "Entraînement", "/progress": "Progression" };
const ico = (k: keyof typeof I) => <svg viewBox="0 0 24 24" aria-hidden="true">{I[k]}</svg>;

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
  return <button className="theme" onClick={next} aria-label={`Thème : ${t === "auto" ? "automatique" : t === "light" ? "clair" : "sombre"}. Changer`}>{t === "auto" ? "Auto" : t === "light" ? "Clair" : "Sombre"}</button>;
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [more, setMore] = useState(false);
  const active = useApi<{ workout: { id: string; name: string } | null }>(me ? "/workouts/active" : null);
  useEffect(() => { api<{ user: Me | null }>("/me").then((r) => { if (!r.user) router.replace("/login"); else setMe(r.user); }).catch(() => setMe(null)); }, [router]);
  useEffect(() => { setMore(false); active.reload(); /* eslint-disable-next-line */ }, [path]);
  if (me === undefined) return <p className="muted" style={{ padding: 20 }} role="status">Chargement…</p>;
  if (me === null) return <div className="main"><div className="notice err">Impossible de joindre le serveur. <button onClick={() => location.reload()}>Réessayer</button></div></div>;
  const cur = (h: string) => (path === h || path.startsWith(h + "/") ? "page" : undefined);
  const extra = me.role === "admin" ? ([["/admin", "Administration"]] as const) : [];
  return (
    <div className="shell">
      <nav className="side" aria-label="Navigation principale">
        <Link className="word" href="/today">TERMINATOR</Link>
        {MAIN.map(([h, , k]) => <Link key={h} className="nav" href={h} aria-current={cur(h)}>{ico(k)}{FULL[h]}</Link>)}
        <div style={{ height: 1, background: "var(--rule)", margin: "14px 0" }} />
        {[...MORE, ...extra].map(([h, l]) => <Link key={h} className="nav" href={h} aria-current={cur(h)}><span style={{ width: 22 }} />{l}</Link>)}
        <div className="foot row spread"><span className="small muted" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{me.name ?? me.email}</span><ThemeToggle /></div>
      </nav>
      <main className="main" id="contenu">
        <div className="topbar"><Link className="word" href="/today">TERMINATOR</Link><ThemeToggle /></div>
        {active.data?.workout && !path.startsWith("/training") && <div className="banner" role="status"><span>Séance en cours · {active.data.workout.name}</span><Link href="/training">Reprendre</Link></div>}
        <MeContext.Provider value={me}>{children}</MeContext.Provider>
      </main>
      <nav className="bottom" aria-label="Navigation principale">
        {MAIN.map(([h, l, k]) => <Link key={h} href={h} aria-current={cur(h)}>{ico(k)}{l}</Link>)}
        <button onClick={() => setMore(!more)} aria-expanded={more} aria-label="Plus de rubriques">{ico("more")}Plus</button>
      </nav>
      {more && <div className="more" role="menu">{[...MORE, ...extra].map(([h, l]) => <Link key={h} href={h} aria-current={cur(h)}>{l}<span aria-hidden="true">→</span></Link>)}</div>}
      <Toaster />
    </div>
  );
}
