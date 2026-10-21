/**
 * Direct SQLite access for the backup-computer feature.
 *
 * Copying a whole database between two machines, and merging rows back, is
 * table-by-table work that Prisma has no API for, so it is done with
 * bun:sqlite — but ONLY ever in a separate process (sqlite-worker.ts, started
 * by worker-client.ts), never inside the server.
 *
 * Why: the server already has the file open through Prisma's own copy of
 * SQLite. Two copies of SQLite in one process do not see each other's file
 * locks, so when the second one closes the file it believes it was the last
 * user, folds the WAL into the database and deletes it — and every write
 * Prisma makes after that goes into a deleted file and is silently lost. This
 * happened in testing. Separate processes lock properly, which is also why the
 * nightly backup (desktop/backup-database.ts) runs as its own process.
 *
 * Everything here works from the schema SQLite reports at run time rather than
 * a hard-coded table list, so a new model in schema.prisma is copied and
 * handed back without anyone remembering to add it here.
 */
import { Database } from "bun:sqlite";
import { join, resolve } from "node:path";
import { env } from "../../env";

/** Tables that are never copied or handed back. */
const INTERNAL_TABLES = new Set(["_prisma_migrations", "FailoverJournal"]);

/** The file Prisma uses. Relative paths resolve against prisma/, as Prisma does. */
export function databaseFile(): string {
  const url = env.DATABASE_URL;
  if (!url.startsWith("file:")) {
    throw new Error(`DATABASE_URL is not a SQLite file URL: ${url}`);
  }
  const raw = url.slice("file:".length).split("?")[0]!;
  return resolve(join(process.cwd(), "prisma"), raw);
}

/** Set by worker-client.ts for the child process, and nowhere else. */
export const WORKER_ENV_FLAG = "ARRIVEALIVE_SQLITE_WORKER";

export function openDatabase(options: { readonly?: boolean } = {}): Database {
  if (process.env[WORKER_ENV_FLAG] !== "1") {
    throw new Error("Direct SQLite access must run in sqlite-worker.ts, not in the server. See the note at the top of sqlite.ts.");
  }
  const db = options.readonly
    ? new Database(databaseFile(), { readonly: true })
    : new Database(databaseFile());
  // The server writes to the same file. Wait for it rather than failing.
  db.run("PRAGMA busy_timeout = 15000");
  return db;
}

/** Quote an identifier for SQL ("Table", "column"). */
export function ident(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** Quote a string literal for SQL that cannot take bound parameters (trigger bodies). */
export function literal(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** App tables in `schema` ("main" or an attached database). */
export function dataTables(db: Database, schema = "main"): string[] {
  const rows = db
    .query(
      `SELECT name FROM ${ident(schema)}.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
    )
    .all() as { name: string }[];
  return rows.map((r) => r.name).filter((name) => !INTERNAL_TABLES.has(name));
}

export interface ColumnInfo {
  name: string;
  /** Declared type: "TEXT", "INTEGER", "DATETIME", "REAL", "BOOLEAN"... */
  type: string;
}

export function tableColumns(db: Database, table: string, schema = "main"): ColumnInfo[] {
  const rows = db.query(`PRAGMA ${ident(schema)}.table_info(${ident(table)})`).all() as {
    name: string;
    type: string;
  }[];
  return rows.map((r) => ({ name: r.name, type: (r.type || "").toUpperCase() }));
}

/** Columns whose values are strings, i.e. the only ones that can hold a URL. */
export function isTextColumn(column: ColumnInfo): boolean {
  return column.type.includes("TEXT") || column.type.includes("CHAR") || column.type.includes("CLOB");
}

export interface ForeignKey {
  /** Column in this table */
  from: string;
  /** Table it points at */
  table: string;
  /** Column in that table (always "id" for Prisma relations here) */
  to: string;
}

export function foreignKeys(db: Database, table: string): ForeignKey[] {
  const rows = db.query(`PRAGMA foreign_key_list(${ident(table)})`).all() as {
    from: string;
    table: string;
    to: string | null;
  }[];
  return rows.map((r) => ({ from: r.from, table: r.table, to: r.to ?? "id" }));
}

/** Each UNIQUE constraint other than the primary key, as its column list. */
export function uniqueColumnSets(db: Database, table: string): string[][] {
  const indexes = db.query(`PRAGMA index_list(${ident(table)})`).all() as {
    name: string;
    unique: number;
    origin: string;
  }[];
  return indexes
    .filter((ix) => ix.unique === 1 && ix.origin !== "pk")
    .map((ix) =>
      (db.query(`PRAGMA index_info(${ident(ix.name)})`).all() as { name: string }[]).map(
        (c) => c.name
      )
    )
    .filter((cols) => cols.length > 0);
}

/**
 * Tables ordered so every table comes after the tables it references:
 * Team before Event before SurveyResponse. Inserting in this order means a
 * child row never arrives before its parent.
 */
export function parentFirstOrder(db: Database, tables: string[]): string[] {
  const present = new Set(tables);
  const parents = new Map(
    tables.map((t) => [
      t,
      new Set(
        foreignKeys(db, t)
          .map((fk) => fk.table)
          .filter((p) => p !== t && present.has(p))
      ),
    ])
  );

  const ordered: string[] = [];
  const placed = new Set<string>();
  while (ordered.length < tables.length) {
    const ready = tables
      .filter((t) => !placed.has(t) && [...parents.get(t)!].every((p) => placed.has(p)))
      .sort();
    if (ready.length === 0) {
      // A reference cycle. None exist today; don't loop forever if one appears.
      for (const t of tables) if (!placed.has(t)) ordered.push(t), placed.add(t);
      break;
    }
    for (const t of ready) ordered.push(t), placed.add(t);
  }
  return ordered;
}

/** Swap one server address for another inside every string value of a row. */
export function rewriteOrigin<T extends Record<string, unknown>>(
  row: T,
  from: string,
  to: string
): T {
  if (!from || from === to) return row;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = typeof value === "string" ? value.split(from).join(to) : value;
  }
  return out as T;
}

/** "https://x.ts.net/" -> "https://x.ts.net" */
export function trimOrigin(url: string): string {
  return url.trim().replace(/\/+$/, "");
}
