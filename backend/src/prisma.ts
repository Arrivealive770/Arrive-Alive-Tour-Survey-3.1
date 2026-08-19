import { PrismaClient } from "@prisma/client";
import { env } from "./env";

// Pass the URL explicitly so env.ts stays the single source of truth. Left to
// itself the client reads process.env.DATABASE_URL and knows nothing about the
// development default in env.ts, so a checkout with no backend/.env started
// fine and then threw on the first query.
const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL });

// IMPORTANT: SQLite optimizations for better performance
async function initSqlitePragmas(prisma: PrismaClient) {
  await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
  await prisma.$queryRawUnsafe("PRAGMA foreign_keys = ON;");
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 10000;");
  await prisma.$queryRawUnsafe("PRAGMA synchronous = NORMAL;");
}

initSqlitePragmas(prisma);

export { prisma };
