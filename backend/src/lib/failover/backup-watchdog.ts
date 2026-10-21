/**
 * The backup computer's watchdog. Runs only when SERVER_ROLE=backup.
 *
 * Every 15 seconds it asks the main server "are you there?" and acts on it:
 *
 *   standby   Main answering: copy its database and photos, once a minute.
 *             Main silent for FAILOVER_TAKEOVER_MINUTES: take over.
 *   active    In charge. Tablets and phones send here; pledge emails go out
 *             from here. Every change is journaled (journal.ts).
 *             Main answering again: start handing back.
 *   draining  Refuse new writes, send the journal and new photos to the main
 *             server, then go back to standby and copy fresh.
 *
 * The state is kept in backend/failover-state.json, so a backup that restarts
 * mid-takeover (its own Windows Update) carries on where it was and never
 * copies over data it hasn't handed back yet.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, readdir, rename, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { env } from "../../env";
import { prisma } from "../../prisma";
import { runningCommit } from "../version";
import type { HandbackBatch, HandbackResult } from "./handback";
import { removeQuietly, scratchFile, type MirrorResult } from "./mirror";
import { databaseFile, trimOrigin } from "./sqlite";
import { runSqliteTask } from "./worker-client";
import {
  backupStateSinceAt,
  currentBackupState,
  setBackupState,
  type BackupState,
} from "./status";

const CHECK_EVERY_MS = 15_000;
const COPY_EVERY_MS = 60_000;
// The quick "has anything changed?" test is based on file times. Copy in full
// now and then regardless, so a missed change can never last long.
const FULL_COPY_EVERY_MS = 10 * 60_000;
// Two answers in a row (~30s) before handing back: a main server still in the
// middle of booting can answer once and then fall over.
const HEALTHY_CHECKS_BEFORE_HANDBACK = 2;
const HANDBACK_BATCH = 20_000;
const SELF_CHECK_EVERY_MS = 5 * 60_000;

const STATE_FILE = join(process.cwd(), "failover-state.json");
const UPLOADS_DIR = join(process.cwd(), "uploads");
/** Upload names are UUIDs plus an extension. Anything else is not ours to copy. */
const SAFE_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/;
/** Generated on demand by lib/standard-overlay.ts; never delete them. */
const GENERATED_FILE = /^standard-overlay/;

const mainUrl = trimOrigin(env.MAIN_SERVER_URL ?? "");
const ownUrl = trimOrigin(env.BACKEND_URL);
const takeoverMs = Number(env.FAILOVER_TAKEOVER_MINUTES ?? "3") * 60_000;

interface PersistedState {
  state: BackupState;
  stateSince: string;
  promotedAt: string | null;
  lastCopyAt: string | null;
}

/** Everything the status endpoint and the admin page show. */
export const watchdogInfo = {
  mainLastSeenAt: null as Date | null,
  /** The address the main server stores in its photo/overlay URLs. */
  mainBackendUrl: mainUrl,
  mainCommit: null as string | null,
  lastCopyAt: null as Date | null,
  lastCopyError: null as string | null,
  lastHandbackAt: null as Date | null,
  lastHandbackError: null as string | null,
  lastHandback: null as HandbackResult | null,
  /** Can this computer reach its own Tailscale address? If not, nor can the tablets. */
  selfReachable: null as boolean | null,
  pendingHandback: 0,
  promotedAt: null as Date | null,
  notTakingOverBecause: null as string | null,
};

let mainLastOkAt = Date.now();
let okStreak = 0;
let lastCopyAttemptAt = 0;
let lastFullCopyAt = 0;
let lastSnapshotTag: string | null = null;
let lastSelfCheckAt = 0;
let started = false;

// ------------------------------------------------------------------ state

function persist(): void {
  const data: PersistedState = {
    state: currentBackupState(),
    stateSince: backupStateSinceAt().toISOString(),
    promotedAt: watchdogInfo.promotedAt?.toISOString() ?? null,
    lastCopyAt: watchdogInfo.lastCopyAt?.toISOString() ?? null,
  };
  try {
    writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("[Backup] Could not save failover-state.json:", err);
  }
}

function loadPersisted(): PersistedState | null {
  try {
    if (!existsSync(STATE_FILE)) return null;
    return JSON.parse(readFileSync(STATE_FILE, "utf8")) as PersistedState;
  } catch {
    return null;
  }
}

function changeState(next: BackupState): void {
  setBackupState(next);
  persist();
}

