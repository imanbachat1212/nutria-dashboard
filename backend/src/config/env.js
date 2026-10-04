import "dotenv/config";

const required = (key) => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
};

export const env = {
  MONGO_URI: required("MONGO_URI"),
  JWT_SECRET: required("JWT_SECRET"),
  // Unrestricted service key (permissions ["*"]) — kept as-is for existing internal tooling.
  SERVICE_API_KEY: required("SERVICE_API_KEY"),
  // Scoped service key for the WhatsApp journal intake (prompt-91). Optional: leave it unset
  // and the intake endpoint simply has no key that can reach it. Never give this one to
  // anything but the n8n flow — see SERVICE_KEYS in middleware/auth.js for its exact scope.
  INTAKE_API_KEY: process.env.INTAKE_API_KEY || "",
  USDA_API_KEY: process.env.USDA_API_KEY || "",
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || "",
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || "",
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || "",
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || "",
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL || "",
  // Outbound WhatsApp (prompt-96). The backend never talks to Meta — it POSTs
  // { phone, message } to this n8n webhook and n8n does the sending. Unset means the Messages
  // page can read threads but sending returns a clear 503 rather than failing obscurely.
  N8N_OUTBOUND_WEBHOOK_URL: process.env.N8N_OUTBOUND_WEBHOOK_URL || "",
  // Shared secret sent as X-Nutria-Secret on that call, so a leaked webhook URL alone can't
  // trigger real messages to real clients.
  N8N_OUTBOUND_SECRET: process.env.N8N_OUTBOUND_SECRET || "",
  // Backend-initiated LLM calls (prompt-120, recipe import). Until now the only AI in this
  // system lived inside the n8n WhatsApp workflow — lib/n8n.js just POSTs a webhook and has no
  // model call of its own — so there was no provider config on this side at all. Recipe import
  // is the first feature that needs the backend itself to talk to a model.
  //
  // All three are optional on purpose: unset means recipe import still works, falling back to
  // the deterministic ingredient parser (see recipe-import/lib/ingredient-parser.js) rather
  // than 503-ing. isAiConfigured() in lib/openrouter.js is the single check for "can we ask a
  // model", and the import response reports which parser actually ran.
  AI_PROVIDER: process.env.AI_PROVIDER || "openrouter",
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
  // Cheap + fast is the right trade here: the task is mechanical line-splitting, not reasoning.
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
  CHROME_PATH: process.env.CHROME_PATH || "",
  CORS_ORIGINS: process.env.CORS_ORIGINS || "",
  PORT: parseInt(process.env.PORT || "4000", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
};
