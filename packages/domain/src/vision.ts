/**
 * Pure vision / multimodal domain logic (Assessment 4 Option 2):
 * - Canonical food tag taxonomy & synonym normalizer
 * - Category normalization
 * - Image data-URL validation & size bounds
 * - Search query builder for hybrid pgvector retrieval
 * - Deterministic evaluation metrics (Tag P/R/F1, Hit@1, Hit@K, MRR)
 */

export const CANONICAL_CATEGORIES = [
  "Starters",
  "Main Course",
  "Biryani",
  "Breads",
  "Rice",
  "South Indian",
  "Desserts",
  "Drinks",
] as const;

export type CanonicalMenuCategory = (typeof CANONICAL_CATEGORIES)[number];

export const CANONICAL_FOOD_TAGS = [
  // Dietary
  "veg",
  "non-veg",
  "egg",
  "vegan",
  // Spice & flavor
  "spicy",
  "medium-spicy",
  "mild",
  "sweet",
  "tangy",
  "creamy",
  "crispy",
  "smoky",
  "cheesy",
  "savory",
  // Cuisine & region
  "south-indian",
  "north-indian",
  "goan",
  "maharashtrian",
  "chinese",
  "italian",
  "continental",
  "fast-food",
  "street-food",
  "coastal",
  "mughlai",
  // Dish format / ingredient cues
  "biryani",
  "curry",
  "dosa",
  "idli",
  "tandoor",
  "paneer",
  "chicken",
  "seafood",
  "mutton",
  "dal",
  "starter",
  "bread",
  "rice",
  "noodles",
  "pizza",
  "burger",
  "sandwich",
  "roll",
  "thali",
  "snack",
  "dessert",
  "beverage",
  "breakfast",
  "refreshing",
  "comfort",
] as const;

export type CanonicalFoodTag = (typeof CANONICAL_FOOD_TAGS)[number];

export type SpiceLevel = "mild" | "medium" | "spicy";

export type VisionAnalysis = {
  isFood: boolean;
  dishName: string;
  cuisine: string;
  category: CanonicalMenuCategory;
  isVeg: boolean;
  spiceLevel: SpiceLevel;
  tags: string[];
  caption: string;
  confidence: number;
  provider: string;
  model: string;
};

export type ImageValidationResult =
  | { ok: true; mime: string; base64: string; approxBytes: number }
  | { ok: false; code: "IMAGE_MISSING" | "IMAGE_INVALID_FORMAT" | "IMAGE_TOO_LARGE"; message: string };

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB

const TAG_SYNONYMS: Record<string, string> = {
  vegetarian: "veg",
  "pure-veg": "veg",
  pureveg: "veg",
  veggie: "veg",
  nonveg: "non-veg",
  "non-vegetarian": "non-veg",
  nonvegetarian: "non-veg",
  meat: "non-veg",
  hot: "spicy",
  "very-spicy": "spicy",
  "extra-spicy": "spicy",
  fiery: "spicy",
  masaledar: "spicy",
  medium: "medium-spicy",
  "moderately-spicy": "medium-spicy",
  notspicy: "mild",
  "non-spicy": "mild",
  crunchy: "crispy",
  fried: "crispy",
  "deep-fried": "crispy",
  roasted: "smoky",
  grilled: "tandoor",
  tandoori: "tandoor",
  kebabs: "tandoor",
  kebab: "tandoor",
  tikka: "tandoor",
  rich: "creamy",
  buttery: "creamy",
  malai: "creamy",
  makhani: "creamy",
  gravy: "curry",
  masala: "curry",
  southindian: "south-indian",
  "south indian": "south-indian",
  "south_indian": "south-indian",
  udupi: "south-indian",
  northindian: "north-indian",
  "north indian": "north-indian",
  "north_indian": "north-indian",
  punjabi: "north-indian",
  indo_chinese: "chinese",
  "indo-chinese": "chinese",
  hakka: "chinese",
  schezwan: "chinese",
  fastfood: "fast-food",
  "fast food": "fast-food",
  "fast_food": "fast-food",
  chaat: "street-food",
  streetfood: "street-food",
  "street food": "street-food",
  "street_food": "street-food",
  fish: "seafood",
  prawn: "seafood",
  prawns: "seafood",
  shrimp: "seafood",
  crab: "seafood",
  lamb: "mutton",
  goat: "mutton",
  cottage_cheese: "paneer",
  "cottage-cheese": "paneer",
  "cottage cheese": "paneer",
  naan: "bread",
  roti: "bread",
  paratha: "bread",
  kulcha: "bread",
  flatbread: "bread",
  pulao: "rice",
  "fried-rice": "rice",
  crepe: "dosa",
  uttapam: "dosa",
  appetizer: "starter",
  starters: "starter",
  snacks: "snack",
  sweets: "dessert",
  mithai: "dessert",
  "ice-cream": "dessert",
  cake: "dessert",
  drink: "beverage",
  drinks: "beverage",
  juice: "beverage",
  shake: "beverage",
  lassi: "beverage",
  chai: "beverage",
  coffee: "beverage",
  tea: "beverage",
};

