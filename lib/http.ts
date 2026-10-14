import { NextRequest, NextResponse } from "next/server";
import { ApiError, requireUser, requireAdmin, type User, purgeExpired } from "./auth";
import { CalcError } from "./calc";

export type Ctx = { req: NextRequest; user: User; params: string[]; query: URLSearchParams; body: any; url: URL };
export type Handler = (c: Ctx) => unknown | Promise<unknown>;
type Route = { method: string; pattern: string[]; handler: Handler; auth: "none" | "user" | "admin" };

export class Router {
  routes: Route[] = [];
  add(method: string, path: string, handler: Handler, auth: Route["auth"] = "user") {
    this.routes.push({ method, pattern: path.split("/").filter(Boolean), handler, auth });
    return this;
  }
  get = (p: string, h: Handler, a?: Route["auth"]) => this.add("GET", p, h, a);
  post = (p: string, h: Handler, a?: Route["auth"]) => this.add("POST", p, h, a);
  put = (p: string, h: Handler, a?: Route["auth"]) => this.add("PUT", p, h, a);
  del = (p: string, h: Handler, a?: Route["auth"]) => this.add("DELETE", p, h, a);
  admin = { get: (p: string, h: Handler) => this.add("GET", p, h, "admin"), post: (p: string, h: Handler) => this.add("POST", p, h, "admin"), put: (p: string, h: Handler) => this.add("PUT", p, h, "admin") };

  async handle(req: NextRequest, segs: string[]): Promise<Response> {
    try {
      const method = req.method;
      if (method !== "GET" && method !== "HEAD") {
        // Défense CSRF : même origine obligatoire en plus du cookie SameSite.
        const origin = req.headers.get("origin");
        if (origin && new URL(origin).host !== req.headers.get("host")) throw new ApiError(403, "Origine refusée.");
      }
      for (const r of this.routes) {
        if (r.method !== method || r.pattern.length !== segs.length) continue;
        const params: string[] = [];
        let ok = true;
        for (let i = 0; i < segs.length; i++) {
          if (r.pattern[i].startsWith(":")) params.push(decodeURIComponent(segs[i]));
          else if (r.pattern[i] !== segs[i]) { ok = false; break; }
        }
        if (!ok) continue;
        const user = r.auth === "none" ? (null as unknown as User) : r.auth === "admin" ? await requireAdmin() : await requireUser();
        let body: any = {};
        if (method !== "GET" && method !== "DELETE") { try { body = await req.json(); } catch { body = {}; } }
        const url = new URL(req.url);
        if (Math.random() < 0.01) purgeExpired();
        const out = await r.handler({ req, user, params, query: url.searchParams, body, url });
        if (out instanceof Response) return out;
        return NextResponse.json(out ?? { ok: true });
      }
      throw new ApiError(404, "Ressource introuvable.");
    } catch (e) {
      if (e instanceof ApiError) return NextResponse.json({ error: e.message, ...e.extra }, { status: e.status });
      if (e instanceof CalcError) return NextResponse.json({ error: e.message }, { status: 422 });
      // Journaux techniques : jamais de valeurs métier (poids, repas, notes).
      console.error("[api]", e instanceof Error ? e.message : "erreur");
      return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
    }
  }
}

export const bad = (m: string, extra?: Record<string, unknown>) => new ApiError(400, m, extra);
export const notFound = (m = "Introuvable.") => new ApiError(404, m);
export const str = (v: unknown, name: string, max = 500, required = true): string => {
  if (v == null || v === "") { if (required) throw bad(`${name} est requis.`); return ""; }
  if (typeof v !== "string") throw bad(`${name} invalide.`);
  if (v.length > max) throw bad(`${name} trop long.`);
  return v.trim();
};
export const numOrNull = (v: unknown, name: string, opts: { min?: number; max?: number } = {}): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) throw bad(`${name} doit être un nombre.`);
  if (opts.min != null && n < opts.min) throw bad(`${name} doit être ≥ ${opts.min}.`);
  if (opts.max != null && n > opts.max) throw bad(`${name} doit être ≤ ${opts.max}.`);
  return n;
};
export const num = (v: unknown, name: string, opts: { min?: number; max?: number } = {}): number => {
  const n = numOrNull(v, name, opts);
  if (n == null) throw bad(`${name} est requis.`);
  return n;
};
export const dateStr = (v: unknown, name = "Date"): string => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v))) throw bad(`${name} invalide (AAAA-MM-JJ).`);
  return v;
};
export const todayIn = (tz: string, at = new Date()): string => {
  try { return new Intl.DateTimeFormat("sv-SE", { timeZone: tz }).format(at); } catch { return at.toISOString().slice(0, 10); }
};
export const J = (v: unknown) => JSON.stringify(v ?? null);
export const P = <T = any>(s: unknown, d: T): T => { try { return s ? JSON.parse(String(s)) : d; } catch { return d; } };

/** Concurrence optimiste : si le client indique la version qu'il a lue et qu'elle n'est plus la dernière, conflit plutôt qu'écrasement. */
export function checkVersion(body: any, current: number) {
  if (body?.version != null && Number(body.version) !== current) throw new ApiError(409, "Cette ressource a été modifiée ailleurs depuis votre lecture. Rechargez avant de la modifier.", { current_version: current });
}
