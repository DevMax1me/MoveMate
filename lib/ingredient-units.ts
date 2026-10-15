// Poids usuels pour convertir des pièces et conditionnements en grammes (données, sans dépendance).
/** Poids d'une pièce quand la recette ne donne ni gramme ni millilitre (« 2 oignons », « 1 gousse d'ail »). Premier motif qui correspond (texte sans accents). */
export const PIECE_G: [RegExp, number][] = [
  [/\bbaguettes?\b/, 250], [/\bpizzas?\b/, 350],
  [/\bjaunes?\b/, 18], [/\bblancs? d'?oeuf|\bblancs?$/, 33], [/\boeufs?\b/, 55],
  [/\bgousses? d'?ail|\bail\b/, 4], [/\btete d'?ail/, 50], [/\bechalotes?\b/, 25], [/\boignons? (nouveau|nouveaux)|\bcebettes?|\bciboules?/, 20], [/\boignons?\b/, 110],
  [/\btomates? cerises?|\bcerises?\b/, 15], [/\btomates?\b/, 120], [/\bcarottes?\b/, 80], [/\bpommes? de terre|\bpatates? douces?|\bpatates?\b/, 150],
  [/\bcourgettes?\b/, 200], [/\baubergines?\b/, 250], [/\bpoivrons?\b/, 160], [/\bconcombres?\b/, 300], [/\bchampignons?\b/, 20], [/\bpoireaux?\b/, 150],
  [/\bcitrons? verts?|\blimes?\b/, 60], [/\bcitrons?\b/, 100], [/\boranges?\b/, 150], [/\bclementines?|\bmandarines?|\bkiwis?\b/, 80], [/\bpommes?\b/, 150], [/\bpoires?\b/, 160], [/\bbananes?\b/, 120], [/\bavocats?\b/, 150], [/\bmangues?\b/, 300], [/\bpeches?|\babricots?\b/, 100],
  [/\bbranches? de celeri|\bcelerie?/, 40], [/\bradis\b/, 8], [/\bbetteraves?\b/, 100], [/\bnavets?\b/, 150], [/\bfenouils?\b/, 250], [/\bpiments?\b/, 10], [/\bcornichons?\b/, 8],
  [/\byaourts?\b|\byogourts?\b|\bpots?\b/, 125], [/\bpetits? suisses?\b/, 60], [/\bboules? de mozzarella|\bmozzarella\b/, 125],
  [/\bsaucisses?\b|\bchipolatas?\b/, 70], [/\bmerguez\b/, 50], [/\bknacks?\b/, 50], [/\btranches? de jambon|\bjambon\b/, 40], [/\btranches? de bacon|\bbacon\b/, 20], [/\btranches? de saumon fume|\bsaumon fume\b/, 30], [/\btranches? de pain de mie|\bpain de mie\b/, 25], [/\btranches? de pain|\bpain\b/, 30], [/\btranches? de fromage|\bfromage\b/, 25],
  [/\bblancs? de poulet|\bfilets? de poulet|\bescalopes? de poulet|\bpoulet\b/, 150], [/\bcuisses? de poulet|\bpilons?\b/, 150], [/\bescalopes?\b/, 120], [/\bsteaks? hach|\bsteaks?\b/, 125], [/\bpaves? de saumon|\bsaumon\b/, 130], [/\bfilets? de (poisson|cabillaud|colin|lieu|merlu)|\bcabillaud\b/, 150], [/\bmagrets?\b/, 300], [/\bbatonnets? de surimi|\bsurimi\b/, 15],
  [/\btortillas?|\bwraps?\b|\bgalettes? de ble/, 60], [/\bpates? (feuilletee|brisee|sablee|a tarte)|\brouleaux?/, 230], [/\bpates? a pizza/, 250],
  [/\bcubes? de bouillon|\bcubes?\b/, 10], [/\bsachets? de (levure|sucre vanille)|\bsucre vanille\b|\blevure\b/, 9], [/\bfeuilles? de gelatine/, 2],
  [/\bbiscuits?\b|\bspeculoos\b|\bsables?\b/, 8], [/\bdattes?\b/, 8], [/\bolives?\b/, 4], [/\bnoix\b/, 5], [/\bnoisettes?\b|\bcajous?/, 2],
];

/** Équivalences de poids pour des unités sans gramme (« 1 boîte de tomates concassées »). Premier motif qui correspond. */
export const PACK_G: [RegExp, number][] = [
  [/tomates? (concassees?|pelees?)|coulis|passata|sauce tomate/, 400], [/\bmais\b/, 285], [/\bthon\b/, 140], [/\bsardines?\b/, 90], [/pois chiches?|haricots?|lentilles?|flageolets?/, 400],
  [/lait concentre/, 400], [/lait de coco|creme de coco/, 400], [/champignons?/, 230], [/petits? pois/, 280], [/\bcreme\b/, 200], [/gnocchis?/, 500], [/\b(pates|spaghetti|spaghettis|penne|tagliatelles?|macaronis|riz)\b/, 500], [/mascarpone|ricotta|feta/, 250], [/surimi/, 200],
  [/\bsucre vanille\b/, 7.5], [/\blevure\b/, 11],
];

/** Petites quantités (sel, épices…) : leur apport est négligeable, on n'en demande pas la quantité. */
export const NEGLIGIBLE_RE = /^(sel|poivre|epices?|herbes?|eau|glacons?|bouquet garni|laurier|thym|romarin|persil|ciboulette|vanille|extrait de vanille|muscade|cannelle|curry|paprika|piment|levure chimique|bicarbonate)\b|\bsel et poivre\b|\bsel, poivre\b/;

