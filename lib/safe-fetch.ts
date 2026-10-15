// Téléchargement d'une page web à la demande de l'utilisateur, avec protection contre l'abus du serveur comme relais (SSRF) :
// http(s) uniquement, ports standards, jamais d'adresse privée ou locale (vérifiée à la connexion, donc aussi après redirection ou résolution DNS trompeuse),
// redirections suivies une à une et revalidées, taille, durée et type de contenu bornés.
import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import net from "node:net";
import zlib from "node:zlib";

/** Refus attendu (message affichable à l'utilisateur), par opposition à une panne réseau. */
export class FetchRefused extends Error {}

const BLOCK = new net.BlockList();
for (const [a, p] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]] as [string, number][]) BLOCK.addSubnet(a, p, "ipv4");
for (const [a, p] of [["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8], ["2001:db8::", 32], ["2001::", 32], ["100::", 64]] as [string, number][]) BLOCK.addSubnet(a, p, "ipv6");

/** 8 groupes de 16 bits d'une adresse IPv6, ou null. */
function v6Groups(ip: string): number[] | null {
  let s = ip.split("%")[0].toLowerCase();
  const dotted = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) { const o = dotted[1].split(".").map(Number); if (o.some((n) => n > 255)) return null; s = s.slice(0, -dotted[1].length) + ((o[0] << 8) | o[1]).toString(16) + ":" + ((o[2] << 8) | o[3]).toString(16); }
  const halves = s.split("::"); if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [], tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0 || (halves.length === 1 && head.length !== 8)) return null;
  const g = [...head, ...Array(fill).fill("0"), ...tail].map((x) => parseInt(x, 16));
  return g.length === 8 && g.every((n) => Number.isInteger(n) && n >= 0 && n <= 0xffff) ? g : null;
}
const v4From = (a: number, b: number) => `${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`;

/** Adresse routable publiquement (ni privée, ni locale, ni réservée) ; les formes IPv6 qui enveloppent une IPv4 sont jugées sur l'IPv4. */
export function isPublicAddress(ip: string): boolean {
  const fam = net.isIP(ip);
  if (fam === 4) return !BLOCK.check(ip, "ipv4");
  if (fam !== 6) return false;
  const g = v6Groups(ip); if (!g) return false;
  const zeros = (n: number) => g.slice(0, n).every((x) => x === 0);
  if (zeros(5) && g[5] === 0xffff) return isPublicAddress(v4From(g[6], g[7]));       // ::ffff:a.b.c.d
  if (zeros(6) && (g[6] || g[7]) && !(g[6] === 0 && g[7] === 1)) return isPublicAddress(v4From(g[6], g[7])); // ::a.b.c.d (déprécié)
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return isPublicAddress(v4From(g[6], g[7])); // NAT64
  if (g[0] === 0x2002) return isPublicAddress(v4From(g[1], g[2]));                    // 6to4
  return !BLOCK.check(ip.split("%")[0], "ipv6");
}

/** Vérifie l'adresse avant toute connexion ; lève FetchRefused avec un message clair. */
export function validateUrl(raw: string, allow: string[] = []): URL {
  if (typeof raw !== "string" || !raw.trim() || raw.length > 2000) throw new FetchRefused("Adresse vide ou trop longue.");
  let u: URL;
  try { u = new URL(raw.trim()); } catch { throw new FetchRefused("Adresse invalide : copiez l'adresse complète de la page (https://…)."); }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new FetchRefused("Seules les adresses http:// et https:// sont acceptées.");
  if (u.username || u.password) throw new FetchRefused("Les adresses contenant un identifiant ou un mot de passe sont refusées.");
  if (allow.includes(u.host)) return u; // exception explicite « hôte:port » (tests, développement)
  if (u.port && u.port !== (u.protocol === "https:" ? "443" : "80")) throw new FetchRefused("Les adresses avec un port particulier sont refusées.");
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
  if (!host) throw new FetchRefused("Adresse invalide.");
  if (net.isIP(host)) { if (!isPublicAddress(host)) throw new FetchRefused("Cette adresse pointe vers un réseau privé ou local : elle est refusée."); }
  else if (host === "localhost" || /\.(local|localhost|internal|intranet|lan|home|corp|localdomain)$/.test(host) || !host.includes(".")) throw new FetchRefused("Cette adresse pointe vers un réseau privé ou local : elle est refusée.");
  return u;
}

type Resolver = (host: string, cb: (err: NodeJS.ErrnoException | null, addrs: dns.LookupAddress[]) => void) => void;
/** Résolution DNS qui n'accepte que des adresses publiques : la connexion se fait sur l'adresse vérifiée (pas de seconde résolution). */
export function guardedLookup(allow: string[], resolve: Resolver = (h, cb) => dns.lookup(h, { all: true, verbatim: true }, cb)) {
  return (hostname: string, options: any, cb: any) => {
    resolve(hostname, (err, addrs) => {
      if (err) return cb(err);
      if (!addrs.length || (!allow.some((a) => a.split(":")[0] === hostname) && !addrs.every((a) => isPublicAddress(a.address)))) return cb(new FetchRefused("Cette adresse pointe vers un réseau privé ou local : elle est refusée."));
      if (options && options.all) return cb(null, addrs);
      cb(null, addrs[0].address, addrs[0].family);
    });
  };
}

export type RawResponse = { status: number; headers: Record<string, string | string[] | undefined>; body: Buffer };
/** allow : exceptions explicites « hôte:port » (tests, développement) ; vide en production. */
export type FetchOpts = { maxBytes?: number; timeoutMs?: number; maxRedirects?: number; allow?: string[]; transport?: (u: URL) => Promise<RawResponse> };

function realTransport(u: URL, o: Required<Pick<FetchOpts, "maxBytes" | "timeoutMs" | "allow">>): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    let done = false;
    // durée totale bornée : un site qui goutte un octet à la fois ne doit pas occuper le serveur indéfiniment
    const overall = setTimeout(() => { if (!done) { done = true; reject(new FetchRefused("Le site met trop de temps à répondre.")); } req.destroy(); }, o.timeoutMs * 2);
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request({
      protocol: u.protocol, hostname: u.hostname.replace(/^\[|\]$/g, ""), port: u.port || undefined, path: u.pathname + u.search, method: "GET", agent: false,
      headers: { "user-agent": process.env.RECIPE_IMPORT_USER_AGENT || "Mozilla/5.0 (compatible; Terminator/1.1; import de recette demandé par l'utilisateur)", accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5", "accept-language": "fr,en;q=0.8", "accept-encoding": "gzip, deflate, br" },
      lookup: guardedLookup(o.allow) as any,
    }, (res) => {
      const fail = (e: Error) => { if (done) return; done = true; clearTimeout(overall); reject(e); res.destroy(); req.destroy(); };
      const ok = (r: RawResponse) => { if (done) return; done = true; clearTimeout(overall); resolve(r); };
      const enc = String(res.headers["content-encoding"] ?? "").toLowerCase();
      const dec = enc === "gzip" ? zlib.createGunzip() : enc === "deflate" ? zlib.createInflate() : enc === "br" ? zlib.createBrotliDecompress() : null;
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400) { res.resume(); return ok({ status, headers: res.headers, body: Buffer.alloc(0) }); }
      const src: NodeJS.ReadableStream = dec ? res.pipe(dec) : res;
      const chunks: Buffer[] = []; let n = 0;
      // la taille se compte APRÈS décompression : une petite page compressée ne doit pas pouvoir gonfler en mémoire
      src.on("data", (c: Buffer) => { n += c.length; if (n > o.maxBytes) { dec?.destroy(); return fail(new FetchRefused("Page trop volumineuse.")); } chunks.push(c); });
      src.on("end", () => ok({ status, headers: res.headers, body: Buffer.concat(chunks) }));
      src.on("error", (e) => fail(e as Error)); res.on("error", (e) => fail(e));
    });
    req.setTimeout(o.timeoutMs, () => { if (!done) { done = true; clearTimeout(overall); reject(new FetchRefused("Le site met trop de temps à répondre.")); } req.destroy(); });
    req.on("error", (e) => { if (!done) { done = true; clearTimeout(overall); reject(e); } });
    req.end();
  });
}