const CATEGORY_MAP: Array<{ pattern: RegExp; category: CanonicalMenuCategory }> = [
  { pattern: /\b(biryani|dum\s*biryani)\b/i, category: "Biryani" },
  { pattern: /\b(dosa|idli|vada|uttapam|medu|appa|appam|pongal|upma|pesarattu|rasam|south\s*indian)\b/i, category: "South Indian" },
  { pattern: /\b(naan|roti|paratha|kulcha|bhature|chapati|bread|poee|pois|pitta|sannas|bhakri)\b/i, category: "Breads" },
  { pattern: /\b(dessert|sweet|gulab\s*jamun|rasmalai|halwa|kheer|kulfi|brownie|cake|pastry|ice\s*cream|bebinca|serradura|dodol|modak|shrikhand|sheera|puran\s*poli|tiramisu)\b/i, category: "Desserts" },
  { pattern: /\b(drink|beverage|lassi|shake|milkshake|smoothie|juice|coffee|tea|chai|mojito|soda|water|buttermilk|chaas|solkadhi|sol\s*kadi|sherbet|jaljeera|sweet\s*lime|nimbu)\b/i, category: "Drinks" },
  { pattern: /\b(rice|pulao|jeera\s*rice|fried\s*rice|curd\s*rice|lemon\s*rice|khichdi)\b/i, category: "Rice" },
  { pattern: /\b(starter|appetizer|snack|tikka|kebab|pakora|bhaji|samosa|manchurian|65|chilli|wings|lollipop|roll|spring\s*roll|chaat|bhel|sev\s*puri|dahi\s*puri|vada\s*pav|kothimbir\s*vadi|alu\s*wadi|rissois|bombil\s*fry|fries|onion\s*rings|sandwich|corn|soup|coleslaw|kismoor)\b/i, category: "Starters" },
  { pattern: /\b(main|curry|masala|gravy|korma|kadai|paneer|dal|thali|vindaloo|xacuti|cafreal|recheado|balchao|sorpotel|amot\s*tik|kalchi\s*kodi|rogan\s*josh|butter\s*chicken|sukha|rassa|misal|pav\s*bhaji|bharli\s*vangi|zunka|pithla|usal|thalipeeth|poha|noodles|pasta|pizza|burger|wrap)\b/i, category: "Main Course" },
];

export function normalizeMenuCategory(raw: unknown, dishNameHint = ""): CanonicalMenuCategory {
  const text = `${typeof raw === "string" ? raw : ""} ${dishNameHint}`.trim();
  if (typeof raw === "string") {
    const exact = CANONICAL_CATEGORIES.find(
      (c) => c.toLowerCase() === raw.trim().toLowerCase(),
    );
    if (exact) return exact;
  }
  for (const rule of CATEGORY_MAP) {
    if (rule.pattern.test(text)) return rule.category;
  }
  return "Main Course";
}

export function normalizeSpiceLevel(raw: unknown, tags: string[] = []): SpiceLevel {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s.includes("spicy") || s.includes("hot") || s.includes("high") || s.includes("fiery")) {
    return "spicy";
  }
  if (s.includes("mild") || s.includes("low") || s.includes("none") || s.includes("sweet")) {
    return "mild";
  }
  if (s.includes("med")) return "medium";
  if (tags.includes("spicy")) return "spicy";
  if (tags.includes("mild") || tags.includes("sweet")) return "mild";
  return "medium";
}

/**
 * Clean, map synonyms, deduplicate, and bound food tags so owner review
 * and automated evaluation stay consistent.
 */
