import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as ctrl from "./auth.controller.js";
import { loginSchema, changePasswordSchema } from "./auth.validation.js";

const router = Router();

router.post("/login", validate(loginSchema), ctrl.login);
router.get("/me", authenticate, ctrl.me);
router.post("/change-password", authenticate, validate(changePasswordSchema), ctrl.changePassword);

export default router;
