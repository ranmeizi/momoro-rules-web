import { PrismaClient as BoboanPrismaClient } from "@/generated/boboan-client";
import { normalizeMysqlUrl } from "./mysql-url";

const globalForBoboan = globalThis as unknown as {
  boboan: BoboanPrismaClient;
};

function getBoboanUrl(): string {
  const url = process.env.BOBOAN_NET_DB_URL;
  if (!url) throw new Error("BOBOAN_NET_DB_URL is not configured");
  return normalizeMysqlUrl(url);
}

export const boboan =
  globalForBoboan.boboan ??
  new BoboanPrismaClient({
    datasources: { db: { url: getBoboanUrl() } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForBoboan.boboan = boboan;
