import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import * as ctrl from "./recipe-import.controller.js";
import { importRecipeSchema } from "./recipe-import.validation.js";

const router = Router();

router.use(authenticate);

// Gated on meals.create rather than a new permission: this produces a recipe draft and exists
// only to be saved as a Meal, so anyone who can create a recipe can import one and anyone who
// can't, shouldn't. Both seeded roles already carry meals.create — nothing to add to seed.js.
//
// No audit middleware: auditAction logs create/update/delete of a persisted entity, and this
// endpoint persists no Meal. The Meal that eventually results is audited by POST /api/meals,
// which is where the record actually comes into existence.
router.post("/", requirePermission("meals.create"), validate(importRecipeSchema), ctrl.importRecipe);

export default router;
