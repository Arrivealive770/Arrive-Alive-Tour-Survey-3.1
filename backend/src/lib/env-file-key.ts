import fs from "node:fs";
import path from "node:path";

/**
 * Where the email key on disk differs from the email key in memory.
 *
 * The admin portal used to label the running server's key "Key in the settings
 * file". Those are the same thing right up until the moment they are not, and
 * the moment they are not is precisely when someone is staring at a rejected
 * key wondering why editing the file changed nothing. Three real causes:
 *
 *   1. The server was never restarted, so it still holds the old key.
 *   2. Notepad saved `.env.txt`, so the edit went to a file nothing reads.
 *   3. A machine-level RESEND_API_KEY exists, and a real environment variable
 *      beats a `.env` entry in Bun, permanently and silently.
 *
 * All three look identical from the outside: "I put the right key in and it
 * still says unauthorized." Reading the file back and comparing settles it.
 */
export interface EnvFileKeyReport {
  /** The file that was read, so the portal can name it. */
  path: string;
  exists: boolean;
  /** Opening characters of the key found in the file, never the whole key. */
  keyPreview: string | null;
  keyLength: number;
  /** True when the file's key is the one the running server is using. */
  matchesActive: boolean;
  /** How many times the key is assigned. More than one means one of them loses. */
  occurrences: number;
  /** Quote or space characters left inside the value when it was pasted. */
  hasStrayQuotes: boolean;
  /**
   * Other files whose names begin with `.env`. `.env.txt` is what Notepad
   * writes when "Save as type" is left on "Text Documents".
   */
  strayFiles: string[];
  /** When the file was last saved, and when this server process began. */
  modifiedAt: string | null;
  serverStartedAt: string;
  /** True when the file was saved after the server started: a restart is due. */
  editedSinceStart: boolean;
}

/** Matches `KEY=value`, tolerating leading whitespace and a `export ` prefix. */
function assignmentPattern(name: string): RegExp {
  return new RegExp("^\\s*(?:export\\s+)?" + name + "\\s*=(.*)$");
}

/** Strip one layer of matching surrounding quotes, the way dotenv does. */
function unquote(raw: string): string {
  const value = raw.trim();
  const quoted =
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"));
  return quoted && value.length >= 2 ? value.slice(1, -1) : value;
}

/**
 * Candidate locations for backend/.env.
 *
 * Resolved from this file's own location first, because the working directory
 * depends on how the server was launched and the kiosk launches it from a
 * scheduled task.
 */
function candidatePaths(): [string, ...string[]] {
  const fromSource = path.resolve(import.meta.dir, "..", "..", ".env");
  const fromCwd = path.resolve(process.cwd(), ".env");
  return fromSource === fromCwd ? [fromSource] : [fromSource, fromCwd];
}

/**
 * Read the email key back off disk and compare it with the one in use.
 *
 * `activeKey` is the key the running server holds. It is compared, never
 * returned — only a preview of the file's copy leaves this function.
 */
export function readEnvFileKey(
  variableName: string,
  activeKey: string | undefined,
  previewChars: number
): EnvFileKeyReport {
  const serverStartedAt = new Date(Date.now() - process.uptime() * 1000);

  const report: EnvFileKeyReport = {
    path: candidatePaths()[0],
    exists: false,
    keyPreview: null,
    keyLength: 0,
    matchesActive: false,
    occurrences: 0,
    hasStrayQuotes: false,
    strayFiles: [],
    modifiedAt: null,
    serverStartedAt: serverStartedAt.toISOString(),
    editedSinceStart: false,
  };

  const envPath = candidatePaths().find((candidate) => fs.existsSync(candidate));
  if (!envPath) {
    // No file at all still tells us something useful: list what IS there, so
    // ".env.txt" shows up instead of a bare "missing".
    report.strayFiles = listStrayEnvFiles(path.dirname(report.path));
    return report;
  }

  report.path = envPath;
  report.exists = true;
  report.strayFiles = listStrayEnvFiles(path.dirname(envPath));

  try {
    const stat = fs.statSync(envPath);
    report.modifiedAt = stat.mtime.toISOString();
    report.editedSinceStart = stat.mtime.getTime() > serverStartedAt.getTime();
  } catch {
    // A stat failure is not worth failing the whole status page over.
  }

  let contents: string;
  try {
    contents = fs.readFileSync(envPath, "utf8");
  } catch {
    return report;
  }

  // Notepad writes a byte order mark by default. It attaches to the FIRST
  // line, so a key on line one arrives with three invisible characters glued
  // to its front and is rejected as unauthorized.
  const lines = contents.replace(/^﻿/, "").split(/\r?\n/);
  const pattern = assignmentPattern(variableName);

  let found: string | null = null;
  for (const line of lines) {
    if (line.trim().startsWith("#")) continue;
    const match = line.match(pattern);
    if (!match) continue;
    report.occurrences += 1;
    // Last assignment wins, matching Bun's own precedence.
    found = unquote(match[1] ?? "");
  }

  if (found === null) {
    return report;
  }

  const trimmed = found.trim();
  report.keyLength = trimmed.length;
  report.keyPreview = trimmed ? trimmed.slice(0, previewChars) : null;
  report.hasStrayQuotes = /["'\s]/.test(trimmed);
  report.matchesActive = Boolean(activeKey) && trimmed === activeKey;

  return report;
}

/** Names beginning with `.env` other than `.env` itself. */
function listStrayEnvFiles(directory: string): string[] {
  try {
    return fs
      .readdirSync(directory)
      .filter((name) => name.startsWith(".env") && name !== ".env")
      .sort();
  } catch {
    return [];
  }
}
