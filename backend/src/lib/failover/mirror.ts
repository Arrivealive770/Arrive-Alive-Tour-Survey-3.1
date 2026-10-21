/**
 * Copying the main server's database onto the backup.
 *
 * Main side: `createSnapshot` uses VACUUM INTO for the same reason the nightly
 * backup does (desktop/backup-database.ts) — a plain file copy of a live
 * database can catch a half-written transaction.
 *
 * Backup side: `applySnapshot` replaces the contents of every table with the
 * snapshot's, inside one transaction, while the backup's own server keeps
 * running. Replacing rows rather than swapping the file means nobody has to
 * restart anything, and the backup's server never sees a half-copied state.
 */
import { mkdirSync, statSync, unlinkSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  databaseFile,
  dataTables,
  ident,
  isTextColumn,
  openDatabase,
  tableColumns,
} from "./sqlite";

/** Scratch space next to the database, so a snapshot never crosses disks. */
export function scratchDir(): string {
  const dir = join(dirname(databaseFile()), "failover-tmp");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function scratchFile(label: string, extension = ".db"): string {
  return join(scratchDir(), `${label}-${Date.now()}-${randomUUID().slice(0, 8)}${extension}`);
}

export function removeQuietly(path: string): void {
  try {
    if (existsSync(path)) unlinkSync(path);
  } catch {
    // Leftover scratch files are harmless and get overwritten names anyway.
  }
}

/**
 * Changes whenever the database does. WAL mode writes to the -wal file first
 * and folds it into the main file later, so both are part of the answer.
 * Lets the backup skip downloading a snapshot when nothing has changed.
 */
export function databaseVersionTag(): string {
  const file = databaseFile();
  const parts = [file, `${file}-wal`].map((f) => {
    try {
      const s = statSync(f);
      return `${s.size}.${Math.floor(s.mtimeMs)}`;
    } catch {
      return "0";
    }
  });
  return `"${parts.join("-")}"`;
}

/** Worker only. A consistent copy of the live database, written to `target`. */
export function createSnapshot(target: string): string {
  const db = openDatabase({ readonly: true });
  try {
    db.run(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  } finally {
    db.close();
  }
  return target;
}

export interface MirrorResult {
  tables: number;
  rows: number;
}

/**
 * Worker only. Make this database an exact copy of the snapshot, swapping the main
 * server's address for this one in every stored URL so photos and overlays
 * load from the backup while it is in charge.
 *
 * Columns are matched by name, so the two computers can run slightly different
 * versions of the code without the copy failing.
 */
export function applySnapshot(
  snapshotPath: string,
  fromOrigin: string,
  toOrigin: string
): MirrorResult {
  const db = openDatabase();
  let tables = 0;
  let rows = 0;
  try {
    // Rows go in table by table, so a child can briefly exist before its
    // parent. Per-connection setting; the server's own connections keep
    // enforcing foreign keys.
    db.run("PRAGMA foreign_keys = OFF");
    db.run("ATTACH DATABASE ? AS snap", [snapshotPath]);

    try {
      const remote = new Set(dataTables(db, "snap"));
      const rewrite = Boolean(fromOrigin) && fromOrigin !== toOrigin;

      const copyAll = db.transaction(() => {
        for (const table of dataTables(db, "main")) {
          db.run(`DELETE FROM main.${ident(table)}`);
          if (!remote.has(table)) continue;

          const remoteCols = new Set(tableColumns(db, table, "snap").map((c) => c.name));
          const cols = tableColumns(db, table, "main").filter((c) => remoteCols.has(c.name));
          if (cols.length === 0) continue;

          const names = cols.map((c) => ident(c.name)).join(", ");
          const values = cols
            .map((c) =>
              rewrite && isTextColumn(c)
                ? `REPLACE(${ident(c.name)}, $from, $to)`
                : ident(c.name)
            )
            .join(", ");

          const insert = db.query(
            `INSERT INTO main.${ident(table)} (${names}) SELECT ${values} FROM snap.${ident(table)}`
          );
          const result = rewrite ? insert.run({ $from: fromOrigin, $to: toOrigin }) : insert.run();
          tables += 1;
          rows += result.changes;
        }
      });
      copyAll.immediate();
    } finally {
      db.run("DETACH DATABASE snap");
    }
  } finally {
    db.close();
  }
  return { tables, rows };
}
