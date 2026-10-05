import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import routes from "./routes/index.js";
import { errorHandler } from "./middleware/error.js";

const app = express();

const corsOrigins = env.CORS_ORIGINS
  ? env.CORS_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:3000", "http://localhost:8081"];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (corsOrigins.includes(origin)) return callback(null, true);
    try {
      const u = new URL(origin);
      const host = u.hostname;
      if (host === "localhost" || host === "127.0.0.1") return callback(null, true);
    } catch (err) {
      // ignore parse errors
    }
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
// Inbound WhatsApp photos arrive as base64 inside the JSON body of POST
// /api/automation/messages (prompt-123). A 1-5 MB phone camera JPEG is ~1.3-6.7 MB encoded, so
// the 100 kb default below rejects it with a 413 before any of our code runs.
//
// Scoped to that ONE path rather than raised globally: every other endpoint takes small JSON,
// and a 12 MB ceiling on all of them would turn a single oversized request to any route into an
// easy way to make the server allocate. Mounted BEFORE the global parser on purpose — body-parser
// sets `req._body` once it has consumed the stream, and the global express.json() then skips a
// request this one already handled. Putting it after would be dead code: the default parser
// would have read and rejected the body first.
//
// 12 MB, not 8: the service caps the DECODED image at 8 MB, and base64 inflates by ~33%, so the
// envelope has to be bigger than the payload it carries or the size check could never report its
// own limit — the request would die at the parser with an opaque 413 instead.
app.use("/api/automation/messages", express.json({ limit: "12mb" }));

app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api", routes);

app.use(errorHandler);

export default app;
