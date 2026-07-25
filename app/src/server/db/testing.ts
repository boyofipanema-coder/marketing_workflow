/**
 * Test-only helper: builds an in-memory SQLite database by applying the real
 * Drizzle migration files in journal order.
 *
 * Running the actual migrations (rather than a hand-copied DDL block) keeps the
 * test schema in lockstep with production and puts each new migration under
 * test the moment it is added.
 *
 * Not imported by any runtime code — vitest only.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const MIGRATIONS_DIR = join(process.cwd(), "drizzle", "migrations");

interface JournalEntry {
  idx: number;
  tag: string;
}

function migrationSql(): string[] {
  const journal = JSON.parse(
    readFileSync(join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8"),
  ) as { entries: JournalEntry[] };

  return [...journal.entries]
    .sort((a, b) => a.idx - b.idx)
    .map((entry) => readFileSync(join(MIGRATIONS_DIR, `${entry.tag}.sql`), "utf8"));
}

export type TestDb = ReturnType<typeof makeTestDb>;

/**
 * Creates a fresh in-memory DB with every migration applied.
 *
 * Foreign keys stay off so fixtures can be inserted in any order, matching how
 * the existing suite seeds data.
 */
export function makeTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.exec("PRAGMA foreign_keys = OFF;");

  for (const sql of migrationSql()) {
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) sqlite.exec(trimmed);
    }
  }

  const db = drizzle(sqlite, { schema });

  // Polyfill db.batch, which is a D1-only API. Statements run sequentially
  // rather than atomically — enough to exercise the service layer's call shape.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (db as any).batch = async (stmts: any[]) => {
    const results = [];
    for (const stmt of stmts) results.push(await stmt);
    return results;
  };

  return db;
}
