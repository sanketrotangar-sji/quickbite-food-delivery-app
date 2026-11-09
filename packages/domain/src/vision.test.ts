import { describe, expect, it } from "vitest";

import {
  buildVisionSearchQuery,
  computeRetrievalMetrics,
  computeTagPRF1,
  inferAttributesFromText,
  normalizeFoodTags,
  normalizeMenuCategory,
  validateImageDataUrl,
} from "./vision.ts";

describe("normalizeFoodTags", () => {
  it("normalizes synonyms, deduplicates, and enforces isVeg consistency", () => {
    const tags = normalizeFoodTags(
      ["Vegetarian", "Hot", "South Indian", "crepe", "non-veg", "spicy"],
      { isVeg: true, spiceLevel: "spicy" },
    );
    expect(tags).toContain("veg");
    expect(tags).toContain("spicy");
    expect(tags).toContain("south-indian");
    expect(tags).toContain("dosa");
    expect(tags).not.toContain("non-veg");
    expect(new Set(tags).size).toBe(tags.length);
  });

  it("strips veg/vegan when isVeg is false", () => {
    const tags = normalizeFoodTags(["Chicken", "Tandoori", "veg"], {
      isVeg: false,
      spiceLevel: "medium",
    });
    expect(tags).toContain("non-veg");
    expect(tags).toContain("chicken");
    expect(tags).toContain("tandoor");
    expect(tags).not.toContain("veg");
  });
});

describe("normalizeMenuCategory", () => {
  it("maps dish hints to canonical categories", () => {
    expect(normalizeMenuCategory("", "Hyderabadi Chicken Dum Biryani")).toBe("Biryani");
    expect(normalizeMenuCategory("", "Masala Dosa with Sambar")).toBe("South Indian");
    expect(normalizeMenuCategory("", "Butter Garlic Naan")).toBe("Breads");
    expect(normalizeMenuCategory("Desserts", "Gulab Jamun")).toBe("Desserts");
    expect(normalizeMenuCategory("", "Mango Lassi")).toBe("Drinks");
  });
});

describe("inferAttributesFromText", () => {
  it("infers Goan non-veg spicy curry attributes", () => {
    const inferred = inferAttributesFromText({
      name: "Goan Prawn Balchao",
      description: "Fiery tangy coastal prawn pickle curry",
      category: "Main Course",
    });
    expect(inferred.isVeg).toBe(false);
    expect(inferred.cuisine).toBe("Goan");
    expect(inferred.spiceLevel).toBe("spicy");
    expect(inferred.tags).toEqual(
      expect.arrayContaining(["non-veg", "goan", "spicy", "seafood"]),
    );
  });

  it("infers South Indian veg breakfast attributes", () => {
    const inferred = inferAttributesFromText({
      name: "Mysore Masala Dosa",
      description: "Crispy fermented crepe with spicy red chutney and potato masala",
      category: "South Indian",
    });
    expect(inferred.isVeg).toBe(true);
    expect(inferred.category).toBe("South Indian");
    expect(inferred.tags).toEqual(
      expect.arrayContaining(["veg", "south-indian", "dosa", "crispy"]),
    );
  });
});

describe("validateImageDataUrl", () => {
  it("rejects empty or invalid format", () => {
    expect(validateImageDataUrl("")).toMatchObject({ ok: false, code: "IMAGE_MISSING" });
    expect(validateImageDataUrl("http://example.com/a.jpg")).toMatchObject({
      ok: false,
      code: "IMAGE_INVALID_FORMAT",
    });
  });

  it("accepts a valid jpeg data url", () => {
    const b64 = "A".repeat(128);
    const res = validateImageDataUrl(`data:image/jpeg;base64,${b64}`);
    expect(res).toMatchObject({ ok: true, mime: "image/jpeg" });
  });
});

describe("buildVisionSearchQuery", () => {
  it("combines dishName, category, cuisine, diet, tags, and caption", () => {
    const q = buildVisionSearchQuery({
      dishName: "Paneer Butter Masala",
      category: "Main Course",
      cuisine: "North Indian",
      isVeg: true,
      tags: ["veg", "paneer", "creamy", "curry"],
      caption: "Rich tomato cashew gravy with cottage cheese cubes",
    });
    expect(q).toContain("Paneer Butter Masala");
    expect(q).toContain("creamy");
    expect(q).toContain("veg");
  });
});

describe("computeTagPRF1 & computeRetrievalMetrics", () => {
  it("calculates tag precision, recall, and F1", () => {
    const res = computeTagPRF1(
      ["veg", "south-indian", "dosa", "crispy"],
      ["veg", "south-indian", "dosa"],
    );
    expect(res.hits).toBe(3);
    expect(res.precision).toBeCloseTo(3 / 4);
    expect(res.recall).toBeCloseTo(1);
    expect(res.f1).toBeCloseTo((2 * 0.75 * 1) / 1.75);
  });

  it("calculates Hit@1, Hit@5, and MRR", () => {
    const m = computeRetrievalMetrics(["d1", "d2", "d3", "d4"], ["d3"], 5);
    expect(m.hitAt1).toBe(0);
    expect(m.hitAtK).toBe(1);
    expect(m.mrr).toBeCloseTo(1 / 3);
    expect(m.firstHitRank).toBe(3);
  });
});
