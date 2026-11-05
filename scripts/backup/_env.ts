import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/** Load .env (and .env.local if present) before Prisma is instantiated. */
export function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    const p = resolve(process.cwd(), f);
    if (existsSync(p)) config({ path: p, override: false });
  }
}

export function dbHost(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? "").host || "(unknown)";
  } catch {
    return "(unknown)";
  }
}
