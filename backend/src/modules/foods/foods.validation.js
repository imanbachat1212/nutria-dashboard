import { z } from "zod";

// Shared by createFoodSchema and updateFoodSchema — ~44 optional/nullable micronutrient
// fields, all matching the existing sugar/sodium nullable-number pattern.
const micronutrientFields = {
  fiberSoluble: z.number().min(0).nullable().optional(),
  fiberInsoluble: z.number().min(0).nullable().optional(),
  starch: z.number().min(0).nullable().optional(),

  fatSaturated: z.number().min(0).nullable().optional(),
  fatMonounsaturated: z.number().min(0).nullable().optional(),
  fatPolyunsaturated: z.number().min(0).nullable().optional(),
  fatTrans: z.number().min(0).nullable().optional(),
  cholesterol: z.number().min(0).nullable().optional(),
  omega3Ala: z.number().min(0).nullable().optional(),
  omega3Epa: z.number().min(0).nullable().optional(),
  omega3Dha: z.number().min(0).nullable().optional(),
  omega6La: z.number().min(0).nullable().optional(),
  omega6Aa: z.number().min(0).nullable().optional(),
  omega6LaApprox: z.boolean().optional(),
  omega6AaApprox: z.boolean().optional(),

  aminoCystine: z.number().min(0).nullable().optional(),
  aminoHistidine: z.number().min(0).nullable().optional(),
  aminoIsoleucine: z.number().min(0).nullable().optional(),
  aminoLeucine: z.number().min(0).nullable().optional(),
  aminoLysine: z.number().min(0).nullable().optional(),
  aminoMethionine: z.number().min(0).nullable().optional(),
  aminoPhenylalanine: z.number().min(0).nullable().optional(),
  aminoThreonine: z.number().min(0).nullable().optional(),
  aminoTryptophan: z.number().min(0).nullable().optional(),
  aminoTyrosine: z.number().min(0).nullable().optional(),
  aminoValine: z.number().min(0).nullable().optional(),

  vitaminB1: z.number().min(0).nullable().optional(),
  vitaminB2: z.number().min(0).nullable().optional(),
  vitaminB3: z.number().min(0).nullable().optional(),
  vitaminB5: z.number().min(0).nullable().optional(),
  vitaminB6: z.number().min(0).nullable().optional(),
  vitaminB12: z.number().min(0).nullable().optional(),
  folate: z.number().min(0).nullable().optional(),
  vitaminK: z.number().min(0).nullable().optional(),
  vitaminASourceUnit: z.enum(["mcg", "iu"]).nullable().optional(),
  vitaminDSourceUnit: z.enum(["mcg", "iu"]).nullable().optional(),

  calcium: z.number().min(0).nullable().optional(),
  copper: z.number().min(0).nullable().optional(),
  magnesium: z.number().min(0).nullable().optional(),
  manganese: z.number().min(0).nullable().optional(),
  phosphorus: z.number().min(0).nullable().optional(),
  potassium: z.number().min(0).nullable().optional(),
  selenium: z.number().min(0).nullable().optional(),
  zinc: z.number().min(0).nullable().optional(),

  oxalate: z.number().min(0).nullable().optional(),
  phytate: z.number().min(0).nullable().optional(),
};

export const createFoodSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    nameAr: z.string().optional(),
    brand: z.string().optional(),
    category: z.string().optional(),
    source: z.enum(["usda", "lebanese", "custom"]).optional(),
    servingSize: z.number().positive(),
    servingUnit: z.string().default("g"),
    commonServings: z
      .array(z.object({ label: z.string().min(1), grams: z.number().min(0) }))
      .optional(),
    calories: z.number().min(0),
    protein: z.number().min(0),
    carbs: z.number().min(0),
    fat: z.number().min(0),
    fiber: z.number().min(0).optional(),
    sugar: z.number().min(0).nullable().optional(),
    sodium: z.number().min(0).nullable().optional(),
    vitaminA: z.number().min(0).nullable().optional(),
    vitaminD: z.number().min(0).nullable().optional(),
    vitaminE: z.number().min(0).nullable().optional(),
    vitaminC: z.number().min(0).nullable().optional(),
    iron: z.number().min(0).nullable().optional(),
    dataSource: z.string().nullable().optional(),
    allergens: z.array(z.string()).optional(),
    notes: z.string().nullable().optional(),
    verified: z.boolean().optional(),
    ...micronutrientFields,
  }),
});

