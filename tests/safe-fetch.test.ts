import { describe, it, expect, afterAll, beforeAll } from "vitest";
import http from "node:http";
import zlib from "node:zlib";
import { isPublicAddress, validateUrl, guardedLookup, fetchPage, FetchRefused, type RawResponse } from "@/lib/safe-fetch";

describe("import par adresse : protection du serveur (SSRF)", () => {
  it("reconnaît les adresses privées, locales ou réservées, y compris sous forme IPv6 enveloppée", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.32.0.1", "2606:4700:4700::1111"]) expect(isPublicAddress(ip), ip).toBe(true);
    for (const ip of ["127.0.0.1", "127.5.5.5", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "224.0.0.1", "255.255.255.255", "198.18.0.1",
      "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:10.0.0.1", "::ffff:169.254.169.254", "64:ff9b::7f00:1", "2002:7f00:1::1", "::127.0.0.1", "2001:db8::1", "abc", "999.1.1.1", ""]) expect(isPublicAddress(ip), ip).toBe(false);
  });
  it("refuse les adresses dangereuses avant toute connexion", () => {
    for (const u of ["file:///etc/passwd", "ftp://exemple.fr/x", "javascript:alert(1)", "data:text/html,x", "http://localhost/", "http://LOCALHOST./", "http://127.0.0.1/", "http://[::1]/", "http://10.0.0.1/", "http://169.254.169.254/latest/meta-data/",
      "http://user:pw@exemple.fr/", "http://exemple.fr:8080/", "http://exemple.fr:22/", "http://intranet/", "http://base.internal/", "http://nas.local/", "http://2130706433/", "http://0x7f.0.0.1/", "http://127.1/", "http://[::ffff:127.0.0.1]/", "", "pas une adresse", "https://" + "a".repeat(2100) + ".fr/"])
      expect(() => validateUrl(u), u).toThrow(FetchRefused);
    expect(validateUrl("https://www.marmiton.org/recettes/recette_pate-a-crepes_12372.aspx").hostname).toBe("www.marmiton.org");
    expect(validateUrl("http://exemple.fr/a?b=1#c").protocol).toBe("http:");
  });
  it("la résolution DNS n'accepte que des adresses publiques (une adresse privée parmi d'autres suffit à refuser)", async () => {
    const run = (addrs: { address: string; family: number }[], opts: any = {}) => new Promise<any>((res) => guardedLookup([], (_h, cb) => cb(null, addrs))("exemple.fr", opts, (e: any, a: any, f: any) => res({ e, a, f })));
    expect((await run([{ address: "93.184.216.34", family: 4 }])).a).toBe("93.184.216.34");
    expect((await run([{ address: "93.184.216.34", family: 4 }], { all: true })).a).toHaveLength(1);
    expect((await run([{ address: "127.0.0.1", family: 4 }])).e).toBeInstanceOf(FetchRefused);
    expect((await run([{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.5", family: 4 }], { all: true })).e).toBeInstanceOf(FetchRefused); // rebinding : une des réponses est privée
    expect((await run([{ address: "::ffff:192.168.0.1", family: 6 }])).e).toBeInstanceOf(FetchRefused);
    expect((await run([])).e).toBeInstanceOf(FetchRefused);
    const priv = await new Promise<any>((res) => guardedLookup(["localhost:3918"], (_h, cb) => cb(null, [{ address: "127.0.0.1", family: 4 }]))("localhost", {}, (e: any, a: any) => res({ e, a })));
    expect(priv.a).toBe("127.0.0.1"); // exception explicite pour cet hôte seulement
    expect((await new Promise<any>((res) => guardedLookup(["localhost:3918"], (_h, cb) => cb(null, [{ address: "127.0.0.1", family: 4 }]))("autre.fr", {}, (e: any) => res(e)))) instanceof FetchRefused).toBe(true);
  });

  const page = (status: number, body = "<html></html>", headers: Record<string, string> = { "content-type": "text/html; charset=utf-8" }): RawResponse => ({ status, headers, body: Buffer.from(body) });
  const script = (map: Record<string, RawResponse>) => { const seen: string[] = []; return { seen, transport: async (u: URL) => { seen.push(u.toString()); const r = map[u.toString()]; if (!r) throw Object.assign(new Error("inconnu"), { code: "ENOTFOUND" }); return r; } }; };
  it("suit les redirections une à une et les revalide", async () => {
    const s = script({ "https://a.fr/": page(302, "", { location: "/b" }), "https://a.fr/b": page(301, "", { location: "https://c.fr/fin" }), "https://c.fr/fin": page(200, "<p>ok</p>") });
    const r = await fetchPage("https://a.fr/", { transport: s.transport });
    expect(r.html).toBe("<p>ok</p>"); expect(r.url).toBe("https://c.fr/fin"); expect(s.seen).toHaveLength(3);
    for (const evil of ["http://127.0.0.1/admin", "http://169.254.169.254/latest/meta-data/", "file:///etc/passwd", "http://localhost:3000/api/me", "http://[::1]/", "javascript:alert(1)"]) {
      const t = script({ "https://a.fr/": page(302, "", { location: evil }) });
      await expect(fetchPage("https://a.fr/", { transport: t.transport }), evil).rejects.toBeInstanceOf(FetchRefused);
      expect(t.seen).toEqual(["https://a.fr/"]); // la cible dangereuse n'est jamais contactée
    }
    const loop = script({ "https://a.fr/": page(302, "", { location: "/" }) });
    await expect(fetchPage("https://a.fr/", { transport: loop.transport })).rejects.toThrow(/redirections/);
  });
  it("messages clairs : page absente, lecture refusée, erreur du site, contenu qui n'est pas une page", async () => {
    const t = (r: RawResponse) => fetchPage("https://a.fr/", { transport: async () => r });
    await expect(t(page(404))).rejects.toThrow(/introuvable/); await expect(t(page(403))).rejects.toThrow(/refuse la lecture automatique/); await expect(t(page(429))).rejects.toThrow(/refuse/);
    await expect(t(page(500))).rejects.toThrow(/erreur/); await expect(t(page(200, "x", { "content-type": "image/png" }))).rejects.toThrow(/pas à une page web|ne mène pas/);
    await expect(fetchPage("https://inconnu.fr/", { transport: script({}).transport })).rejects.toThrow(/introuvable/);
  });

  // transport réel contre un petit serveur local (adresses privées autorisées uniquement ici)
  let srv: http.Server, base = "";
  const big = "x".repeat(300_000);
  beforeAll(async () => {
    srv = http.createServer((req, res) => {
      const u = req.url ?? "";
      if (u === "/latin1") { res.writeHead(200, { "content-type": "text/html; charset=iso-8859-1" }); return res.end(Buffer.from("<p>crème brûlée à 3 œufs</p>", "latin1")); }
      if (u === "/meta") { res.writeHead(200, { "content-type": "text/html" }); return res.end(Buffer.from('<meta charset="windows-1252"><p>café crème</p>', "latin1")); }
      if (u === "/gzip") { res.writeHead(200, { "content-type": "text/html", "content-encoding": "gzip" }); return res.end(zlib.gzipSync("<p>compressé ✓</p>")); }
      if (u === "/br") { res.writeHead(200, { "content-type": "text/html", "content-encoding": "br" }); return res.end(zlib.brotliCompressSync("<p>brotli ✓</p>")); }
      if (u === "/big") { res.writeHead(200, { "content-type": "text/html" }); return res.end(big); }
      if (u === "/bomb") { res.writeHead(200, { "content-type": "text/html", "content-encoding": "gzip" }); return res.end(zlib.gzipSync("a".repeat(5_000_000))); }
      if (u === "/slow") { res.writeHead(200, { "content-type": "text/html" }); res.write("<p>"); return void setTimeout(() => res.end("fin"), 3000); }
      if (u === "/goutte") { res.writeHead(200, { "content-type": "text/html" }); const t = setInterval(() => res.write("x"), 100); res.on("close", () => clearInterval(t)); return; }
      if (u === "/r") { res.writeHead(302, { location: "/latin1" }); return res.end(); }
      if (u === "/png") { res.writeHead(200, { "content-type": "image/png" }); return res.end("x"); }
      res.writeHead(404); res.end();
    });
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r)); base = `http://127.0.0.1:${(srv.address() as any).port}`;
  });
  afterAll(() => new Promise<void>((r) => srv.close(() => r())));
  const get = (p: string, o: any = {}) => fetchPage(base + p, { allow: [new URL(base).host], ...o });
  it("transport réel : accents (en-tête ou balise meta), compression gzip/brotli, redirection", async () => {
    expect((await get("/latin1")).html).toContain("crème brûlée");
    expect((await get("/meta")).html).toContain("café crème");
    expect((await get("/gzip")).html).toBe("<p>compressé ✓</p>"); expect((await get("/br")).html).toBe("<p>brotli ✓</p>");
    expect((await get("/r")).html).toContain("crème");
  });
  it("transport réel : taille, durée et type de contenu bornés ; adresses locales refusées par défaut", async () => {
    await expect(get("/big", { maxBytes: 100_000 })).rejects.toThrow(/volumineuse/);
    await expect(get("/bomb", { maxBytes: 1_000_000 })).rejects.toThrow(/volumineuse/); // page compressée qui gonfle
    await expect(get("/slow", { timeoutMs: 300 })).rejects.toThrow(/temps/);
    const t0 = Date.now(); await expect(get("/goutte", { timeoutMs: 300 })).rejects.toThrow(/temps/); expect(Date.now() - t0).toBeLessThan(1500); // un octet toutes les 100 ms ne contourne pas la durée totale
    await expect(get("/png")).rejects.toThrow(/page web/);
    await expect(fetchPage(base + "/latin1")).rejects.toBeInstanceOf(FetchRefused); // sans exception explicite : refusé (adresse locale, port non standard)
  });
});
