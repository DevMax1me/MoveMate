// « Dire ce que j'ai mangé » : découpe d'une phrase libre en éléments (« 2 œufs, du pain et un café »). Fonctions pures.
import { fold } from "./recipe-parse";

export const URL_RE = /https?:\/\/[^\s<>"')]+/gi;
export const extractUrls = (text: string): string[] => [...new Set((text.match(URL_RE) ?? []).map((u) => u.replace(/[.,;:!?]+$/, "")))];

const CATS: [RegExp, string][] = [[/petit[- ]?dej|petit[- ]?dejeuner|breakfast|ce matin/, "Petit-déjeuner"], [/(^|\b)(dejeuner|midi|lunch)\b/, "Déjeuner"], [/(^|\b)(diner|souper|ce soir|dinner)\b/, "Dîner"], [/gouter|collation|casse[- ]?croute|snack|encas|en-cas|apero|aperitif/, "Collation"]];
/** Repas évoqué dans la phrase (« ce midi », « au petit-déj »), sinon null. */
export function detectCategory(text: string): string | null { const f = fold(text); for (const [re, c] of CATS) if (re.test(f)) return c; return null; }

const PREFIX = /^\s*(?:(?:j['’]?ai|on a|nous avons|je viens de|je vais)\s+(?:mang[ée]e?s?|pris|bu|grignot[ée]e?s?|aval[ée]e?s?|dev?or[ée]e?s?|croqu[ée]e?s?|eu|fait)(?![a-zà-ÿ])\s*(?:comme|au|en)?\s*|(?:ce|cet)\s+(?:matin|midi|soir|apres[- ]midi)\b|hier\s+(?:matin|midi|soir)\b|au\s+(?:petit[- ]?d[ée]j(?:euner)?|d[ée]jeuner|d[iî]ner|go[uû]ter|souper|brunch)\b|pour\s+(?:le\s+)?(?:petit[- ]?d[ée]j(?:euner)?|d[ée]jeuner|d[iî]ner|go[uû]ter|souper|brunch|casse[- ]cro[uû]te)\b|en\s+(?:entr[ée]e|plat|dessert)\b|aujourd'?hui|avant[- ]hier)\s*[:,;.–—-]?\s*/i;

/** Éléments d'une phrase : virgules (sauf décimales), « et », « avec », « + », points-virgules, retours à la ligne. Les adresses web sont retirées. */
export function splitMealText(text: string): string[] {
  let t = String(text ?? "").replace(URL_RE, " ").replace(/\r/g, "\n");
  for (let i = 0; i < 4; i++) { const n = t.replace(PREFIX, ""); if (n === t) break; t = n; }
  const parts = t.split(/\n|;|\s\+\s|\s&\s|(?<!\d),|,(?!\d)|\s(?:et|avec|puis|accompagn[ée]e?s? d[e']|plus)\s+(?=\S)/i);
  return parts.map((x) => x.replace(/\s+/g, " ").trim().replace(/^(?:et|avec|puis|plus)\s+/i, "").replace(/^[-•*·]\s*/, "").replace(/[.!?]+$/, "")).filter((x) => x.length > 1).slice(0, 40);
}
