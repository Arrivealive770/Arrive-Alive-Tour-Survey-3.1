import "@vibecodeapp/proxy"; // DO NOT REMOVE OTHERWISE VIBECODE PROXY WILL NOT WORK
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import "./env";
import { auth } from "./auth";
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
];

app.use(
  "*",
  cors({
    origin: (origin) => (origin && allowed.some((re) => re.test(origin)) ? origin : null),
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
app.route("/admin", adminPortalRouter);

const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
};
