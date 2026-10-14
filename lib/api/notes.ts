import { Router, bad, notFound, str, J, P, todayIn, checkVersion } from "../http";
import { all, get, run, tx, uid, nowIso } from "../db";

const TYPES = ["fait", "preference", "observation", "ancien_conseil", "recette", "repere", "methode", "priorite"];
const STATUSES = ["personnelle", "a_verifier", "validee", "archivee"];
const TOPICS = ["objectifs", "alimentation", "recettes", "entrainement", "recuperation", "mesures", "retour_experience", "general"];

const noteIn = (b: any) => ({
  title: str(b.title, "Titre", 150), content: str(b.content, "Contenu", 10000),
  tags: J((Array.isArray(b.tags) ? b.tags : String(b.tags ?? "").split(",")).map((t: unknown) => String(t).trim().slice(0, 30)).filter(Boolean).slice(0, 15)),
  type: TYPES.includes(b.type) ? b.type : "observation", topic: TOPICS.includes(b.topic) ? b.topic : "general",
  source: str(b.source, "Source", 200, false) || null, source_date: b.source_date && /^\d{4}-\d{2}-\d{2}$/.test(b.source_date) ? b.source_date : null,
  status: STATUSES.includes(b.status) ? b.status : "a_verifier",
});
const noteOut = (n: any) => ({ ...n, tags: P(n.tags, []) });

/** Import éditorial (CON 02) : proposition de fiches à relire ; rien n'est enregistré sans validation. Le texte est une donnée, jamais une instruction. */
export function proposeCards(text: string) {
  const blocks = text.replace(/\r/g, "").split(/\n\s*(?:-{3,}|={3,})\s*\n|\n{2,}(?=#)/).map((b) => b.trim()).filter(Boolean).slice(0, 100);
  return blocks.map((b) => {
    const lines = b.split("\n");
    const first = lines[0].replace(/^#+\s*/, "").slice(0, 120);
    const date = b.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1] ?? b.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/)?.slice(1).reverse().map((x, i) => (i === 0 ? x : x.padStart(2, "0"))).join("-") ?? null;
    const looksGoal = /objectif|cible|kcal|calories/i.test(b);
    return {
      title: first || "Fiche importée", content: (lines.length > 1 ? lines.slice(1).join("\n") : b).trim().slice(0, 10000), source_date: date, tags: [], topic: looksGoal ? "objectifs" : "general",
      type: /conseil/i.test(b) ? "ancien_conseil" : "observation", status: "a_verifier",
      // Une ancienne cible calorique n'est jamais un objectif actif ; une valeur évoquée n'est pas une pesée.
      warnings: [...(looksGoal ? ["Mentionne un objectif/une cible : conservé comme note datée, pas comme objectif actif."] : []), ...(/\d+[,.]?\d*\s*kg/i.test(b) ? ["Contient un poids : non transformé en pesée sans validation de sa source."] : [])],
    };
  });
}

export function mountNotes(r: Router) {
  r.get("/notes", ({ user, query }) => {
    const q = (query.get("q") ?? "").toLowerCase(), tag = query.get("tag"), type = query.get("type"), status = query.get("status"), topic = query.get("topic");
    const rows = all<any>(`SELECT * FROM notes n WHERE user_id=? AND version=(SELECT MAX(version) FROM notes x WHERE x.note_key=n.note_key AND x.user_id=n.user_id) ORDER BY favorite DESC, added_at DESC`, user.id);
    const out = rows.map(noteOut).filter((n) => (!q || (n.title + " " + n.content).toLowerCase().includes(q)) && (!tag || n.tags.includes(tag)) && (!type || n.type === type) && (!topic || n.topic === topic) && (status ? n.status === status : n.status !== "archivee"));
    return { notes: out, toReview: rows.filter((n) => n.to_review && n.status !== "archivee").length };
  });
  r.post("/notes", ({ user, body }) => {
    const n = noteIn(body), id = uid(), key = "n-" + uid();
    run("INSERT INTO notes(id,note_key,version,user_id,title,content,tags,type,topic,source,source_date,status,link_kind,link_id,added_at) VALUES(?,?,1,?,?,?,?,?,?,?,?,?,?,?,?)", id, key, user.id, n.title, n.content, n.tags, n.type, n.topic, n.source ?? "Saisie personnelle", n.source_date, body.status ? n.status : "personnelle",
      ["recipe", "routine", "goal", "period"].includes(body.link_kind) ? body.link_kind : null, body.link_id ? String(body.link_id).slice(0, 80) : null, nowIso());
    return { id, note_key: key };
  });
  r.put("/notes/:key", ({ user, params, body }) => {
    const cur = get<any>("SELECT * FROM notes WHERE note_key=? AND user_id=? ORDER BY version DESC LIMIT 1", params[0], user.id);
    if (!cur) throw notFound();
    checkVersion(body, cur.version);
    const merged = noteIn({ ...noteOut(cur), ...body });
    const id = uid();
    // Historique des modifications : chaque modification crée une version datée ; l'ancien contenu reste consultable.
    run("INSERT INTO notes(id,note_key,version,user_id,title,content,tags,type,topic,source,source_date,status,favorite,link_kind,link_id,to_review,added_at,reviewed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", id, cur.note_key, cur.version + 1, user.id, merged.title, merged.content, merged.tags, merged.type, merged.topic, merged.source, merged.source_date, merged.status, body.favorite !== undefined ? +!!body.favorite : cur.favorite, cur.link_kind, cur.link_id, body.reviewed ? 0 : cur.to_review, cur.added_at, body.reviewed ? nowIso() : cur.reviewed_at);
    return { id, version: cur.version + 1 };
  });
  r.post("/notes/:key/review", ({ user, params }) => { run("UPDATE notes SET to_review=0, reviewed_at=? WHERE note_key=? AND user_id=?", nowIso(), params[0], user.id); });
  r.post("/notes/:key/archive", ({ user, params, body }) => { run("UPDATE notes SET status=? WHERE note_key=? AND user_id=? AND version=(SELECT MAX(version) FROM notes WHERE note_key=? AND user_id=?)", body.archived === false ? "a_verifier" : "archivee", params[0], user.id, params[0], user.id); });
  r.get("/notes/:key/history", ({ user, params }) => ({ versions: all<any>("SELECT * FROM notes WHERE note_key=? AND user_id=? ORDER BY version DESC", params[0], user.id).map(noteOut) }));
  r.post("/notes-import/preview", ({ body }) => ({ cards: proposeCards(str(body.text, "Texte", 200000)) }));
  r.post("/notes-import/commit", ({ user, body }) => {
    const cards = Array.isArray(body.cards) ? body.cards.slice(0, 100) : [];
    if (!cards.length) throw bad("Aucune fiche à enregistrer.");
    let n = 0;
    tx(() => cards.forEach((c: any) => { const x = noteIn(c); run("INSERT INTO notes(id,note_key,version,user_id,title,content,tags,type,topic,source,source_date,status,added_at) VALUES(?,?,1,?,?,?,?,?,?,?,?,?,?)", uid(), "n-" + uid(), user.id, x.title, x.content, x.tags, x.type, x.topic, x.source ?? "Import éditorial", x.source_date, x.status, nowIso()); n++; }));
    return { imported: n };
  });
  void todayIn;
}
