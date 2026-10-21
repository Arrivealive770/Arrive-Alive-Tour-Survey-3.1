/**
 * Runs one direct-SQLite job in its own process, then exits.
 *
 *   bun src/lib/failover/sqlite-worker.ts <task> <input.json> <output.json>
 *
 * Started by worker-client.ts; never run by hand. A separate process because
 * the server's own Prisma connection and a bun:sqlite connection must not
 * share a process — see the note at the top of sqlite.ts.
 *
 * Input and output go through files rather than stdout, because loading the
 * settings prints to stdout and a snapshot hand-back can be megabytes.
 */
import { writeFileSync, readFileSync } from "node:fs";
import { applyHandback, collectHandback, type HandbackChange } from "./handback";
import { dropJournalTriggers, ensureJournalTriggers } from "./journal";
import { applySnapshot, createSnapshot } from "./mirror";
import { openDatabase } from "./sqlite";

type Input = Record<string, unknown>;

const tasks: Record<string, (input: Input) => unknown> = {
  /** Main: consistent copy of the database into input.target. */
  snapshot: (input) => createSnapshot(String(input.target)),

  /** Backup: replace every table with the snapshot's contents. */
  "apply-snapshot": (input) =>
    applySnapshot(String(input.file), String(input.fromOrigin), String(input.toOrigin)),

  /** Backup: start or stop journaling changes. */
  "journal-on": () => {
    const db = openDatabase();
    try {
      ensureJournalTriggers(db);
    } finally {
      db.close();
    }
    return true;
  },
  "journal-off": () => {
    const db = openDatabase();
    try {
      dropJournalTriggers(db);
    } finally {
      db.close();
    }
    return true;
  },

  /** Backup: the next batch of changes to hand back. */
  "collect-handback": (input) =>
    collectHandback(Number(input.limit), String(input.fromOrigin), String(input.toOrigin)),

  /** Main: merge changes from the backup. */
  "apply-handback": (input) => applyHandback(input.changes as HandbackChange[]),
};

const [task, inputFile, outputFile] = process.argv.slice(2);

function finish(payload: { ok: boolean; result?: unknown; error?: string }, code: number): never {
  if (outputFile) writeFileSync(outputFile, JSON.stringify(payload));
  process.exit(code);
}

try {
  const run = task ? tasks[task] : undefined;
  if (!run) finish({ ok: false, error: `Unknown task "${task}"` }, 2);
  const input = inputFile ? (JSON.parse(readFileSync(inputFile, "utf8")) as Input) : {};
  finish({ ok: true, result: run!(input) }, 0);
} catch (err) {
  finish({ ok: false, error: err instanceof Error ? err.message : String(err) }, 1);
}
