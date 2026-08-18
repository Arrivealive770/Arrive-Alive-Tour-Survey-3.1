/**
 * Nightly survey-database backup for the desktop deployment.
 *
 * Run by the scheduled task that desktop/install-autostart.ps1 creates:
 *   bun desktop/backup-database.ts
 *
 * Uses SQLite's VACUUM INTO rather than copying the file. A plain file
 * copy of a live database can capture a half-written transaction and
 * produce a backup that looks fine and restores corrupt — the failure you
 * only discover on the day you need it. VACUUM INTO asks SQLite itself
 * for a consistent snapshot while the server keeps serving.
 *
 * Keeps the most recent RETAIN backups and deletes older ones, so this
 * cannot quietly fill the disk over a touring season.
 */
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const RETAIN = 30;

// The database the server actually uses, resolved from the same
// DATABASE_URL the server reads, so the backup can never drift to a
// different file than the live one.
function resolveDatabaseFile(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Run this from the repo root so backend/.env is picked up.");
  }
  if (!url.startsWith("file:")) {
    throw new Error(`DATABASE_URL is not a SQLite file URL: ${url}`);
  }
  // Prisma resolves relative paths against prisma/, not the cwd.
  const raw = url.slice("file:".length).split("?")[0];
  return resolve(join(process.cwd(), "backend", "prisma"), raw);
}

const dbFile = resolveDatabaseFile();

if (!existsSync(dbFile)) {
  console.error(`Backup skipped: no database at ${dbFile}`);
  process.exit(1);
}

const backupDir = join(dirname(dbFile), "backups");
mkdirSync(backupDir, { recursive: true });

// Sortable, filename-safe, and second-resolution so two runs never collide.
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const target = join(backupDir, `survey-backup-${stamp}.db`);

const db = new Database(dbFile, { readonly: true });
try {
  // VACUUM INTO takes a literal path, not a bound parameter. Single quotes
  // are doubled so a path containing one cannot break out of the string.
  db.run(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
} finally {
  db.close();
}

const sizeMb = (statSync(target).size / 1024 / 1024).toFixed(1);
console.log(`Backup written: ${target} (${sizeMb} MB)`);

// Report what survived, so a backup of an empty database is visible in the
// log rather than passing as success.
const check = new Database(target, { readonly: true });
try {
  const surveys = check.query("SELECT COUNT(*) AS n FROM SurveyResponse").get() as { n: number };
  console.log(`Verified: ${surveys.n} survey response(s) in the backup`);
} catch {
  console.warn("WARNING: could not read SurveyResponse from the backup — check the database.");
} finally {
  check.close();
}

const old = readdirSync(backupDir)
  .filter((f) => f.startsWith("survey-backup-") && f.endsWith(".db"))
  .sort()
  .reverse()
  .slice(RETAIN);

for (const f of old) {
  unlinkSync(join(backupDir, f));
  console.log(`Pruned old backup: ${f}`);
}

console.log(`Done. Keeping up to ${RETAIN} backups in ${backupDir}`);