export function normalizeFoodTags(
  rawTags: unknown,
  opts?: { isVeg?: boolean | null; spiceLevel?: SpiceLevel | null; maxTags?: number },
): string[] {
  const maxTags = opts?.maxTags ?? 8;
  const list: unknown[] = Array.isArray(rawTags)
    ? rawTags
    : typeof rawTags === "string"
      ? rawTags.split(/[,;|]+/)
      : [];

  const seen = new Set<string>();
  const out: string[] = [];

  const pushTag = (raw: string) => {
    const slug = raw
      .toLowerCase()
      .trim()
      .replace(/['"`]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (!slug || slug.length < 2 || slug.length > 28) return;
    const mapped = TAG_SYNONYMS[slug] ?? TAG_SYNONYMS[raw.toLowerCase().trim()] ?? slug;
    if (seen.has(mapped)) return;
    seen.add(mapped);
    out.push(mapped);
  };

  if (typeof opts?.isVeg === "boolean") {
    pushTag(opts.isVeg ? "veg" : "non-veg");
  }

  for (const item of list) {
    if (typeof item === "string") pushTag(item);
  }

  if (opts?.spiceLevel === "spicy" && !seen.has("spicy")) {
    pushTag("spicy");
  } else if (opts?.spiceLevel === "mild" && !seen.has("mild") && !seen.has("spicy")) {
    pushTag("mild");
  }

  // Ensure veg and non-veg do not co-occur when isVeg is explicitly known
  if (opts?.isVeg === true) {
    return out.filter((t) => t !== "non-veg").slice(0, maxTags);
  }
  if (opts?.isVeg === false) {
    return out.filter((t) => t !== "veg" && t !== "vegan").slice(0, maxTags);
  }

  return out.slice(0, maxTags);
}

/**
 * Heuristic tag/attribute extractor from dish name, description, and category.
 * Used to enrich sparse model outputs and as a deterministic fallback.
 */
export function inferAttributesFromText(input: {
  name?: string | null;
  description?: string | null;
  category?: string | null;
  isVeg?: boolean | null;
}): {
  category: CanonicalMenuCategory;
  isVeg: boolean;
  spiceLevel: SpiceLevel;
  cuisine: string;
  tags: string[];
} {
  const name = (input.name ?? "").trim();
  const desc = (input.description ?? "").trim();
  const cat = (input.category ?? "").trim();
  const blob = `${name} ${desc} ${cat}`.toLowerCase();

  const nonVegCue =
    /\b(chicken|mutton|lamb|fish|prawn|shrimp|crab|seafood|egg|omelette|keema|pork|beef|murgh|gosht|pepperoni|bacon|ham|calamari|squid|kingfish|pomfret|tisryo|chorizo|sausage|sorpotel|rissois|kismoor|bombil|amot\s*tik|kalchi\s*kodi|club\s*sandwich|cheese\s*burger)\b/i.test(
      blob,
    );
  const explicitVegCue = /\b(veg\s*burger|veg\s*sandwich|veg\s*cafreal|vegetable\s*cafreal|veg\s*thali|veg\s*biryani|veg\s*manchurian|veg\s*fried\s*rice|veg\s*hakka|veg\s*spring)\b/i.test(blob);
  const isVeg = typeof input.isVeg === "boolean" ? input.isVeg : explicitVegCue ? true : !nonVegCue;

  const category = normalizeMenuCategory(cat, `${name} ${desc}`);

  let cuisine = "Indian";
  const rawTags: string[] = ["savory"];

  if (/\b(dosa|idli|vada|uttapam|sambar|rasam|chettinad|malabar|appam|pongal|pesarattu|filter\s*coffee|meter\s*coffee|south\s*indian)\b/i.test(blob) && !/\b(vada\s*pav|sabudana\s*vada|neer\s*dosa)\b/i.test(blob)) {
    cuisine = "South Indian";
    rawTags.push("south-indian");
  } else if (/\b(goan|vindaloo|xacuti|cafreal|recheado|balchao|sorpotel|poee|pois|ros\s*omelette|bebinca|serradura|dodol|sol\s*kadi|kokum|sannas|rissois|kismoor|amot\s*tik|kalchi\s*kodi|neer\s*dosa|pitta|kingfish|cashew\s*chicken|tisryo)\b/i.test(blob)) {
    cuisine = "Goan";
    rawTags.push("goan", "coastal");
  } else if (/\b(maharashtrian|modak|kothimbir|misal|pav\s*bhaji|vada\s*pav|puran\s*poli|thalipeeth|bharli\s*vangi|zunka|pithla|bhakar|bhakri|sabudana|batata\s*bhaji|kanda\s*poha|poha|shrikhand|solkadhi|sukha|rassa|bombil|alu\s*wadi|kolhapuri|bhel\s*puri|sev\s*puri|dahi\s*puri|matki\s*usal|sheera|kanda\s*bhaji)\b/i.test(blob)) {
    cuisine = "Maharashtrian";
    rawTags.push("maharashtrian");
  } else if (/\b(hakka|manchurian|schezwan|noodle|noodles|fried\s*rice|momos|dimsum|chilli\s*paneer|chilli\s*chicken|chilli\s*mushroom|spring\s*roll|hot\s*and\s*sour|chinese)\b/i.test(blob)) {
    cuisine = "Chinese";
    rawTags.push("chinese");
  } else if (/\b(pizza|pasta|margherita|alfredo|arrabbiata|farmhouse|pepperoni|tiramisu|pastry|lasagna|risotto|garlic\s*bread|italian)\b/i.test(blob)) {
    cuisine = "Italian";
    rawTags.push("italian");
  } else if (/\b(burger|sandwich|fries|onion\s*rings|wings|wrap|milkshake|smoothie|orange\s*juice|sweet\s*lime|mint\s*soda|lemon\s*juice|cold\s*coffee|jaljeera|brownie|ice\s*cream|coleslaw|butter\s*corn|fast\s*food|continental)\b/i.test(blob)) {
    cuisine = "Fast Food";
    rawTags.push("fast-food", "continental");
  } else if (/\b(chaat|pani\s*puri|samosa|pakora|kachori|roll|frankie)\b/i.test(blob)) {
    cuisine = "Street Food";
    rawTags.push("street-food", "snack");
  } else {
    cuisine = "North Indian";
    rawTags.push("north-indian");
  }

  let spiceLevel: SpiceLevel = "medium";
  if (/\b(spicy|fiery|hot\s*and\s*sour|vindaloo|schezwan|peri\s*peri|kolhapuri|mirchi|chilli|65|pepper|pepperoni|chettinad|xacuti|cafreal|recheado|balchao|sorpotel|amot\s*tik|kalchi\s*kodi|kismoor|misal|sukha|rassa|bharli\s*vangi|zunka|pithla|usal|kothimbir|alu\s*wadi|kanda\s*bhaji|vada\s*pav|pav\s*bhaji|bhel\s*puri|sev\s*puri|tikka|rogan\s*josh|chole|egg\s*curry|manchurian|arrabbiata|wings|jaljeera|ros\s*omelette|masaledar|biryani|kingfish|prawn|crab|sausage)\b/i.test(blob) && !/\b(veg\s*biryani|paneer\s*biryani|mushroom\s*biryani)\b/i.test(blob)) {
    spiceLevel = "spicy";
    rawTags.push("spicy");
  } else if (/\b(sweet|dessert|gulab|rasmalai|kheer|halwa|ice\s*cream|cake|pastry|brownie|bebinca|dodol|modak|shrikhand|sheera|puran\s*poli|tiramisu|lassi|milkshake|smoothie|juice|coffee|soda|water|chaas|buttermilk|solkadhi|sol\s*kadi|sherbet|malai|butter|makhani|korma|shahi|curd|dahi|idli|dosa|uttapam|medu\s*vada|pongal|appam|lemon\s*rice|paratha|naan|jeera\s*rice|palak\s*paneer|hakka|fried\s*rice|spring\s*roll|alfredo|garlic\s*bread|pizza|burger|fries|onion\s*rings|wrap|sandwich|coleslaw|corn|thalipeeth|sabudana|batata\s*bhaji|poha|rissois|sannas|poee|neer\s*dosa|pitta|veg\s*thali|mild)\b/i.test(blob)) {
    spiceLevel = "mild";
    rawTags.push("mild");
  } else {
    rawTags.push("medium-spicy");
  }

  if (/\b(crispy|crunchy|fried|pakora|bhaji|samosa|dosa|vada|65|fries|onion\s*rings|spring\s*roll|papad|bombil|kothimbir|alu\s*wadi|rissois)\b/i.test(blob)) rawTags.push("crispy");
  if (/\b(creamy|butter|makhani|malai|korma|shahi|alfredo|rabdi|paneer\s*butter|xacuti|moilee|stew|shrikhand|dahi\s*puri|lassi|milkshake|ice\s*cream|tiramisu|cold\s*coffee)\b/i.test(blob)) rawTags.push("creamy");
  if (/\b(tandoor|tandoori|tikka|kebab|seekh|naan|roti|kulcha|smoky|charred|cashew\s*chicken)\b/i.test(blob)) rawTags.push("tandoor", "smoky");
  if (/\b(sweet|gulab|rasmalai|halwa|kheer|dessert|bebinca|dodol|modak|shrikhand|sheera|puran\s*poli|tiramisu|pastry|brownie|ice\s*cream|chocolate|strawberry|mango|orange|sweet\s*lime|sherbet|coffee|sannas|dahi\s*puri|lassi\s*sweet|sweet\s*lassi)\b/i.test(blob)) {
    rawTags.push("sweet");
    const sIdx = rawTags.indexOf("savory");
    if (sIdx >= 0 && /\b(dessert|modak|bebinca|dodol|shrikhand|sheera|puran\s*poli|tiramisu|pastry|brownie|ice\s*cream|milkshake|smoothie|juice|coffee|sherbet|sweet\s*lassi|coconut\s*water)\b/i.test(blob)) {
      rawTags.splice(sIdx, 1);
    }
  }
  if (/\b(tangy|chaat|bhel|sev\s*puri|dahi\s*puri|imli|tamarind|lemon|nimbu|sweet\s*lime|orange|mint\s*soda|jaljeera|achari|vindaloo|balchao|amot\s*tik|solkadhi|sol\s*kadi|kokum|rasam|hot\s*and\s*sour|coleslaw)\b/i.test(blob)) rawTags.push("tangy");
  if (/\b(cheese|cheesy|mozzarella|cheddar|pizza)\b/i.test(blob)) rawTags.push("cheesy");
  if (/\b(chaat|bhel|sev\s*puri|dahi\s*puri|vada\s*pav|pav\s*bhaji|misal|kothimbir|alu\s*wadi|kanda\s*bhaji|bombil|chicken\s*65|chicken\s*lollipop|ros\s*omelette|chilli\s*paneer\s*dry|chilli\s*chicken\s*dry|hakka\s*noodles|veg\s*manchurian|jaljeera|butter\s*corn)\b/i.test(blob)) rawTags.push("street-food");
  if (/\b(biryani)\b/i.test(blob)) rawTags.push("biryani", "rice");
  if (/\b(dosa|uttapam)\b/i.test(blob)) rawTags.push("dosa");
  if (/\b(idli)\b/i.test(blob)) rawTags.push("idli");
  if (/\b(paneer)\b/i.test(blob)) rawTags.push("paneer");
  if (/\b(chicken|murgh)\b/i.test(blob)) rawTags.push("chicken");
  if (/\b(mutton|lamb|gosht|keema)\b/i.test(blob)) rawTags.push("mutton");
  if (/\b(fish|prawn|shrimp|crab|seafood|kingfish|pomfret|calamari|tisryo|bombil|rissois|kismoor|amot\s*tik)\b/i.test(blob)) rawTags.push("seafood");
  if (/\b(dal|tadka|makhani)\b/i.test(blob) && /\bdal\b/i.test(blob)) rawTags.push("dal");
  if (/\b(curry|masala|gravy|korma|kadai|vindaloo|xacuti|cafreal|recheado|rassa|moilee)\b/i.test(blob)) rawTags.push("curry");
  if (/\b(naan|roti|paratha|kulcha|bread|bhature|poee|pois|pitta|bhakri)\b/i.test(blob)) rawTags.push("bread");
  if (/\b(rice|pulao)\b/i.test(blob)) rawTags.push("rice");
  if (/\b(noodle|noodles|chowmein)\b/i.test(blob)) rawTags.push("noodles");
  if (/\b(thali)\b/i.test(blob)) rawTags.push("thali");
  if (/\b(dosa|idli|uttapam|pongal|appam|paratha|thalipeeth|sabudana\s*khichdi|batata\s*bhaji|poha|sannas|ros\s*omelette|neer\s*dosa)\b/i.test(blob)) rawTags.push("breakfast");
  if (/\b(soda|juice|smoothie|water|sherbet|sol\s*kadi|solkadhi|lassi|jaljeera|chaas|cold\s*coffee)\b/i.test(blob)) rawTags.push("refreshing");
  if (category === "Starters") rawTags.push("starter", "snack");
  if (category === "Desserts") rawTags.push("dessert");
  if (category === "Drinks") rawTags.push("beverage");

  const tags = normalizeFoodTags(rawTags, { isVeg, spiceLevel });
  return { category, isVeg, spiceLevel, cuisine, tags };
}

/**
 * Validate a base64 image data URL (`data:image/jpeg;base64,...`) before
 * sending over the wire or calling a vision model.
 */
export function validateImageDataUrl(input: unknown): ImageValidationResult {
  if (typeof input !== "string" || !input.trim()) {
    return {
      ok: false,
      code: "IMAGE_MISSING",
      message: "Please choose a clear food photo (JPG, PNG, or WebP under 4 MB).",
    };
  }

  const trimmed = input.trim();
  const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i.exec(trimmed);
  if (!match) {
    return {
      ok: false,
      code: "IMAGE_INVALID_FORMAT",
      message: "Unsupported photo format. Please use a JPG, PNG, or WebP image.",
    };
  }

  const mime = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
  const base64 = match[2].replace(/\s+/g, "");
  if (base64.length < 32) {
    return {
      ok: false,
      code: "IMAGE_MISSING",
      message: "The selected photo appears to be empty. Please try another photo.",
    };
  }

  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      code: "IMAGE_TOO_LARGE",
      message: "That photo is over 4 MB. Please pick a smaller image or take a closer shot.",
    };
  }

  return { ok: true, mime, base64, approxBytes };
}

