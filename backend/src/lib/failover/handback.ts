/**
 * Handing data collected by the backup back to the main server.
 *
 * Backup side: `collectHandback` turns the journal into a list of changes,
 * with each changed row's current contents.
 *
 * Main side: `applyHandback` merges them in. The rules:
 *   - Rows the backup created are inserted.
 *   - Rows the backup changed are updated — but only if the main server still
 *     has them. A row the main server deleted (a purged photo, a deleted event)
 *     stays deleted; the backup's copy of it was simply stale.
 *   - Rows the backup deleted are deleted.
 *   - A row the main server already has under a different id (same survey sent
 *     to both servers, so the same `localId`) is not duplicated. Anything that
 *     pointed at the backup's id is pointed at the main server's instead.
 *   - One bad row never blocks the rest. It is skipped and reported.
 */
import type { Database } from "bun:sqlite";
import { readJournal, type JournalEntry, type JournalOp } from "./journal";
import {
  dataTables,
  foreignKeys,
  ident,
  openDatabase,
  parentFirstOrder,
  rewriteOrigin,
  tableColumns,
  uniqueColumnSets,
  type ForeignKey,
} from "./sqlite";

export type SqlValue = string | number | null;

export interface HandbackChange {
  table: string;
  op: JournalOp;
  id: string;
  /** Current contents, for insert/update. */
  row?: Record<string, SqlValue>;
}

export interface HandbackSkip {
  table: string;
  id: string;
  reason: string;
}

export interface HandbackResult {
  applied: number;
  /** Already on the main server (e.g. a survey that reached both). */
  duplicates: number;
  /** Changed on the backup but deleted on the main server since. */
  goneOnMain: number;
  skipped: HandbackSkip[];
}

// ------------------------------------------------------------------ backup

export interface HandbackBatch {
  /** Highest journal seq included. Clear through this once the main server confirms. */
  throughSeq: number;
  changes: HandbackChange[];
}

/**
 * Worker only. Read the oldest journal entries and build the changes for them,
 * rewriting this server's address to the main server's inside stored URLs.
 */
export function collectHandback(limit: number, fromOrigin: string, toOrigin: string): HandbackBatch {
  const db = openDatabase({ readonly: true });
  try {
    const entries = readJournal(db, limit);
    return {
      throughSeq: entries.length ? entries[entries.length - 1]!.seq : 0,
      changes: buildChanges(db, entries, fromOrigin, toOrigin),
    };
  } finally {
    db.close();
  }
}

function buildChanges(
  db: Database,
  entries: JournalEntry[],
  fromOrigin: string,
  toOrigin: string
): HandbackChange[] {
  const changes: HandbackChange[] = [];
  for (const entry of entries) {
    if (entry.op === "delete") {
      changes.push({ table: entry.tbl, op: "delete", id: entry.rowId });
      continue;
    }
    let row: Record<string, SqlValue> | null = null;
    try {
      row = db
        .query(`SELECT * FROM ${ident(entry.tbl)} WHERE "id" = ?`)
        .get(entry.rowId) as Record<string, SqlValue> | null;
    } catch {
      // Table gone after a schema change. Nothing to send.
      row = null;
    }
    if (!row) continue;
    changes.push({
      table: entry.tbl,
      op: entry.op,
      id: entry.rowId,
      row: rewriteOrigin(row, fromOrigin, toOrigin),
    });
  }
  return changes;
}

// -------------------------------------------------------------------- main

interface TableMeta {
  columns: Set<string>;
  foreignKeys: ForeignKey[];
  uniques: string[][];
}

function isSqlValue(value: unknown): value is SqlValue {
  return value === null || typeof value === "string" || typeof value === "number";
}

