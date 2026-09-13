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
  CHROME_PATH: process.env.CHROME_PATH || "",
  CORS_ORIGINS: process.env.CORS_ORIGINS || "",
  PORT: parseInt(process.env.PORT || "4000", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
};
