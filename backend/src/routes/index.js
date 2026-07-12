import { Router } from "express";
import publicRoutes from "../modules/public/public.routes.js";
import authRoutes from "../modules/auth/auth.routes.js";
import usersRoutes from "../modules/users/users.routes.js";
import clientsRoutes from "../modules/clients/clients.routes.js";
import foodsRoutes from "../modules/foods/foods.routes.js";
import mediaRoutes from "../modules/media/media.routes.js";
import auditRoutes from "../modules/audit/audit.routes.js";
import leadsRoutes from "../modules/leads/leads.routes.js";
import intakeRoutes from "../modules/intake/intake.routes.js";
import journalRoutes from "../modules/journal/journal.routes.js";
import appointmentsRoutes from "../modules/appointments/appointments.routes.js";
import mealplansRoutes from "../modules/mealplans/mealplans.routes.js";
import mealsRoutes from "../modules/meals/meals.routes.js";
import messagesRoutes from "../modules/messages/messages.routes.js";
import reportsRoutes from "../modules/reports/reports.routes.js";
import billingRoutes from "../modules/billing/billing.routes.js";
import automationRoutes from "../modules/automation/automation.routes.js";
import settingsRoutes from "../modules/settings/settings.routes.js";
import cmsRoutes from "../modules/cms/cms.routes.js";
import webhooksRoutes from "../modules/webhooks/webhooks.routes.js";
import outboxRoutes from "../modules/outbox/outbox.routes.js";

const router = Router();

router.use("/public", publicRoutes);
router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/clients", clientsRoutes);
router.use("/foods", foodsRoutes);
router.use("/media", mediaRoutes);
router.use("/audit", auditRoutes);
router.use("/leads", leadsRoutes);
router.use("/intake", intakeRoutes);
router.use("/journal", journalRoutes);
router.use("/appointments", appointmentsRoutes);
router.use("/mealplans", mealplansRoutes);
router.use("/meals", mealsRoutes);
// Gym Booking merged into /appointments (gym-machine / gym-class types). gym.routes.js is left
// in place, unmounted, as scaffolding for a future Workout API — see workout.model.js.
router.use("/messages", messagesRoutes);
router.use("/reports", reportsRoutes);
router.use("/billing", billingRoutes);
router.use("/automation", automationRoutes);
router.use("/settings", settingsRoutes);
router.use("/cms", cmsRoutes);
router.use("/webhooks", webhooksRoutes);
router.use("/outbox", outboxRoutes);

export default router;
