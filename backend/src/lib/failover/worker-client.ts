/**
 * Run a job in sqlite-worker.ts and wait for its answer. This is the only way
 * the server touches the database outside Prisma — see the note in sqlite.ts.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { removeQuietly, scratchFile } from "./mirror";
import { WORKER_ENV_FLAG } from "./sqlite";

const WORKER = join(import.meta.dir, "sqlite-worker.ts");

export async function runSqliteTask<T>(
  task: string,
  input: Record<string, unknown> = {},
  timeoutMs = 5 * 60_000
): Promise<T> {
  const inputFile = scratchFile(`${task}-in`, ".json");
  const outputFile = scratchFile(`${task}-out`, ".json");
  writeFileSync(inputFile, JSON.stringify(input));

  try {
    const proc = Bun.spawn([process.execPath, WORKER, task, inputFile, outputFile], {
      cwd: process.cwd(),
      env: { ...process.env, [WORKER_ENV_FLAG]: "1" },
      stdout: "ignore",
      stderr: "pipe",
    });
    const timer = setTimeout(() => proc.kill(), timeoutMs);
    const [exitCode, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
    clearTimeout(timer);

    let output: { ok: boolean; result?: T; error?: string } | null = null;
    try {
      output = JSON.parse(readFileSync(outputFile, "utf8"));
    } catch {
      output = null;
    }
    if (output?.ok) return output.result as T;
    throw new Error(
      output?.error ?? `Database task "${task}" failed (exit ${exitCode}). ${stderr.trim().slice(-500)}`
    );
  } finally {
    removeQuietly(inputFile);
    removeQuietly(outputFile);
  }
}
