import type { MealPlan } from "./meal-plans-mock";
import { type AddItemPayload, addPlanItem, removePlanItem } from "./mealplans-api";

// Undo for Meal Plans' bulk copy actions (prompt-85).
//
// ── Why the three copy paths need different undo data ────────────────────────────────────────
// The copies do NOT all behave the same way, which decides what "undo" has to put back:
//
//   copySlotToSlot (drag-and-drop, same day)  APPENDS onto the target slot.
//   copyMealSlot   (one slot -> other days)   APPENDS onto each target day's slot.
//     -> undo only has to delete what the copy created.
//
//   copyDay        (Copy day -> other days)   REPLACES. mealplans.service.js does
//     `plan.items = plan.items.filter(i => !toDays.includes(i.day))` before copying, so every
//     item already on a target day is DESTROYED.
//     -> deleting what the copy created would leave the target day EMPTY, not restored. Undo
//        must also re-add what was wiped, which is why `restore` exists.
//
// ── How the items to remove are identified ───────────────────────────────────────────────────
// Every copy endpoint returns the whole updated plan, so the ids created by one specific copy
// are simply the ids present afterwards that weren't present before. Undo deletes exactly those
// ids — never "everything in the target slot", which would take unrelated items with it.
//
// ── The guard ────────────────────────────────────────────────────────────────────────────────
// `expectedIds` is the plan's complete item-id set captured immediately after the copy. Undo
// re-checks it against the plan's current state and refuses if anything at all has changed —
// an item edited (updateItem replaces the subdocument, so its id changes), removed, or added.
// This is what makes the restore step safe: re-adding the wiped items can only ever be correct
// if nothing has happened since the copy. Failing closed and saying so beats deleting or
// resurrecting something the dietitian didn't expect.
export interface CopyUndoRecord {
  planId: string;
  label: string;
  createdIds: string[];
  restore: AddItemPayload[];
  expectedIds: string[];
}

export function allItemIds(plan: MealPlan): string[] {
  return plan.days.flatMap((d) => d.meals.flatMap((m) => m.items.map((i) => i.id)));
}

// Items present after the copy that weren't there before — i.e. exactly what this copy created.
export function createdItemIds(before: MealPlan, after: MealPlan): string[] {
  const had = new Set(allItemIds(before));
  return allItemIds(after).filter((id) => !had.has(id));
}

// Rebuilds the add-payload for an item that copyDay is about to destroy, so undo can put it
// back. Returns null for an item with no food/meal reference to rebuild from — such an item
// can't be re-created, and the caller treats that as "this copy isn't safely undoable".
export function itemToAddPayload(
  plan: MealPlan,
  dayIndex: number,
  slot: string,
  item: MealPlan["days"][number]["meals"][number]["items"][number],
): AddItemPayload | null {
  const type = item.itemType ?? "food";
  if (type === "recipe") {
    if (!item.mealId) return null;
    return { day: dayIndex, slot, type: "recipe", meal: item.mealId, servings: item.rawQuantity ?? 1 };
  }
  if (!item.foodId) return null;
  return {
    day: dayIndex,
    slot,
    type: "food",
    food: item.foodId,
    quantity: item.rawQuantity ?? 0,
    unit: item.rawUnit ?? "g",
    measureLabel: item.measureLabel ?? null,
    measureDescription: item.measureDescription ?? null,
    measureCount: item.measureCount ?? null,
  };
}

// Everything copyDay will wipe on the days it's about to overwrite.
export function itemsDestroyedByDayCopy(plan: MealPlan, toDays: number[]): AddItemPayload[] | null {
  const payloads: AddItemPayload[] = [];
  for (const dayIndex of toDays) {
    const day = plan.days[dayIndex];
    if (!day) continue;
    for (const meal of day.meals) {
      for (const item of meal.items) {
        const p = itemToAddPayload(plan, dayIndex, meal.slot, item);
        if (!p) return null; // can't faithfully rebuild this one -> don't offer undo at all
        payloads.push(p);
      }
    }
  }
  return payloads;
}

export type UndoResult = { ok: true } | { ok: false; reason: string };

// Runs the undo against the plan's CURRENT state, refusing if anything changed since the copy.
export async function runCopyUndo(
  record: CopyUndoRecord,
  currentPlan: MealPlan | undefined,
): Promise<UndoResult> {
  if (!currentPlan) {
    return { ok: false, reason: "Couldn't read the plan's current state — nothing was changed." };
  }

  const current = allItemIds(currentPlan);
  const expected = record.expectedIds;
  const changed =
    current.length !== expected.length || current.some((id, i) => id !== expected[i]);
  if (changed) {
    return {
      ok: false,
      reason: "This plan changed since the copy, so undo was skipped — nothing was removed.",
    };
  }

  // Remove what the copy created, then put back anything it overwrote. Sequential rather than
  // parallel: these are subdocument mutations on one document, and concurrent writes to the
  // same plan would race each other's version of the items array.
  for (const id of record.createdIds) {
    await removePlanItem(record.planId, id);
  }
  for (const payload of record.restore) {
    await addPlanItem(record.planId, payload);
  }
  return { ok: true };
}