export const updateFoodSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    name: z.string().min(1).optional(),
    nameAr: z.string().optional(),
    brand: z.string().optional(),
    category: z.string().optional(),
    source: z.enum(["usda", "lebanese", "custom"]).optional(),
    servingSize: z.number().positive().optional(),
    servingUnit: z.string().optional(),
    commonServings: z
      .array(z.object({ label: z.string().min(1), grams: z.number().min(0) }))
      .optional(),
    calories: z.number().min(0).optional(),
    protein: z.number().min(0).optional(),
    carbs: z.number().min(0).optional(),
    fat: z.number().min(0).optional(),
    fiber: z.number().min(0).optional(),
    sugar: z.number().min(0).nullable().optional(),
    sodium: z.number().min(0).nullable().optional(),
    vitaminA: z.number().min(0).nullable().optional(),
    vitaminD: z.number().min(0).nullable().optional(),
    vitaminE: z.number().min(0).nullable().optional(),
    vitaminC: z.number().min(0).nullable().optional(),
    iron: z.number().min(0).nullable().optional(),
    dataSource: z.string().nullable().optional(),
    allergens: z.array(z.string()).optional(),
    notes: z.string().nullable().optional(),
    verified: z.boolean().optional(),
    // Written by the dietitian explicitly accepting/dismissing an FNDDS unit-weight suggestion
    // (see foods.service.js's matchFoodName hook) — never auto-sent as part of a normal
    // create/edit form submission itself.
    gramsPerCup: z.number().min(0).nullable().optional(),
    gramsPerTbsp: z.number().min(0).nullable().optional(),
    gramsPerTsp: z.number().min(0).nullable().optional(),
    gramsPerPiece: z.number().min(0).nullable().optional(),
    gramsPerMl: z.number().min(0).nullable().optional(),
    ...micronutrientFields,
  }),
});

// Query params always arrive as strings — z.coerce.boolean() would treat "false" as truthy
// (any non-empty string), so booleans need an explicit string->boolean mapping instead.
const booleanQueryParam = z
  .enum(["true", "false"])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === "true"));

export const listFoodsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().optional(),
    category: z.string().optional(),
    source: z.enum(["usda", "lebanese", "custom"]).optional(),
    verified: booleanQueryParam,
    // "Favorites" always means the requesting user's own favorites — there is no
    // client-supplied user filter, so this is just an on/off switch.
    favorites: booleanQueryParam,
  }),
});

export const foodsStatsSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    category: z.string().optional(),
    source: z.enum(["usda", "lebanese", "custom"]).optional(),
    verified: booleanQueryParam,
    favorites: booleanQueryParam,
  }),
});

export const favoriteParamsSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const bulkDeleteFoodsSchema = z.object({
  body: z.object({
    // Bounded well above what a couple of 100-row pages of selections would ever produce —
    // guards against an absurd payload rather than a realistic dietitian workflow.
    ids: z.array(z.string().min(1)).min(1).max(500),
  }),
});

export const usdaSearchSchema = z.object({
  query: z.object({
    q: z.string().min(1),
    // USDA's own /foods/search caps pageSize at 200 — mirrored here rather than left
    // unbounded, so a caller can't ask this proxy for more than USDA itself would return.
    limit: z.coerce.number().int().min(1).max(200).default(200),
  }),
});

export const usdaImportedSchema = z.object({
  query: z.object({
    // comma-separated fdcIds, e.g. "1234,5678" — parsed to numbers in the controller
    fdcIds: z.string().min(1),
  }),
});

export const usdaImportSchema = z.object({
  body: z.object({
    fdcId: z.number().int().positive(),
  }),
});

export const usdaDetailsSchema = z.object({
  params: z.object({
    fdcId: z.coerce.number().int().positive(),
  }),
});
