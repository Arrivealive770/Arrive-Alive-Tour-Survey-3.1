/**
 * Which job this server is doing right now, for everything outside the
 * failover code that needs to behave differently on the backup computer.
 *
 *   main                the desktop. Always serving.
 *   backup / standby    copying the main server; must not serve tablets, send
 *                       emails or purge anything — the main server does that.
 *   backup / active     the main server is down and this one has taken over.
 *   backup / draining   the main server is back; handing data back to it.
 *
 * With no SERVER_ROLE in backend/.env the server is "main" with no backup,
 * and every check here is a no-op.
 */
import { env } from "../../env";
import { trimOrigin } from "./sqlite";

export type BackupState = "standby" | "active" | "draining";

export const isBackup = env.SERVER_ROLE === "backup";

let backupState: BackupState = "standby";
let backupStateSince = new Date();

export function currentBackupState(): BackupState {
  return backupState;
}

export function backupStateSinceAt(): Date {
  return backupStateSince;
}

/** Only the watchdog calls this. */
export function setBackupState(next: BackupState, since = new Date()): void {
  backupState = next;
  backupStateSince = since;
}

/** Should tablets' writes be accepted here? */
export function servesDevices(): boolean {
  return !isBackup || backupState === "active";
}

/**
 * Should the purge and other clean-up jobs stand still? On a backup that isn't
 * in charge, anything they changed would be overwritten by the next copy, and
 * any files they deleted would just be downloaded again.
 */
export function holdBackgroundCleanup(): boolean {
  return isBackup && backupState !== "active";
}

// ----------------------------------------------------------- main server

/**
 * The window after the main server starts in which the backup may still be
 * handing back. Emails it already sent while in charge are deleted from the
 * queue by the hand-back; sending from the main server's stale queue before
 * that arrives would email those people twice.
 */
const HOLD_EMAILS_AFTER_BOOT_MS = 10 * 60 * 1000;
const BACKUP_STATUS_CACHE_MS = 15 * 1000;

const bootedAt = Date.now();
let backupStatusCache: { at: number; handingBack: boolean } | null = null;

async function backupIsHandingBack(): Promise<boolean> {
  if (!env.BACKUP_SERVER_URL) return false;
  if (backupStatusCache && Date.now() - backupStatusCache.at < BACKUP_STATUS_CACHE_MS) {
    return backupStatusCache.handingBack;
  }
  let handingBack = false;
  try {
    const res = await fetch(`${trimOrigin(env.BACKUP_SERVER_URL)}/api/failover/status`, {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const body = (await res.json()) as { data?: { state?: string; pendingHandback?: number } };
      handingBack =
        body.data?.state === "active" ||
        body.data?.state === "draining" ||
        (body.data?.pendingHandback ?? 0) > 0;
    }
  } catch {
    // Backup off or unreachable: it can't be holding anything for us.
  }
  backupStatusCache = { at: Date.now(), handingBack };
  return handingBack;
}

/** Should pledge emails wait? */
export async function holdPledgeEmails(): Promise<boolean> {
  if (isBackup) return backupState !== "active";
  if (Date.now() - bootedAt > HOLD_EMAILS_AFTER_BOOT_MS) return false;
  return backupIsHandingBack();
}

/** What the main server knows about its backup, from the backup's copy requests. */
export const backupContact: { lastCopyAt: Date | null; commit: string | null } = {
  lastCopyAt: null,
  commit: null,
};
