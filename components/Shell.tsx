"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, useApi } from "@/lib/client";
import { Toaster } from "./ui";

export type Me = { id: string; email: string; role: "user" | "admin"; name: string | null; tz: string; ai_enabled: boolean; memory_enabled: boolean; today: string };
const MAIN = [["/today", "Aujourd’hui", "◉"], ["/food", "Alimentation", "🍽"], ["/training", "Entraînement", "🏋"], ["/progress", "Progression", "📈"]] as const;
const MORE = [["/exercises", "Exercices"], ["/notebook", "Carnet"], ["/agent", "Mon agent"], ["/account", "Mon compte"]] as const;

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [more, setMore] = useState(false);
  const active = useApi<{ workout: { id: string; name: string } | null }>(me ? "/workouts/active" : null);
  useEffect(() => { api<{ user: Me | null }>("/me").then((r) => { if (!r.user) router.replace("/login"); else setMe(r.user); }).catch(() => setMe(null)); }, [router]);
  useEffect(() => { setMore(false); active.reload(); /* eslint-disable-next-line */ }, [path]);
  if (me === undefined) return <p className="muted" style={{ padding: 20 }} role="status">Chargement…</p>;
  if (me === null) return <div className="pub"><div className="notice err">Impossible de joindre le serveur. <button onClick={() => location.reload()}>Réessayer</button></div></div>;
  const items = [...MAIN.map(([h, l]) => [h, l] as const), ...MORE, ...(me.role === "admin" ? [["/admin", "Administration"] as const] : [])];
  const cur = (h: string) => (path === h || path.startsWith(h + "/") ? "page" : undefined);
  return (
    <div className="shell">
      <nav className="side" aria-label="Navigation principale">
        <p className="big" style={{ fontSize: "1.3rem", padding: "0 .9rem 12px" }}>Terminator</p>
        {items.map(([h, l]) => <Link key={h} href={h} aria-current={cur(h)}>{l}</Link>)}
      </nav>
      <main className="main" id="contenu">
        {active.data?.workout && !path.startsWith("/training") && <div className="banner" role="status"><span>Séance en cours : {active.data.workout.name}</span><Link href="/training">Reprendre</Link></div>}
        {active.data?.workout && path.startsWith("/training") && null}
        <MeContext.Provider value={me}>{children}</MeContext.Provider>
      </main>
      <nav className="bottom" aria-label="Navigation principale">
        {MAIN.map(([h, l, ic]) => <Link key={h} href={h} aria-current={cur(h)}><span className="ic" aria-hidden="true">{ic}</span>{l}</Link>)}
        <button onClick={() => setMore(!more)} aria-expanded={more} aria-label="Plus de rubriques"><span className="ic" aria-hidden="true">⋯</span>Plus</button>
      </nav>
      {more && <div className="more" role="menu">{[...MORE, ...(me.role === "admin" ? [["/admin", "Administration"] as const] : [])].map(([h, l]) => <Link key={h} href={h} aria-current={cur(h)}>{l}</Link>)}</div>}
      <Toaster />
    </div>
  );
}
import { createContext, useContext } from "react";
export const MeContext = createContext<Me | null>(null);
export const useMe = () => useContext(MeContext)!;
