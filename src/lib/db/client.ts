import { PrismaClient } from "@prisma/client";
import { normalizeMysqlUrl } from "./mysql-url";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function getDatasourceUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  return normalizeMysqlUrl(url);
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: getDatasourceUrl() } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
