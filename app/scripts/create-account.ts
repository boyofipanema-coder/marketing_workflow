#!/usr/bin/env node
/**
 * Admin account creation script.
 *
 * Generates hashed credentials and outputs SQL INSERT statements that
 * create a workspace member + auth_account in D1.
 *
 * Usage:
 *   npx tsx scripts/create-account.ts <email> <password> <name> [workspace_id] [role]
 *
 * Then execute the output against D1:
 *   # Local dev:
 *   npx tsx scripts/create-account.ts admin@acme.com s3cret "Alice Admin" | \
 *     wrangler d1 execute DB --local --file=-
 *
 *   # Production:
 *   npx tsx scripts/create-account.ts admin@acme.com s3cret "Alice Admin" | \
 *     wrangler d1 execute DB --file=-
 *
 * Notes:
 *   - workspace_id defaults to "default-workspace". Pass an explicit ID if the
 *     workspace row already exists and you want to link the member to it.
 *   - role defaults to "admin". Pass "member" for a non-admin account.
 *   - This script uses Node.js's built-in crypto module (PBKDF2/SHA-256) with
 *     the same parameters as the Workers-runtime implementation so hashes are
 *     interchangeable.
 */

import { pbkdf2Sync, randomBytes } from "node:crypto";
import { randomUUID } from "node:crypto";

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_LENGTH = 32;
const PBKDF2_SALT_LENGTH = 16;

function hashPasswordSync(password: string): string {
  const salt = randomBytes(PBKDF2_SALT_LENGTH);
  const hash = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, "sha256");
  const saltB64 = salt.toString("base64");
  const hashB64 = hash.toString("base64");
  return `${saltB64}:${hashB64}`;
}

function now(): string {
  return new Date().toISOString();
}

function escSql(s: string): string {
  return s.replace(/'/g, "''");
}

const [, , emailArg, passwordArg, nameArg, workspaceIdArg, roleArg] = process.argv;

if (!emailArg || !passwordArg || !nameArg) {
  console.error(
    "Usage: npx tsx scripts/create-account.ts <email> <password> <name> [workspace_id] [role]"
  );
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();
const password = passwordArg;
const name = nameArg.trim();
const workspaceId = (workspaceIdArg ?? "default-workspace").trim();
const role = (roleArg ?? "admin") === "member" ? "member" : "admin";

const memberId = randomUUID();
const accountId = randomUUID();
const credentialHash = hashPasswordSync(password);
const createdAt = now();

const sql = `
-- Created by scripts/create-account.ts on ${createdAt}
-- Workspace (skipped if it already exists — adjust or remove if needed):
INSERT INTO workspace (id, name, timezone, created_at)
  VALUES ('${escSql(workspaceId)}', 'Default Workspace', 'UTC', '${createdAt}')
  ON CONFLICT (id) DO NOTHING;

-- Member:
INSERT INTO member (id, workspace_id, name, email, role)
  VALUES (
    '${escSql(memberId)}',
    '${escSql(workspaceId)}',
    '${escSql(name)}',
    '${escSql(email)}',
    '${role}'
  );

-- Auth account (credential):
INSERT INTO auth_account (id, member_id, email, credential_hash, created_at)
  VALUES (
    '${escSql(accountId)}',
    '${escSql(memberId)}',
    '${escSql(email)}',
    '${escSql(credentialHash)}',
    '${createdAt}'
  );
`.trim();

console.log(sql);
console.error(`\n[create-account] Done.`);
console.error(`  member_id : ${memberId}`);
console.error(`  email     : ${email}`);
console.error(`  role      : ${role}`);
console.error(`  workspace : ${workspaceId}`);
console.error(`\nPipe this output to wrangler d1 execute to apply.`);
