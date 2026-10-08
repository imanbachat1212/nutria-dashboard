import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import routes from "./routes/index.js";
import { errorHandler } from "./middleware/error.js";

const app = express();

// req.ip behind a reverse proxy (prompt-125).
//
// Express reads req.ip from the socket unless told otherwise, so on Render — which terminates TLS
// at its edge and forwards over HTTP — every audit row would record the proxy's address and every
// rate-limit bucket would be shared by the whole internet. With this set, Express reads the
// right-most untrusted address from X-Forwarded-For instead.
//
// `1`, not `true`: Render puts exactly ONE hop in front of the service. `true` trusts the entire
// chain, which means a client can prepend any address it likes to X-Forwarded-For and Express
// will believe it — spoofing both the audit trail and the login rate limiter. Trusting exactly
// one hop takes the address Render itself appended and ignores anything the client claimed
// before it.
//
// Locally there is no proxy, so nothing sends X-Forwarded-For and req.ip is the socket address
// as before.
app.set("trust proxy", 1);

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
