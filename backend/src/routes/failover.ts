/**
 * Endpoints between the main server and the backup computer.
 *
 *   GET  /api/failover/status          Public. Tablets ask the backup "are you
 *                                      in charge?"; the admin page shows it.
 *   GET  /api/failover/snapshot        Main only. A copy of the database.
 *   GET  /api/failover/uploads         Main only. List of photo/overlay files.
 *   PUT  /api/failover/uploads/:name   Main only. A photo taken during a takeover.
 *   POST /api/failover/handback        Main only. Rows collected during a takeover.
 *
 * Everything except /status needs the FAILOVER_KEY from backend/.env in the
 * x-failover-key header. Tailscale already keeps strangers out; the key keeps
 * any other device on the tailnet from downloading the survey database.
 */
import { Hono, type MiddlewareHandler } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { env } from "../env";
import { runningCommit } from "../lib/version";
import { backupStatus } from "../lib/failover/backup-watchdog";
import type { HandbackResult } from "../lib/failover/handback";
import { databaseVersionTag, removeQuietly, scratchFile } from "../lib/failover/mirror";
import { backupContact, isBackup } from "../lib/failover/status";
import { runSqliteTask } from "../lib/failover/worker-client";

const failoverRouter = new Hono();

const UPLOADS_DIR = join(process.cwd(), "uploads");
const SAFE_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/;

function keyMatches(given: string | undefined): boolean {
  const expected = env.FAILOVER_KEY;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Main server only, and only with the shared key. */
const mainWithKey: MiddlewareHandler = async (c, next) => {
  if (!env.FAILOVER_KEY) {
    return c.json(
      { error: { message: "No FAILOVER_KEY is set on this server", code: "FAILOVER_NOT_CONFIGURED" } },
      404
    );
  }
  if (!keyMatches(c.req.header("x-failover-key"))) {
    return c.json({ error: { message: "Wrong failover key", code: "FAILOVER_KEY_MISMATCH" } }, 401);
  }
  if (isBackup) {
    return c.json(
      {
        error: {
          message: "This is a backup computer, not the main server. Check MAIN_SERVER_URL on the other one.",
          code: "NOT_MAIN_SERVER",
        },
      },
      409
    );
  }
  backupContact.lastCopyAt = new Date();
  backupContact.commit = c.req.header("x-failover-commit") ?? null;
  await next();
};

failoverRouter.get("/status", (c) => {
  if (isBackup) return c.json({ data: backupStatus() });
  return c.json({
    data: {
      role: "main" as const,
      commit: runningCommit(),
      backup: {
        configured: Boolean(env.FAILOVER_KEY),
        url: env.BACKUP_SERVER_URL ?? null,
        lastCopyAt: backupContact.lastCopyAt?.toISOString() ?? null,
        commit: backupContact.commit,
      },
    },
  });
});

failoverRouter.get("/snapshot", mainWithKey, async (c) => {
  // Taken before the copy: a write that lands during it changes the tag, so
  // the next request copies again rather than missing it.
  const tag = databaseVersionTag();
  if (c.req.header("if-none-match") === tag) {
    return c.body(null, 304, { ETag: tag });
  }

  const file = scratchFile("snapshot");
  try {
    await runSqliteTask("snapshot", { target: file });
    const bytes = await Bun.file(file).arrayBuffer();
    return c.body(bytes, 200, { "Content-Type": "application/octet-stream", ETag: tag });
  } finally {
    removeQuietly(file);
  }
});

failoverRouter.get("/uploads", mainWithKey, async (c) => {
  const files: { name: string; size: number }[] = [];
  if (existsSync(UPLOADS_DIR)) {
    for (const entry of await readdir(UPLOADS_DIR, { withFileTypes: true })) {
      if (!entry.isFile() || !SAFE_FILENAME.test(entry.name)) continue;
      files.push({ name: entry.name, size: (await stat(join(UPLOADS_DIR, entry.name))).size });
    }
  }
  return c.json({ data: { files } });
});

failoverRouter.put("/uploads/:name", mainWithKey, async (c) => {
  const name = c.req.param("name");
  if (!SAFE_FILENAME.test(name)) {
    return c.json({ error: { message: "Bad file name", code: "BAD_FILENAME" } }, 400);
  }
  await mkdir(UPLOADS_DIR, { recursive: true });
  const target = join(UPLOADS_DIR, name);
  // Names are UUIDs, so an existing file is the same file. Never overwrite.
  if (!existsSync(target)) {
    await writeFile(target, Buffer.from(await c.req.arrayBuffer()));
  }
  return c.json({ data: { stored: name } });
});

const sqlValue = z.union([z.string(), z.number(), z.null()]);
const handbackSchema = z.object({
  changes: z.array(
    z.object({
      table: z.string().min(1),
      op: z.enum(["insert", "update", "delete"]),
      id: z.string().min(1),
      row: z.record(z.string(), sqlValue).optional(),
    })
  ),
});

failoverRouter.post("/handback", mainWithKey, zValidator("json", handbackSchema), async (c) => {
  const { changes } = c.req.valid("json");
  const result = await runSqliteTask<HandbackResult>("apply-handback", { changes });
  console.log(
    `[Failover] Backup handed back ${changes.length} change(s): ${result.applied} applied, ` +
      `${result.duplicates} already here, ${result.goneOnMain} deleted here since, ${result.skipped.length} skipped`
  );
  for (const skip of result.skipped.slice(0, 20)) {
    console.warn(`[Failover]   skipped ${skip.table} ${skip.id}: ${skip.reason}`);
  }
  return c.json({ data: result });
});

export { failoverRouter };