function decode(body: Buffer, contentType: string): string {
  let cs = contentType.match(/charset=["']?([\w-]+)/i)?.[1];
  if (!cs) cs = body.subarray(0, 4096).toString("latin1").match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ?? body.subarray(0, 4096).toString("latin1").match(/<meta[^>]+content=["'][^"']*charset=([\w-]+)/i)?.[1] ?? "utf-8";
  try { return new TextDecoder(cs).decode(body); } catch { return new TextDecoder("utf-8").decode(body); }
}

/** Télécharge une page HTML (au plus quelques redirections, chacune revalidée). Lève FetchRefused avec un message affichable. */
export async function fetchPage(raw: string, opts: FetchOpts = {}): Promise<{ url: string; html: string }> {
  const o = { maxBytes: opts.maxBytes ?? 2_500_000, timeoutMs: opts.timeoutMs ?? 10_000, allow: opts.allow ?? [] };
  const maxRedirects = opts.maxRedirects ?? 4;
  const send = opts.transport ?? ((u: URL) => realTransport(u, o));
  let u = validateUrl(raw, o.allow);
  const deadline = Date.now() + o.timeoutMs * 2;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    validateUrl(u.toString(), o.allow);
    let res: RawResponse;
    try { res = await send(u); }
    catch (e: any) {
      if (e instanceof FetchRefused) throw e;
      if (e?.cause instanceof FetchRefused) throw e.cause;
      const code = e?.code ?? e?.cause?.code;
      if (code === "ENOTFOUND" || code === "EAI_AGAIN") throw new FetchRefused("Site introuvable : vérifiez l'adresse.");
      if (code === "CERT_HAS_EXPIRED" || /certificate|SSL|TLS/i.test(String(e?.message))) throw new FetchRefused("Le certificat de sécurité du site n'est pas valide.");
      throw new FetchRefused("Impossible de joindre ce site pour le moment. Collez plutôt la liste des ingrédients.");
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = String(res.headers.location ?? "");
      if (!loc) throw new FetchRefused("Redirection invalide.");
      if (hop === maxRedirects || Date.now() > deadline) throw new FetchRefused("Trop de redirections.");
      let next: URL; try { next = new URL(loc, u); } catch { throw new FetchRefused("Redirection invalide."); }
      u = validateUrl(next.toString(), o.allow);
      continue;
    }
    if (res.status === 404 || res.status === 410) throw new FetchRefused("Page introuvable (adresse erronée ou recette retirée).");
    if (res.status === 401 || res.status === 402 || res.status === 403 || res.status === 429 || res.status === 451) throw new FetchRefused(`Le site refuse la lecture automatique (code ${res.status}). Collez plutôt la liste des ingrédients.`);
    if (res.status < 200 || res.status >= 300) throw new FetchRefused(`Le site a répondu par une erreur (code ${res.status}).`);
    const ct = String(res.headers["content-type"] ?? "").toLowerCase();
    if (ct && !/html|xml|json|text\/plain/.test(ct)) throw new FetchRefused("Cette adresse ne mène pas à une page web (type de contenu non pris en charge).");
    return { url: u.toString(), html: decode(res.body, ct) };
  }
  throw new FetchRefused("Trop de redirections.");
}