/** Worker only (see sqlite.ts). */
export function applyHandback(changes: HandbackChange[]): HandbackResult {
  const result: HandbackResult = { applied: 0, duplicates: 0, goneOnMain: 0, skipped: [] };
  const db = openDatabase();

  try {
    db.run("PRAGMA foreign_keys = ON");

    const tables = dataTables(db);
    const order = parentFirstOrder(db, tables);
    const meta = new Map<string, TableMeta>(
      tables.map((t) => [
        t,
        {
          columns: new Set(tableColumns(db, t).map((c) => c.name)),
          foreignKeys: foreignKeys(db, t).filter((fk) => fk.to === "id"),
          uniques: uniqueColumnSets(db, t),
        },
      ])
    );

    // backup id -> main id, per table, for rows the main server already had.
    const remap = new Map<string, Map<string, string>>();

    const byTable = new Map<string, HandbackChange[]>();
    for (const change of changes) {
      if (!meta.has(change.table)) {
        result.skipped.push({
          table: change.table,
          id: change.id,
          reason: "table does not exist on the main server",
        });
        continue;
      }
      const list = byTable.get(change.table) ?? [];
      list.push(change);
      byTable.set(change.table, list);
    }

    const findExisting = (table: string, row: Record<string, SqlValue>): string | null => {
      for (const cols of meta.get(table)!.uniques) {
        if (cols.some((c) => row[c] === undefined || row[c] === null)) continue;
        const where = cols.map((c) => `${ident(c)} = ?`).join(" AND ");
        const found = db
          .query(`SELECT "id" FROM ${ident(table)} WHERE ${where}`)
          .get(...cols.map((c) => row[c] as string | number)) as { id: string } | null;
        if (found) return found.id;
      }
      return null;
    };

    const upsert = (table: string, change: HandbackChange) => {
      const info = meta.get(table)!;
      const row: Record<string, SqlValue> = {};
      for (const [key, value] of Object.entries(change.row ?? {})) {
        if (info.columns.has(key) && isSqlValue(value)) row[key] = value;
      }
      for (const fk of info.foreignKeys) {
        const value = row[fk.from];
        const mapped = typeof value === "string" ? remap.get(fk.table)?.get(value) : undefined;
        if (mapped) row[fk.from] = mapped;
      }

      const exists = db.query(`SELECT 1 FROM ${ident(table)} WHERE "id" = ?`).get(change.id);
      if (exists) {
        const cols = Object.keys(row).filter((c) => c !== "id");
        if (cols.length === 0) return;
        db.query(
          `UPDATE ${ident(table)} SET ${cols.map((c) => `${ident(c)} = ?`).join(", ")} WHERE "id" = ?`
        ).run(...cols.map((c) => row[c]!), change.id);
        result.applied += 1;
        return;
      }

      if (change.op !== "insert") {
        result.goneOnMain += 1;
        return;
      }

      const already = findExisting(table, row);
      if (already) {
        let tableMap = remap.get(table);
        if (!tableMap) remap.set(table, (tableMap = new Map()));
        tableMap.set(change.id, already);
        result.duplicates += 1;
        return;
      }

      const cols = Object.keys(row);
      db.query(
        `INSERT INTO ${ident(table)} (${cols.map(ident).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`
      ).run(...cols.map((c) => row[c]!));
      result.applied += 1;
    };

    const attempt = (table: string, id: string, work: () => void) => {
      db.run("SAVEPOINT handback_row");
      try {
        work();
        db.run("RELEASE handback_row");
      } catch (err) {
        db.run("ROLLBACK TO handback_row");
        db.run("RELEASE handback_row");
        result.skipped.push({
          table,
          id,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    };

    const merge = db.transaction(() => {
      for (const table of order) {
        for (const change of byTable.get(table) ?? []) {
          if (change.op === "delete") continue;
          attempt(table, change.id, () => upsert(table, change));
        }
      }
      // Children before parents, so nothing is deleted out from under a row
      // that is itself about to be deleted.
      for (const table of [...order].reverse()) {
        for (const change of byTable.get(table) ?? []) {
          if (change.op !== "delete") continue;
          attempt(table, change.id, () => {
            const gone = db.query(`DELETE FROM ${ident(table)} WHERE "id" = ?`).run(change.id);
            if (gone.changes > 0) result.applied += 1;
          });
        }
      }
    });
    merge.immediate();
  } finally {
    db.close();
  }

  return result;
}
