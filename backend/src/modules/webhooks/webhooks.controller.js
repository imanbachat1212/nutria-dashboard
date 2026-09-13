import { asyncHandler } from "../../lib/asyncHandler.js";
import * as whatsappService from "./whatsapp.service.js";

// Thin controller, same shape as every other module's: no logic, no req/res leaking into the
// service. The WhatsApp connection itself lives entirely in n8n — this only receives the
// structured result of it (prompt-91).
export const whatsappJournal = asyncHandler(async (req, res) => {
  const entry = await whatsappService.createJournalEntryFromWhatsApp(req.validated.body, req.user);
  res.status(201).json({ data: entry });
});
