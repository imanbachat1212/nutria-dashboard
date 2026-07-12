import { Router } from "express";
import multer from "multer";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import * as ctrl from "./media.controller.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router();

router.post(
  "/",
  authenticate,
  requirePermission("media.upload"),
  upload.single("image"),
  ctrl.upload
);

export default router;