/**
 * Construct a high-signal semantic + lexical query string from VisionAnalysis
 * for `match_embeddings_hybrid` (vector + FTS + trigram).
 */
export function buildVisionSearchQuery(analysis: Pick<
  VisionAnalysis,
  "dishName" | "cuisine" | "category" | "isVeg" | "tags" | "caption"
>): string {
  const parts: string[] = [];
  if (analysis.dishName.trim()) {
    // Repeat dishName slightly to boost lexical FTS & trigram weight
    parts.push(analysis.dishName.trim());
  }
  if (analysis.category.trim()) parts.push(analysis.category.trim());
  if (analysis.cuisine.trim()) parts.push(analysis.cuisine.trim());
  parts.push(analysis.isVeg ? "veg" : "non-veg");
  if (analysis.tags.length > 0) {
    parts.push(analysis.tags.join(" "));
  }
  if (analysis.caption.trim()) {
    parts.push(analysis.caption.trim());
  }
  return parts.join(" · ").slice(0, 450);
}

/**
 * Compute Precision, Recall, and F1 between predicted tags and ground-truth gold tags.
 */
export function computeTagPRF1(
  predicted: string[],
  gold: string[],
): { precision: number; recall: number; f1: number; hits: number } {
  const predSet = new Set(normalizeFoodTags(predicted, { maxTags: 20 }));
  const goldSet = new Set(normalizeFoodTags(gold, { maxTags: 20 }));

  if (predSet.size === 0 && goldSet.size === 0) {
    return { precision: 1, recall: 1, f1: 1, hits: 0 };
  }
  if (predSet.size === 0 || goldSet.size === 0) {
    return { precision: 0, recall: 0, f1: 0, hits: 0 };
  }

  let hits = 0;
  for (const tag of predSet) {
    if (goldSet.has(tag)) hits += 1;
  }

  const precision = hits / predSet.size;
  const recall = hits / goldSet.size;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return { precision, recall, f1, hits };
}

/**
 * Compute Hit@1, Hit@K, and Mean Reciprocal Rank (MRR) for a single query.
 */
export function computeRetrievalMetrics(
  rankedKeys: string[],
  goldKeys: Iterable<string>,
  k = 5,
): { hitAt1: number; hitAtK: number; mrr: number; firstHitRank: number | null } {
  const gold = new Set(
    Array.from(goldKeys)
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean),
  );
  if (gold.size === 0 || rankedKeys.length === 0) {
    return { hitAt1: 0, hitAtK: 0, mrr: 0, firstHitRank: null };
  }

  const topK = rankedKeys.slice(0, Math.max(1, k)).map((x) => x.trim().toLowerCase());
  const idx = topK.findIndex((item) => gold.has(item));

  if (idx === -1) {
    return { hitAt1: 0, hitAtK: 0, mrr: 0, firstHitRank: null };
  }

  const rank = idx + 1;
  return {
    hitAt1: rank === 1 ? 1 : 0,
    hitAtK: 1,
    mrr: 1 / rank,
    firstHitRank: rank,
  };
}
