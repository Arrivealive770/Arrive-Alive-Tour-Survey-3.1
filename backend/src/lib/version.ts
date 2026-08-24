import { readFileSync } from "fs";
import { join } from "path";

/**
 * Which commit this server is running.
 *
 * The desktop deployment is a git checkout updated with `git pull`, so the
 * checked-out commit is the honest answer to "did my update actually land?".
 * Read from .git directly rather than by shelling out to git, because the
 * desktop may not have git on PATH for the account the scheduled task runs as.
 *
 * Resolved once at startup: it cannot change without a restart, and /health
 * should never touch the disk.
 */
function readCommit(): string {
  try {
    const gitDir = join(process.cwd(), "..", ".git");
    const head = readFileSync(join(gitDir, "HEAD"), "utf8").trim();

    // Detached HEAD is the sha itself; otherwise "ref: refs/heads/main".
    if (!head.startsWith("ref:")) return head.slice(0, 12);

    const ref = head.slice(4).trim();
    try {
      return readFileSync(join(gitDir, ref), "utf8").trim().slice(0, 12);
    } catch {
      // Freshly cloned repos pack their refs instead of writing loose files.
      const packed = readFileSync(join(gitDir, "packed-refs"), "utf8");
      const line = packed.split("\n").find((l) => l.endsWith(` ${ref}`));
      return line ? line.split(" ")[0]!.slice(0, 12) : "unknown";
    }
  } catch {
    // Not a git checkout — a ZIP download, or running from a build artefact.
    return "unknown";
  }
}

const COMMIT = readCommit();

export function runningCommit(): string {
  return COMMIT;
}
