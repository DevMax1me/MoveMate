"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export class ApiFail extends Error { constructor(public status: number, message: string, public data?: any) { super(message); } }
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch("/api" + path, { method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"), headers: opts.body !== undefined ? { "content-type": "application/json" } : undefined, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined, credentials: "same-origin" });
  let data: any = null;
  try { data = await res.json(); } catch { /* corps vide */ }
  if (!res.ok) throw new ApiFail(res.status, data?.error ?? "Erreur réseau ou serveur.", data);
  return data as T;
}

export function useApi<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const seq = useRef(0);
  const reload = useCallback(async () => {
    if (!path) return;
    const n = ++seq.current;
    setLoading(true);
    try { const d = await api<T>(path); if (n === seq.current) { setData(d); setError(null); } }
    catch (e: any) { if (n === seq.current) setError(!navigator.onLine ? "Hors connexion : réessayez quand le réseau revient." : e.message); }
    finally { if (n === seq.current) setLoading(false); }
  }, [path]);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, loading, reload, setData };
}

export const localToday = (tz?: string) => { try { return new Intl.DateTimeFormat("sv-SE", { timeZone: tz }).format(new Date()); } catch { return new Date().toISOString().slice(0, 10); } };
export const shiftDate = (d: string, n: number) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export const fmtDate = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
export const fmtShort = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
export const nf = (n: number | null | undefined, max = 1) => (n == null ? "—" : n.toLocaleString("fr-FR", { maximumFractionDigits: max }));
export const uuid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
