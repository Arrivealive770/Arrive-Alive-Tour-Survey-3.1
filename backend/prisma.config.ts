import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Prisma CLI configuration.
 *
 * Replaces the deprecated `package.json#prisma` block (removed in Prisma 7).
 *
 * IMPORTANT: the mere existence of this file makes the Prisma CLI print
 * "Prisma config detected, skipping environment variable loading" and stop
 * reading backend/.env by itself. The desktop kiosk keeps DATABASE_URL in
 * backend/.env and runs `prisma db push` at every boot, so we have to load
 * that file ourselves here or the survey server never starts.
 */
function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return;

  for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).replace(/^export\s+/, "").trim();
    let value = line.slice(eq + 1).trim();

    // Strip one matching pair of surrounding quotes, the way dotenv does.
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length > 1) {
      value = value.slice(1, -1);
      if (quote === '"') value = value.replace(/\\n/g, "\n");
    }

    // First definition wins: a real environment variable always beats the file.
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, ".env"));

/**
 * Development fallback. The Prisma CLI does not see the Zod default in
 * src/env.ts, so a checkout with no backend/.env used to abort with P1012 and
 * the server never started. This file is the durable home for the fallback:
 * the platform periodically re-syncs backend/scripts/ from a template, which
 * silently reverts anything written there.
 *
 * Production is untouched — it sets DATABASE_URL via .env or the hosting
 * environment, and `??=` never overwrites an existing value.
 */
if (process.env.NODE_ENV !== "production") {
  process.env.DATABASE_URL ??= "file:./dev.db";
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "bun run prisma/seed.ts",
  },
});
