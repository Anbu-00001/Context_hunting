import * as Sentry from "@sentry/node";
import { createServer, getServerPort } from "@devvit/web/server";
import { serverOnRequest } from "./server.ts";

// ── Sentry — must init before anything else ──────────────
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
  // Keep performance sampling low to stay within free-tier limits
  tracesSampleRate: 0.2,
});

console.log("[QUORUM] Sentry initialized");

// ── HTTP Server ──────────────────────────────────────────
const server = createServer(serverOnRequest);
const port: number = getServerPort();

server.on("error", (err) => {
  Sentry.captureException(err);
  console.error(`server error; ${err.stack}`);
});
server.listen(port);
