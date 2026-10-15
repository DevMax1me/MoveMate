// Lecture d'une ligne d'ingrédient de recette (français, un peu d'anglais) : quantité, unité, nom. Fonctions pures, sans accès réseau ni base.
export type Parsed = {
  raw: string;
  qty: number | null;      // quantité principale (milieu d'une fourchette)
  unit: string | null;     // g kg mg ml cl dl l oz lb cs cc cd pincee verre tasse cup mug bol pot boite tranche gousse brin feuille branche bouquet sachet cube carre poignee noix filet morceau paquet rouleau batonnet
  name: string;            // nom nettoyé
  hintG: number | null;    // poids connu par unité (« 1 oignon (environ 150 g) », « boîte de 400 g »)
  hintMl: number | null;
  optional: boolean;
  vague: boolean;          // « quelques », « un peu de »…
};

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", eacute: "é", egrave: "è", ecirc: "ê", euml: "ë", agrave: "à", acirc: "â", auml: "ä", ccedil: "ç", icirc: "î", iuml: "ï", ocirc: "ô", ouml: "ö", ugrave: "ù", ucirc: "û", uuml: "ü", oelig: "œ", rsquo: "’", lsquo: "‘", laquo: "«", raquo: "»", deg: "°", frac12: "½", frac14: "¼", frac34: "¾", hellip: "…", ndash: "–", mdash: "—", times: "×", Eacute: "É", Egrave: "È", Agrave: "À", Ccedil: "Ç" };
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e: string) => {
    if (e[0] === "#") { const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; } catch { return m; } }
    return ENT[e] ?? ENT[e.toLowerCase()] ?? m;
  });
}

/** Minuscules sans accents, une lettre pour une lettre (les positions restent alignées sur le texte d'origine). */
export const fold = (s: string): string => [...s].map((c) => c.normalize("NFD")[0]).join("").toLowerCase();

const FRAC: Record<string, string> = { "½": "1/2", "¼": "1/4", "¾": "3/4", "⅓": "1/3", "⅔": "2/3", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8", "⅕": "1/5" };
const WORDS: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, quinze: 15, vingt: 20, one: 1, two: 2, three: 3, four: 4, five: 5 };
const NUM = String.raw`(?:\d+\/\d+|\d+(?:[.,]\d+)?(?:\s+\d+\/\d+)?)`;
const toNum = (s: string): number => {
  const t = s.trim().replace(",", ".");
  const mixed = t.match(/^(\d+(?:\.\d+)?)\s+(\d+)\/(\d+)$/); if (mixed) return +mixed[1] + +mixed[2] / +mixed[3];
  const fr = t.match(/^(\d+)\/(\d+)$/); if (fr) return +fr[1] / +fr[2];
  return parseFloat(t);
};

