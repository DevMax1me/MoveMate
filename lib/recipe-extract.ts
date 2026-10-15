// Extraction d'une recette depuis le HTML d'une page : données structurées schema.org (JSON-LD, sinon microdonnées). Fonctions pures.
import { decodeEntities } from "./recipe-parse";

export type Reported = { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null; servingG: number | null };
export type Extracted = {
  title: string; servings: number | null; servingsLabel: string | null; timeMin: number | null;
  ingredients: string[]; steps: string; reported: Reported | null; via: "json-ld" | "microdata";
};

const text = (v: unknown): string => decodeEntities(String(v ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|li|div|h\d)>/gi, "\n").replace(/<[^>]*>/g, " ")).replace(/[ \t ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{2,}/g, "\n").trim();

/** « PT1H30M » → 90 ; « P0DT0H45M » → 45. */
export function parseDuration(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  const m = String(v ?? "").match(/^P(?:(\d+)D)?T?(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?$/i);
  if (!m || (!m[1] && !m[2] && !m[3] && !m[4])) return null;
  const n = (x?: string) => (x ? parseFloat(x.replace(",", ".")) : 0);
  const min = n(m[1]) * 1440 + n(m[2]) * 60 + n(m[3]) + n(m[4]) / 60;
  return min > 0 ? Math.round(min) : null;
}

/** « 4 personnes », « Makes 12 », ["6", "6 portions"], « 4-6 parts » → nombre de portions. */
export function parseYield(v: unknown): { n: number | null; label: string | null } {
  const items = Array.isArray(v) ? v : [v];
  for (const it of items) {
    const s = text(it); if (!s) continue;
    const m = s.match(/(\d+(?:[.,]\d+)?)(?:\s*(?:-|–|à|to)\s*(\d+(?:[.,]\d+)?))?/);
    if (m) { const a = parseFloat(m[1].replace(",", ".")), b = m[2] ? parseFloat(m[2].replace(",", ".")) : null; const n = b && b >= a ? (a + b) / 2 : a; if (n > 0 && n <= 200) return { n, label: s.slice(0, 40) }; }
  }
  return { n: null, label: null };
}

const num = (v: unknown): number | null => { const m = String(v ?? "").replace(",", ".").match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; };
export function parseNutrition(n: any): Reported | null {
  if (!n || typeof n !== "object") return null;
  const kcalRaw = n.calories ?? n.energy ?? n.energyContent, kcal = /kj|kilojoule/i.test(String(kcalRaw)) ? (num(kcalRaw) == null ? null : num(kcalRaw)! / 4.184) : num(kcalRaw);
  const r: Reported = { kcal, protein: num(n.proteinContent), carbs: num(n.carbohydrateContent), fat: num(n.fatContent), fiber: num(n.fiberContent), servingG: /\bg(?:rams?)?\b|gr/i.test(String(n.servingSize ?? "")) ? num(n.servingSize) : null };
  return r.kcal == null && r.protein == null && r.carbs == null && r.fat == null ? null : r;
}

function instructions(v: unknown, depth = 0): string[] {
  if (!v || depth > 4) return [];
  if (typeof v === "string") return text(v).split("\n").map((x) => x.trim()).filter(Boolean);
  if (Array.isArray(v)) return v.flatMap((x) => instructions(x, depth + 1));
  if (typeof v === "object") {
    const o = v as any;
    if (o.itemListElement) return instructions(o.itemListElement, depth + 1);
    if (o.text) return instructions(o.text, depth + 1);
    if (o.name) return instructions(o.name, depth + 1);
  }
  return [];
}

const isRecipe = (o: any) => { const t = o?.["@type"]; return t === "Recipe" || (Array.isArray(t) && t.includes("Recipe")) || (typeof t === "string" && /(^|\/)Recipe$/.test(t)); };
function findRecipe(o: unknown, depth = 0): any | null {
  if (!o || typeof o !== "object" || depth > 8) return null;
  if (Array.isArray(o)) { for (const x of o) { const r = findRecipe(x, depth + 1); if (r) return r; } return null; }
  if (isRecipe(o)) return o;
  for (const k of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement", "hasPart"]) { const r = findRecipe((o as any)[k], depth + 1); if (r) return r; }
  return null;
}

export function extractRecipe(html: string): Extracted | null {
  // 1. JSON-LD : balises repérées une à une (au plus 25) ; sans balise fermante, aucune autre ne peut se fermer : on s'arrête (pas de coût quadratique sur une page piégée)
  const blocks: string[] = []; const open = /<script\b[^>]*>/gi; let om: RegExpExecArray | null, seen = 0;
  while ((om = open.exec(html)) && seen < 25) {
    if (!/application\/ld\+json/i.test(om[0])) continue;
    seen++;
    const closer = /<\/script/gi; closer.lastIndex = open.lastIndex;
    const cm = closer.exec(html);
    if (!cm) break;
    blocks.push(html.slice(open.lastIndex, cm.index)); open.lastIndex = cm.index;
  }
  for (const block of blocks) {
    let raw = block.trim().replace(/^<!--/, "").replace(/-->$/, "").replace(/^\/\*<!\[CDATA\[\*\//, "").replace(/\/\*\]\]>\*\/$/, "").trim();
    let data: unknown; try { data = JSON.parse(raw); } catch { try { data = JSON.parse(raw.replace(/[\u0000-\u001f]+/g, " ")); } catch { continue; } }
    const r = findRecipe(data); if (!r) continue;
    const ing = (Array.isArray(r.recipeIngredient) ? r.recipeIngredient : Array.isArray(r.ingredients) ? r.ingredients : typeof r.recipeIngredient === "string" ? r.recipeIngredient.split(/\n/) : typeof r.ingredients === "string" ? r.ingredients.split(/\n/) : [])
      .map((x: unknown) => text(typeof x === "object" && x ? (x as any).name ?? (x as any).text ?? "" : x).slice(0, 300)).filter(Boolean);
    if (!ing.length) continue;
    const y = parseYield(r.recipeYield);
    const time = parseDuration(r.totalTime) ?? ((parseDuration(r.prepTime) ?? 0) + (parseDuration(r.cookTime) ?? 0) || null);
    return { title: text(r.name ?? r.headline) || "Recette importée", servings: y.n, servingsLabel: y.label, timeMin: time, ingredients: ing.slice(0, 80), steps: instructions(r.recipeInstructions).map((x, i) => `${i + 1}. ${x}`).join("\n").slice(0, 5000), reported: parseNutrition(r.nutrition), via: "json-ld" };
  }
  // 2. microdonnées (itemprop)
  const ing = [...html.matchAll(/<([a-z0-9]+)[^>]*itemprop\s*=\s*["'](?:recipeIngredient|ingredients)["'][^>]*>([\s\S]{0,1500}?)<\/\1>/gi)].slice(0, 80).map((m) => text(m[2]).slice(0, 300)).filter(Boolean);
  if (ing.length) {
    const nm = html.match(/<[^>]*itemprop\s*=\s*["']name["'][^>]*>([\s\S]{0,500}?)<\/[a-z0-9]+>/i) ?? html.match(/<meta[^>]*property\s*=\s*["']og:title["'][^>]*content\s*=\s*["']([^"']*)["']/i) ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const yl = html.match(/<[^>]*itemprop\s*=\s*["']recipeYield["'][^>]*>([\s\S]{0,200}?)<\/[a-z0-9]+>/i);
    const y = parseYield(yl ? text(yl[1]) : null);
    const steps = [...html.matchAll(/<([a-z0-9]+)[^>]*itemprop\s*=\s*["']recipeInstructions["'][^>]*>([\s\S]{0,3000}?)<\/\1>/gi)].slice(0, 40).flatMap((m) => text(m[2]).split("\n")).filter(Boolean);
    return { title: nm ? text(nm[1]) : "Recette importée", servings: y.n, servingsLabel: y.label, timeMin: null, ingredients: ing.slice(0, 80), steps: steps.map((x, i) => `${i + 1}. ${x}`).join("\n").slice(0, 5000), reported: null, via: "microdata" };
  }
  return null;
}
