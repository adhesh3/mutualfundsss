import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const log = process.env.NODE_ENV === "development" ? (["error", "warn"] as const) : (["error"] as const);

/**
 * Local dev defaults to the SQLite file in DATABASE_URL. When TURSO_DATABASE_URL
 * is set (e.g. on a serverless host where the filesystem is ephemeral), use the
 * libSQL driver adapter against Turso so data actually persists across deploys.
 */
function createPrismaClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  if (tursoUrl) {
    const adapter = new PrismaLibSQL({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN });
    return new PrismaClient({ adapter, log: [...log] });
  }
  return new PrismaClient({ log: [...log] });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