const SPACE = String.raw`\.?\s?`;
const UNITS: [RegExp, string][] = [
  [/^(?:kg|kilos?|kilogrammes?|kilograms?)(?![a-z])/, "kg"],
  [/^(?:mg|milligrammes?)(?![a-z])/, "mg"],
  [/^(?:g|gr|grs|grammes?|grams?)(?![a-z])\.?/, "g"],
  [/^(?:ml|millilitres?|milliliters?)(?![a-z])/, "ml"], [/^(?:cl|centilitres?|centiliters?)(?![a-z])/, "cl"], [/^(?:dl|decilitres?|deciliters?)(?![a-z])/, "dl"],
  [/^(?:l|litres?|liters?)(?![a-z])\.?/, "l"],
  [new RegExp(String.raw`^(?:cuilleree?s?\s?a\s?soupe|cuil${SPACE}a\s?soupe|c${SPACE}a${SPACE}soupe|c${SPACE}a${SPACE}s|c\.s|cas|cs|tbsps?|tablespoons?|tbs)(?![a-z])\.?`), "cs"],
  [new RegExp(String.raw`^(?:cuilleree?s?\s?a\s?cafe|cuil${SPACE}a\s?cafe|c${SPACE}a${SPACE}cafe|c${SPACE}a${SPACE}c|c\.c|cac|cc|tsps?|teaspoons?)(?![a-z])\.?`), "cc"],
  [new RegExp(String.raw`^(?:cuilleree?s?\s?a\s?dessert|cuil${SPACE}a\s?dessert|c${SPACE}a${SPACE}dessert|c${SPACE}a${SPACE}d)(?![a-z])\.?`), "cd"],
  [/^(?:pincees?|pointes?(?: de couteau)?)(?![a-z])/, "pincee"], [/^(?:verres?)(?![a-z])/, "verre"], [/^(?:tasses?)(?![a-z])/, "tasse"], [/^(?:cups?)(?![a-z])/, "cup"], [/^(?:mugs?)(?![a-z])/, "mug"], [/^(?:bols?)(?![a-z])/, "bol"],
  [/^(?:pots?)(?![a-z])/, "pot"], [/^(?:boites?|conserves?|cans?|tins?|briques?|bocaux?|bocal)(?![a-z])/, "boite"],
  [/^(?:tranches?|slices?)(?![a-z])/, "tranche"], [/^(?:gousses?|cloves?)(?![a-z])/, "gousse"], [/^(?:brins?|sprigs?)(?![a-z])/, "brin"], [/^(?:feuilles?|leaves|leaf)(?![a-z])/, "feuille"],
  [/^(?:branches?|tiges?|stalks?)(?![a-z])/, "branche"], [/^(?:bouquets?|bunch(?:es)?|bottes?)(?![a-z])/, "bouquet"], [/^(?:sachets?|packets?|enveloppes?)(?![a-z])/, "sachet"],
  [/^(?:cubes?|tablettes?)(?![a-z])/, "cube"], [/^(?:carres?)(?![a-z])/, "carre"], [/^(?:poignees?|handfuls?)(?![a-z])/, "poignee"],
  [/^(?:noix|noisettes?)(?= (?:de |d')(?:beurre|margarine|ghee|saindoux|graisse))/, "noix"],
  [/^(?:filets?)(?= (?:d'|de )(?:huile|vinaigre|jus|sauce|citron))/, "filet"],
  [/^(?:morceaux?|pieces?|pcs?|bouts?|rondelles?)(?![a-z])\.?/, "morceau"], [/^(?:paquets?|packs?|barquettes?|plaquettes?)(?![a-z])/, "paquet"], [/^(?:rouleaux?)(?![a-z])/, "rouleau"],
  [/^(?:batonnets?|batons?|sticks?)(?![a-z])/, "batonnet"], [/^(?:oz|ounces?)(?![a-z])\.?/, "oz"], [/^(?:lbs?|pounds?)(?![a-z])\.?/, "lb"],
];
const LEAD = /^(?:(?:environ|env\.?|about|approx\.?)\s+)?(?:(?:de|du|des|d'|d’|of)\s*|de la\s+|de l'|de l’)?/i;

export function parseIngredient(rawIn: string): Parsed {
  const raw = decodeEntities(String(rawIn ?? "")).replace(/[   \t\r\n]+/g, " ").trim();
  let s = raw.replace(/[½¼¾⅓⅔⅛⅜⅝⅞⅕]/g, (m) => ` ${FRAC[m]} `).replace(/\s+/g, " ").trim().replace(/^[-•*·▪●\s]+/, "").replace(/\((?:s|e|es|x)\)/gi, "");
  const optional = /facultatif|optionnel|optional|\(option\)|si (?:vous )?(?:le )?(?:souhaitez|désirez|voulez)/i.test(raw);
  let qty: number | null = null, unit: string | null = null, vague = false;
  let f = fold(s);

  // « quelques », « un peu de »
  const vg = f.match(/^(quelques|un peu d[e']|une pointe|a volonte|selon (?:le )?gout)\s*/);
  if (vg) { vague = true; s = s.slice(vg[0].length); f = f.slice(vg[0].length); }

  // « demi », « une demi »
  const half = f.match(/^(?:(?:un|une)\s+)?(?:demi|demie)(?:\s+|-)/);
  if (half && !vague) { qty = 0.5; s = s.slice(half[0].length); f = f.slice(half[0].length); }
  else if (!vague) {
    // « 2 x 400 g » : produit
    const times = f.match(new RegExp(`^(${NUM})\\s*[x×]\\s*(${NUM})\\s*(?=[a-z])`));
    const range = f.match(new RegExp(`^(${NUM})(?:\\s*(?:-|–|—|a|ou|to)\\s*(${NUM}))?`));
    if (times) { qty = toNum(times[1]) * toNum(times[2]); s = s.slice(times[0].length); f = f.slice(times[0].length); }
    else if (range && range[0].length) {
      const a = toNum(range[1]), b = range[2] ? toNum(range[2]) : null;
      qty = b != null && b >= a ? (a + b) / 2 : a; s = s.slice(range[0].length); f = f.slice(range[0].length);
    } else {
      const w = f.match(/^(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|quinze|vingt|one|two|three|four|five)(?![a-z])\s*/);
      if (w) { qty = WORDS[w[1]] ?? null; s = s.slice(w[0].length); f = f.slice(w[0].length); }
    }
  }
  s = s.replace(/^\s+/, ""); f = f.replace(/^\s+/, "");

  // unité
  if (qty != null || vague) for (const [re, u] of UNITS) { const m = f.match(re); if (m) { unit = u; s = s.slice(m[0].length); f = f.slice(m[0].length); break; } }
  s = s.replace(/^\s+/, ""); f = f.replace(/^\s+/, "");

  // « de 500 g de … » après une unité de conditionnement ; indication entre parenthèses
  let hintG: number | null = null, hintMl: number | null = null;
  const setHint = (n: number, u: string) => { const x = u === "kg" ? n * 1000 : u === "l" ? n * 1000 : u === "cl" ? n * 10 : n; if (u === "g" || u === "kg") hintG ??= x; else hintMl ??= x; };
  const pack = f.match(new RegExp(`^(?:de\\s+)?(${NUM})\\s*(g|kg|ml|cl|l)(?![a-z])\\s*(?:de |d'|d’)?`));
  if (pack && unit && !["g", "kg", "mg", "ml", "cl", "dl", "l"].includes(unit)) { setHint(toNum(pack[1]), pack[2]); s = s.slice(pack[0].length); f = f.slice(pack[0].length); }
  for (const par of s.matchAll(/\(([^)]*)\)/g)) {
    const pf = fold(par[1]).match(new RegExp(`(?:environ|env\\.?|soit|about|approx\\.?|~)?\\s*(${NUM})\\s*(g|kg|ml|cl|l)(?![a-z])`));
    if (pf) setHint(toNum(pf[1]), pf[2]);
  }

  // nom
  let name = s.replace(/\([^)]*\)/g, " ").trim().replace(LEAD, "");
  name = name.split(/[,;:]|\s[-–—]\s/)[0];
  name = name.replace(/\b(?:plus|et un peu|avec un peu|pour (?:servir|la cuisson|la po[eê]le|dorer|saupoudrer|le moule|graisser|d[ée]corer|la finition|la garniture|la friture|frire|le service)|to serve|for frying|selon (?:le )?(?:go[uû]t|envie)|[àa] volont[ée]|au choix|au go[uû]t|facultatif|optionnel|optional)\b.*$/i, "");
  name = name.replace(LEAD, "").replace(/\s+/g, " ").trim().replace(/[.\s]+$/, "");
  // « 1 cube de bouillon de volaille » : le cube est l'aliment
  if (unit === "cube" && /^bouillon|^fond/i.test(fold(name))) name = "cube de bouillon";
  if (!name) name = raw.replace(/^[\d\s.,/½¼¾]+/, "").trim() || raw;
  return { raw, qty, unit, name, hintG, hintMl, optional, vague };
}

// ---- mots utiles au rapprochement ----
const STOP = new Set(["de", "du", "des", "d", "la", "le", "les", "l", "un", "une", "et", "ou", "au", "aux", "en", "a", "avec", "sans", "pour", "sur", "dans", "of", "the", "and", "or", "with", "to", "some", "pas", "tres", "bien", "assez", "environ", "bio", "frais", "fraiche", "fraichement", "gros", "grosse", "petit", "petite", "moyen", "moyenne", "grand", "grande", "beau", "belle", "entier", "entiere", "nature", "naturel", "emince", "hache", "rape", "fondu", "coupe", "pele", "lave", "egoutte", "ramolli", "tranche", "surgele", "maison", "extra", "fin", "fine", "bonne", "qualite", "type", "ferme", "pret", "mou", "doux", "large", "plat", "ordinaire", "classique", "du", "commerce", "decortique", "denoyaute", "non", "traite", "traitee"]);
const KEEP_S = new Set(["noix", "pois", "mais", "cassis", "anis", "bois", "brebis", "fois", "riz", "mous", "jus", "radis", "frais", "gras", "bras", "temps", "colis", "coulis", "fonds", "pas", "dos", "tres", "maïs", "ananas", "lilas", "palais", "poids", "souris", "pastis", "pain", "persil", "basilic", "ail", "sel"]);
const stem = (t: string): string => (t.length > 3 && /[sx]$/.test(t) && !KEEP_S.has(t) ? t.slice(0, -1) : t);
export type State = "cuit" | "cru" | "sec" | null;
/** Mots significatifs d'un nom + état (cuit, cru, sec) s'il est indiqué. */
export function tokens(text: string): { toks: string[]; state: State } {
  const f = fold(text).replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/['’`]/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
  let state: State = null; const toks: string[] = [];
  for (const raw of f.split(" ")) {
    if (!raw) continue;
    if (/^(cuit|cuite|cuits|cuites)$/.test(raw)) { state = "cuit"; continue; }
    if (/^(cru|crue|crus|crues)$/.test(raw)) { state ??= "cru"; continue; }
    if (/^(sec|seche|secs|seches)$/.test(raw)) { state ??= "sec"; continue; }
    if (STOP.has(raw)) continue;
    const t = stem(raw); if (!STOP.has(t)) toks.push(t);
  }
  return { toks: [...new Set(toks)], state };
}