function journalCount(): Promise<number> {
  return prisma.failoverJournal.count();
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function authHeaders(): Record<string, string> {
  return {
    "x-failover-key": env.FAILOVER_KEY ?? "",
    "x-failover-commit": runningCommit(),
  };
}

/** Turn an HTTP refusal from the main server into something a person can act on. */
async function refusal(res: Response, doing: string): Promise<Error> {
  if (res.status === 401) {
    return new Error(
      "The main server rejected this computer's FAILOVER_KEY. It must be exactly the same in backend\\.env on both computers."
    );
  }
  if (res.status === 404) {
    return new Error(
      "The main server doesn't have the backup feature yet. Run update-all.bat on the main computer."
    );
  }
  const body = await res.text().catch(() => "");
  return new Error(`Main server refused ${doing} (HTTP ${res.status}) ${body.slice(0, 300)}`.trim());
}

// ----------------------------------------------------------------- checks

async function checkMain(): Promise<{ commit?: string; backendUrl?: string } | null> {
  try {
    const res = await fetch(`${mainUrl}/health`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { status?: string; commit?: string; backendUrl?: string };
    return body.status === "ok" ? body : null;
  } catch {
    return null;
  }
}

async function checkSelf(): Promise<void> {
  lastSelfCheckAt = Date.now();
  try {
    const res = await fetch(`${ownUrl}/health`, { signal: AbortSignal.timeout(8000) });
    watchdogInfo.selfReachable = res.ok;
  } catch {
    watchdogInfo.selfReachable = false;
  }
}

// ---------------------------------------------------------------- copying

async function copyUploadsFromMain(): Promise<void> {
  const res = await fetch(`${mainUrl}/api/failover/uploads`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw await refusal(res, "the photo list");
  const body = (await res.json()) as { data: { files: { name: string; size: number }[] } };
  const remote = body.data.files.filter((f) => SAFE_FILENAME.test(f.name));

  await mkdir(UPLOADS_DIR, { recursive: true });
  const local = new Map<string, number>();
  for (const entry of await readdir(UPLOADS_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || entry.name.startsWith(".")) continue;
    local.set(entry.name, (await stat(join(UPLOADS_DIR, entry.name))).size);
  }

  for (const file of remote) {
    if (local.get(file.name) === file.size) continue;
    const download = await fetch(`${mainUrl}/uploads/${encodeURIComponent(file.name)}`, {
      signal: AbortSignal.timeout(120_000),
    });
    if (!download.ok) continue;
    // Write beside it and swap in, so a half-downloaded photo is never served.
    const partial = join(UPLOADS_DIR, `.${file.name}.part`);
    await Bun.write(partial, download);
    await unlink(join(UPLOADS_DIR, file.name)).catch(() => {});
    await rename(partial, join(UPLOADS_DIR, file.name));
  }

  // Photos the main server has purged go from here too.
  const keep = new Set(remote.map((f) => f.name));
  for (const name of local.keys()) {
    if (!keep.has(name) && !GENERATED_FILE.test(name)) {
      await unlink(join(UPLOADS_DIR, name)).catch(() => {});
    }
  }
}

async function copyFromMain(): Promise<void> {
  if (currentBackupState() !== "standby") return;

  // Never copy over data that hasn't been handed back. The copy replaces
  // every row, so anything still in the journal would be lost for good.
  if ((await journalCount()) > 0) {
    changeState("draining");
    return;
  }

  const full = Date.now() - lastFullCopyAt >= FULL_COPY_EVERY_MS;
  const headers = authHeaders();
  if (!full && lastSnapshotTag) headers["if-none-match"] = lastSnapshotTag;

  const res = await fetch(`${mainUrl}/api/failover/snapshot`, {
    headers,
    signal: AbortSignal.timeout(180_000),
  });

  if (res.status !== 304) {
    if (!res.ok) throw await refusal(res, "the database copy");
    const incoming = scratchFile("incoming");
    try {
      await Bun.write(incoming, res);
      const result = await runSqliteTask<MirrorResult>("apply-snapshot", {
        file: incoming,
        fromOrigin: watchdogInfo.mainBackendUrl,
        toOrigin: ownUrl,
      });
      console.log(`[Backup] Copied the main server: ${result.rows} rows in ${result.tables} tables`);
    } finally {
      removeQuietly(incoming);
    }
    lastSnapshotTag = res.headers.get("etag");
    if (full) lastFullCopyAt = Date.now();
  }

  await copyUploadsFromMain();

  if (!watchdogInfo.lastCopyAt) console.log("[Backup] First copy of the main server complete. On standby.");
  watchdogInfo.lastCopyAt = new Date();
  watchdogInfo.lastCopyError = null;
  persist();
}

// ------------------------------------------------------------ taking over

async function takeOver(): Promise<void> {
  // Journal first: a tablet may send the moment the state says "active".
  await runSqliteTask("journal-on");
  watchdogInfo.promotedAt = new Date();
  watchdogInfo.notTakingOverBecause = null;
  changeState("active");
  console.log("");
  console.log("==================================================");
  console.log("[Backup] The main server has not answered for", takeoverMs / 60_000, "minutes.");
  console.log("[Backup] TAKING OVER. Tablets and phones will switch to this computer.");
  console.log("==================================================");
}

async function maybeTakeOver(): Promise<void> {
  let reason: string | null = null;
  if (!watchdogInfo.lastCopyAt) {
    reason = "it has never managed to copy the main server, so it has no events or devices to serve";
  } else {
    if (watchdogInfo.selfReachable !== true) await checkSelf();
    if (!watchdogInfo.selfReachable) {
      reason = `the tablets couldn't reach it either: ${ownUrl} does not answer (is "tailscale serve --bg 3000" running on this computer?)`;
    }
  }

  if (reason) {
    if (watchdogInfo.notTakingOverBecause !== reason) {
      console.warn(`[Backup] The main server is down, but this computer is NOT taking over: ${reason}`);
    }
    watchdogInfo.notTakingOverBecause = reason;
    return;
  }
  await takeOver();
}

// ------------------------------------------------------------ handing back

async function pushUploadsToMain(): Promise<void> {
  if (!watchdogInfo.promotedAt || !existsSync(UPLOADS_DIR)) return;
  // Only photos made while this computer was in charge. Older ones came from
  // the main server — if it no longer has them, it purged them on purpose.
  const since = watchdogInfo.promotedAt.getTime() - 60_000;

  const res = await fetch(`${mainUrl}/api/failover/uploads`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw await refusal(res, "the photo list");
  const body = (await res.json()) as { data: { files: { name: string }[] } };
  const onMain = new Set(body.data.files.map((f) => f.name));

  for (const entry of await readdir(UPLOADS_DIR, { withFileTypes: true })) {
    const name = entry.name;
    if (!entry.isFile() || name.startsWith(".") || !SAFE_FILENAME.test(name) || onMain.has(name)) {
      continue;
    }
    const path = join(UPLOADS_DIR, name);
    if ((await stat(path)).mtimeMs < since) continue;
    const put = await fetch(`${mainUrl}/api/failover/uploads/${encodeURIComponent(name)}`, {
      method: "PUT",
      headers: authHeaders(),
      body: Bun.file(path),
      signal: AbortSignal.timeout(120_000),
    });
    if (!put.ok) throw await refusal(put, `photo ${name}`);
  }
}

/** True once everything has been handed back. */
async function handBack(): Promise<boolean> {
  await pushUploadsToMain();

  for (let round = 0; round < 20; round++) {
    const batch = await runSqliteTask<HandbackBatch>("collect-handback", {
      limit: HANDBACK_BATCH,
      fromOrigin: ownUrl,
      toOrigin: watchdogInfo.mainBackendUrl,
    });
    if (batch.throughSeq === 0) return true;

    const res = await fetch(`${mainUrl}/api/failover/handback`, {
      method: "POST",
      headers: { ...authHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ changes: batch.changes }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok) throw await refusal(res, "the hand-back");
    const result = ((await res.json()) as { data: HandbackResult }).data;

    console.log(
      `[Backup] Handed back ${result.applied} change(s) to the main server` +
        (result.duplicates ? `, ${result.duplicates} it already had` : "") +
        (result.goneOnMain ? `, ${result.goneOnMain} it had since deleted` : "") +
        (result.skipped.length ? `, ${result.skipped.length} SKIPPED` : "")
    );
    for (const skip of result.skipped.slice(0, 20)) {
      console.warn(`[Backup]   skipped ${skip.table} ${skip.id}: ${skip.reason}`);
    }

    // A row changed again while this was in flight has a higher seq, so it
    // stays and goes in the next round.
    await prisma.failoverJournal.deleteMany({ where: { seq: { lte: batch.throughSeq } } });
    watchdogInfo.lastHandback = result;
    watchdogInfo.lastHandbackAt = new Date();
    watchdogInfo.lastHandbackError = null;
  }
  return false;
}

/**
 * Keep a copy of everything collected during the takeover before the next
 * copy from the main server replaces it. Cheap insurance: if anything was
 * ever missed in the hand-back, it can still be found here.
 */
async function keepTakeoverCopy(): Promise<void> {
  try {
    const dir = join(databaseFile(), "..", "backups");
    mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const target = join(dir, `takeover-${stamp}.db`);
    await runSqliteTask("snapshot", { target });
    console.log(`[Backup] Saved a copy of the takeover data: ${target}`);
  } catch (err) {
    console.warn("[Backup] Could not save a copy of the takeover data:", errorText(err));
  }
}

async function standDown(): Promise<boolean> {
  if ((await journalCount()) > 0) return false;
  await runSqliteTask("journal-off");

  watchdogInfo.promotedAt = null;
  lastSnapshotTag = null;
  lastCopyAttemptAt = 0;
  changeState("standby");
  console.log("[Backup] Everything handed back. The main server is in charge again; back on standby.");
  return true;
}

// -------------------------------------------------------------------- loop

async function tick(): Promise<void> {
  const now = Date.now();
  const health = await checkMain();
  if (health) {
    mainLastOkAt = now;
    okStreak += 1;
    watchdogInfo.mainLastSeenAt = new Date(now);
    watchdogInfo.mainCommit = health.commit ?? null;
    if (health.backendUrl) watchdogInfo.mainBackendUrl = trimOrigin(health.backendUrl);
  } else {
    okStreak = 0;
  }

  if (now - lastSelfCheckAt >= SELF_CHECK_EVERY_MS) await checkSelf();

  switch (currentBackupState()) {
    case "standby":
      if (health) {
        watchdogInfo.notTakingOverBecause = null;
        if (now - lastCopyAttemptAt >= COPY_EVERY_MS) {
          lastCopyAttemptAt = now;
          try {
            await copyFromMain();
          } catch (err) {
            const message = errorText(err);
            if (watchdogInfo.lastCopyError !== message) {
              console.error(`[Backup] Could not copy the main server: ${message}`);
            }
            watchdogInfo.lastCopyError = message;
          }
        }
      } else if (now - mainLastOkAt >= takeoverMs) {
        await maybeTakeOver();
      }
      break;

    case "active":
      if (health && okStreak >= HEALTHY_CHECKS_BEFORE_HANDBACK) {
        console.log("[Backup] The main server is back. Handing everything back to it...");
        changeState("draining");
      }
      break;

    case "draining":
      if (!health) {
        console.log("[Backup] The main server went quiet again before the hand-back finished. Staying in charge.");
        changeState("active");
        break;
      }
      try {
        if (await handBack()) {
          await keepTakeoverCopy();
          await standDown();
        }
      } catch (err) {
        const message = errorText(err);
        if (watchdogInfo.lastHandbackError !== message) {
          console.error(`[Backup] Hand-back failed, will retry: ${message}`);
        }
        watchdogInfo.lastHandbackError = message;
      }
      break;
  }

  watchdogInfo.pendingHandback = await journalCount();
}

export async function startBackupWatchdog(): Promise<void> {
  if (started) return;
  started = true;

  const saved = loadPersisted();
  const pending = await journalCount();
  let state: BackupState = saved?.state ?? "standby";
  // Unsent data always wins over what the file says.
  if (pending > 0 && state === "standby") state = "draining";

  if (saved?.lastCopyAt) watchdogInfo.lastCopyAt = new Date(saved.lastCopyAt);
  if (saved?.promotedAt) watchdogInfo.promotedAt = new Date(saved.promotedAt);

  // A schema update at boot can rebuild a table and drop its triggers, so put
  // them back if this computer was in charge when it went down.
  await runSqliteTask(state === "standby" ? "journal-off" : "journal-on");
  setBackupState(state, saved?.stateSince ? new Date(saved.stateSince) : new Date());
  watchdogInfo.pendingHandback = pending;
  persist();

  console.log(`[Backup] This is the BACKUP computer. Watching ${mainUrl} (state: ${state}).`);
  console.log(`[Backup] Takes over after ${takeoverMs / 60_000} minutes without an answer.`);

  const loop = async () => {
    try {
      await tick();
    } catch (err) {
      console.error("[Backup] Watchdog error:", errorText(err));
    } finally {
      setTimeout(loop, CHECK_EVERY_MS);
    }
  };
  setTimeout(loop, 1000);
}

export function backupStatus() {
  return {
    role: "backup" as const,
    state: currentBackupState(),
    stateSince: backupStateSinceAt().toISOString(),
    commit: runningCommit(),
    mainUrl,
    mainLastSeenAt: watchdogInfo.mainLastSeenAt?.toISOString() ?? null,
    mainCommit: watchdogInfo.mainCommit,
    lastCopyAt: watchdogInfo.lastCopyAt?.toISOString() ?? null,
    lastCopyError: watchdogInfo.lastCopyError,
    lastHandbackAt: watchdogInfo.lastHandbackAt?.toISOString() ?? null,
    lastHandbackError: watchdogInfo.lastHandbackError,
    lastHandback: watchdogInfo.lastHandback
      ? { ...watchdogInfo.lastHandback, skipped: watchdogInfo.lastHandback.skipped.length }
      : null,
    pendingHandback: watchdogInfo.pendingHandback,
    selfReachable: watchdogInfo.selfReachable,
    takeoverAfterMinutes: takeoverMs / 60_000,
    takenOverAt: watchdogInfo.promotedAt?.toISOString() ?? null,
    notTakingOverBecause: watchdogInfo.notTakingOverBecause,
  };
}
