import { z } from "zod";

// One endpoint, two input modes (prompt-120): a URL to fetch, or text Sura pasted herself when
// the fetch was blocked. They're a union rather than two endpoints because everything after the
// extraction step — AI structuring, food matching, draft assembly — is identical, and two routes
// would just be two thin wrappers around one service with a shared tail.
export const importRecipeSchema = z.object({
  body: z
    .object({
      url: z.string().trim().min(1).max(2048).optional(),
      // Generous but bounded: a long recipe with headnotes pastes to a few KB; 200k is well
      // past any real recipe and keeps a pathological paste from reaching the AI call.
      rawText: z.string().trim().min(20).max(200_000).optional(),
    })
    .refine((b) => !!b.url !== !!b.rawText, {
      message: "Provide exactly one of url or rawText",
    }),
});
