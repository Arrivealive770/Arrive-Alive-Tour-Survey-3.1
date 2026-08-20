import "@vibecodeapp/proxy"; // DO NOT REMOVE OTHERWISE VIBECODE PROXY WILL NOT WORK
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { env } from "./env";
import { auth } from "./auth";
import { TAILSCALE_ORIGIN_REGEX, localNetworkOrigins, localIPv4Addresses } from "./lib/origins";
import { emailService } from "./lib/email-service";
import { emailQueueProcessor } from "./lib/email-queue-processor";
import { eventPurgeScheduler } from "./lib/event-purge";
import { sampleRouter } from "./routes/sample";
import { teamsRouter } from "./routes/teams";
import { devicesRouter } from "./routes/devices";
import { eventsRouter } from "./routes/events";
import { surveysRouter } from "./routes/surveys";
import { pledgesRouter } from "./routes/pledges";
import { photosRouter } from "./routes/photos";
import { syncRouter } from "./routes/sync";
import { adminRouter } from "./routes/admin";
import { emailRouter } from "./routes/email";
import { adminPortalRouter } from "./routes/admin-portal";
import { overlaysRouter } from "./routes/overlays";
import { localPhotosRouter } from "./routes/local-photos";
import { adminUsersRouter } from "./routes/admin-users";
import { externalSurveysRouter } from "./routes/external-surveys";
import { logger } from "hono/logger";

// Type the Hono app with user/session variables
const app = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// CORS middleware - validates origin against allowlist
const allowed = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.dev\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecodeapp\.com$/,
  // Self-hosted desktop: Tailscale MagicDNS names.
  TAILSCALE_ORIGIN_REGEX,
];

// Exact LAN/Tailscale addresses for this machine, so the admin site works
// from another computer in the office. Kept as strings rather than a
// wildcard regex - see src/lib/origins.ts for why.
const allowedExact = new Set([
  env.BACKEND_URL,
  ...localNetworkOrigins(Number(process.env.PORT) || 3000),
]);

app.use(
  "*",
  cors({
    origin: (origin) =>
      origin && (allowedExact.has(origin) || allowed.some((re) => re.test(origin)))
        ? origin
        : null,
    credentials: true,
  })
);

// Logging
app.use("*", logger());

// Auth middleware - populates user/session for all routes
app.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    c.set("user", null);
    c.set("session", null);
    await next();
    return;
  }
  c.set("user", session.user);
  c.set("session", session.session);
  await next();
});

// Mount auth handler
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// Health check endpoint
app.get("/health", (c) => c.json({ status: "ok" }));

// Serve uploaded files
app.use("/uploads/*", serveStatic({ root: "./" }));

// Serve static public assets
app.use("/public/*", serveStatic({ root: "./src" }));

// Routes
app.route("/api/sample", sampleRouter);
app.route("/api/teams", teamsRouter);
app.route("/api/devices", devicesRouter);
app.route("/api/events", eventsRouter);
app.route("/api/surveys", surveysRouter);
app.route("/api/pledges", pledgesRouter);
app.route("/api/photos", photosRouter);
app.route("/api/sync", syncRouter);
app.route("/api/admin", adminRouter);
app.route("/api/email", emailRouter);
app.route("/api/overlays", overlaysRouter);
app.route("/api/local-photos", localPhotosRouter);
app.route("/api/admin-users", adminUsersRouter);
app.route("/api/external-surveys", externalSurveysRouter);
app.route("/admin", adminPortalRouter);

// Start the background email queue processor.
// If no email API key is set it logs a warning and stays idle; queued pledge
// emails are drained automatically once a key is added and the server restarts.
emailService.initialize();
emailQueueProcessor.start();

// Start the end-of-event purge. Deletes every photo and every participant
// email address for any event whose designated end time has passed. Survey
// answers are never touched.
eventPurgeScheduler.start();

const port = Number(process.env.PORT) || 3000;

// Print every address this server can be reached on. On the desktop
// deployment this log file is the only feedback anyone gets, and "which
// address do I type on the other computer" is the first question asked.
console.log(`Admin site:  http://localhost:${port}/admin`);
for (const ip of localIPv4Addresses()) {
  const label = ip.startsWith("100.") ? "Tailscale" : "Local network";
  console.log(`${label}: http://${ip}:${port}/admin`);
}

export default {
  port,
  hostname: "0.0.0.0",
  fetch: app.fetch,
};
