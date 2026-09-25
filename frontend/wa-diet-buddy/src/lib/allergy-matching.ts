// Cross-references a CLIENT's recorded allergies against a FOOD or RECIPE's allergen tags
// (prompt-104), now that both sides draw from ONE canonical list (prompt-105).
//
// ── One vocabulary ──────────────────────────────────────────────────────────────────────────
// Both the Allergies pill picker in new-client-dialog.tsx and the allergen pills in
// new-food-dialog.tsx / new-recipe-dialog.tsx fetch the same Settings-managed list
// (fetchAllergies, GET /api/settings/allergies — seeded from DEFAULT_ALLERGIES in the backend's
// settings.service.js, and editable by the dietitian in Settings → Allergies). So a tag and an
// allergy are literally the same string, and matching is plain string equality.
//
// This replaces a hand-written translation table between two divergent vocabularies, and with
// it two real gaps it could never close:
//   • "Fish" had no equivalent tag at all, so a fish allergy could never fire. It now matches,
//     because "Fish" is simply one of the values both sides offer.
//   • "Peanuts" and "Tree nuts" both collapsed onto a single "nuts" tag and were therefore
//     indistinguishable. They are now separate values that match only themselves.
// Adding a new allergy in Settings makes it both recordable on a client and taggable on a
// food/recipe at once — no code change, no migration, and no way for the two to drift.
//
// ── Freeform "Other" allergies ──────────────────────────────────────────────────────────────
// new-client-dialog.tsx's "Other" field lets a dietitian type a one-off allergy for a single
// client. That used to be a dead end here — it never entered the shared Settings list, so no
// food or recipe could ever carry a matching tag and it could never fire. As of prompt-106 the
// dialog promotes any such entry into the Settings list on a successful save, so it becomes a
// normal taggable option from then on and matches like any other value.
//
// What that does NOT do is retroactively tag anything: a brand-new allergy matches only foods
// and recipes a dietitian subsequently tags with it. A conflict shown here is a genuine tag
// match; the absence of one is NOT a safety assurance — see the note on tagging discipline in
// the plan-item picker.
//
// Matching is exact (after case/whitespace normalization) rather than fuzzy, deliberately: a
// substring rule would fire "nuts" on "Coconut" and teach a dietitian to ignore the warning.

// Exported so the one place that WRITES to the shared allergy list — new-client-dialog.tsx,
// promoting a dietitian's one-off "Other" entry into a real Settings option (prompt-106) —
// decides "is this the same allergy?" exactly the way matching does. Two normalizers would
// mean a value the matcher treats as a duplicate could still be added to Settings as new.
//
// Consistent with PillMultiSelectWithOther's own isSelected/customChips checks, which compare
// with .toLowerCase(): every value that reaches `selected` through its "Other" field is
// already .trim()ed by addOther(), so trimming here can only agree with it, never diverge.
export function normalizeAllergy(value: string): string {
  return value.trim().toLowerCase();
}

// Which of this client's allergies the given item tags trigger.
//
// Returns the ORIGINAL client-allergy strings, so the UI names the allergy exactly as it is
// recorded on the client. Order follows `clientAllergies`; duplicates are collapsed.
//
// Never throws: unrecognized strings on either side, null/undefined and empty arrays all yield
// no match.
export function getAllergyConflicts(
  clientAllergies: string[] | undefined,
  itemAllergens: string[] | undefined,
): string[] {
  if (!clientAllergies?.length || !itemAllergens?.length) return [];

  const tags = new Set(itemAllergens.map(normalizeAllergy));

  const hits: string[] = [];
  for (const allergy of clientAllergies) {
    const key = normalizeAllergy(allergy);
    // Empty/whitespace-only entries would otherwise match an equally empty tag.
    if (!key) continue;
    if (tags.has(key) && !hits.includes(allergy)) hits.push(allergy);
  }
  return hits;
}

// One shared label so the picker, the edit dialog and the plan's placed-item rows all word a
// conflict identically. Kept short enough to sit inline on a dense list row.
export function formatAllergyConflicts(conflicts: string[]): string {
  return `Allergy: ${conflicts.join(", ")}`;
}
