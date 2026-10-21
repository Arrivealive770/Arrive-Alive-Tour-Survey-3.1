/**
 * The backup's record of what it collected while it was in charge.
 *
 * When the backup takes over, every app table gets three SQLite triggers that
 * note each inserted, updated and deleted row in FailoverJournal. That is what
 * gets handed back to the main server: rows the backup *created or changed*,
 * never rows it merely copied. Copied rows can be stale — the main server may
 * have purged a photo or blanked an email after the last copy — and sending
 * those back would undo the purge.
 *
 * Triggers rather than Prisma hooks so that nothing slips past: raw SQL,
 * cascading deletes and bulk updates are all caught the same way.
 *
 * The triggers only exist while the backup is in charge. On standby there are
 * none, so the every-minute copy from the main server records nothing.
 *
 * Worker only (see sqlite.ts). The server counts and clears the journal
 * through Prisma, which has the FailoverJournal model.
 */
import type { Database } from "bun:sqlite";
import { dataTables, ident, literal, tableColumns } from "./sqlite";

const TRIGGER_PREFIX = "failover_journal_";

export type JournalOp = "insert" | "update" | "delete";

export interface JournalEntry {
  tbl: string;
  rowId: string;
  op: JournalOp;
  seq: number;
}

/** Add the triggers. Safe to call repeatedly — e.g. after a restart mid-takeover. */
export function ensureJournalTriggers(db: Database): void {
  const nextSeq = `(SELECT COALESCE(MAX(seq), 0) + 1 FROM "FailoverJournal")`;

  for (const table of dataTables(db)) {
    if (!tableColumns(db, table).some((c) => c.name === "id")) continue;

    const t = literal(table);
    const name = (kind: string) => ident(`${TRIGGER_PREFIX}${kind}_${table}`);

    db.run(`
      CREATE TRIGGER IF NOT EXISTS ${name("ins")} AFTER INSERT ON ${ident(table)}
      BEGIN
        INSERT OR REPLACE INTO "FailoverJournal" (tbl, rowId, op, seq)
        VALUES (${t}, NEW."id", 'insert', ${nextSeq});
      END
    `);

    // A row the backup created stays "insert" however often it is edited
    // afterwards; a copied row that is edited becomes "update".
    db.run(`
      CREATE TRIGGER IF NOT EXISTS ${name("upd")} AFTER UPDATE ON ${ident(table)}
      BEGIN
        INSERT OR REPLACE INTO "FailoverJournal" (tbl, rowId, op, seq)
        VALUES (
          ${t},
          NEW."id",
          COALESCE((SELECT op FROM "FailoverJournal" WHERE tbl = ${t} AND rowId = NEW."id" AND op != 'delete'), 'update'),
          ${nextSeq}
        );
      END
    `);

    db.run(`
      CREATE TRIGGER IF NOT EXISTS ${name("del")} AFTER DELETE ON ${ident(table)}
      BEGIN
        INSERT OR REPLACE INTO "FailoverJournal" (tbl, rowId, op, seq)
        VALUES (${t}, OLD."id", 'delete', ${nextSeq});
      END
    `);
  }
}

export function dropJournalTriggers(db: Database): void {
  const triggers = db
    .query(`SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE ?`)
    .all(`${TRIGGER_PREFIX}%`) as { name: string }[];
  for (const { name } of triggers) db.run(`DROP TRIGGER IF EXISTS ${ident(name)}`);
}

/** Oldest changes first. */
export function readJournal(db: Database, limit: number): JournalEntry[] {
  return db
    .query(`SELECT tbl, rowId, op, seq FROM "FailoverJournal" ORDER BY seq LIMIT ?`)
    .all(limit) as JournalEntry[];
}
