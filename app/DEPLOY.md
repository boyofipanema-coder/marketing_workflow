# Deploy Runbook

This document describes how to deploy the Marketing Team Workflow app to Cloudflare Workers + D1.

## Local Development

### 1. Run the migration

```bash
npm run db:migrate
```

This applies the Drizzle migration to the local `.wrangler/state/v3/d1` SQLite database.

### 2. Seed the database

```bash
npm run db:seed
```

Generates INSERT statements from the AURALEE workspace seed data and applies them to the local D1 instance. Safe to re-run (all inserts use `ON CONFLICT DO NOTHING`).

### 3. Create a login account

The seed creates workspace members but no login credentials. Create an auth account for the admin member:

```bash
# Generate SQL for jisoo@auralee.co with the given password
npx tsx scripts/create-account.ts jisoo@auralee.co <YOUR_PASSWORD> "Jisoo Yoon" ws_auralee_01 admin \
  > /tmp/admin_auth.sql

# The script creates a new member, but the seed already has m_admin_01.
# Edit the SQL to set member_id = 'm_admin_01' and remove the workspace/member inserts.
# Or use the helper approach below:
node -e "
const { pbkdf2Sync, randomBytes } = require('crypto');
const password = process.argv[1];
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, 100000, 32, 'sha256');
const credHash = salt.toString('base64') + ':' + hash.toString('base64');
const sql = \`INSERT INTO auth_account (id, member_id, email, credential_hash, created_at)
  VALUES ('auth_jisoo_01', 'm_admin_01', 'jisoo@auralee.co', '\${credHash}', '\${new Date().toISOString()}')
  ON CONFLICT (id) DO NOTHING;\`;
require('fs').writeFileSync('/tmp/create_admin_auth.sql', sql);
" -- <YOUR_PASSWORD>
wrangler d1 execute DB --local --file=/tmp/create_admin_auth.sql
```

You can now log in at `http://localhost:3000/login` with `jisoo@auralee.co` and the password you set.

### 4. Start the development server

```bash
npm run dev
```

---

## Production Deployment to Cloudflare

### Prerequisites

- A Cloudflare account with Workers + D1 access
- `wrangler` CLI authenticated: `wrangler login`

### Step 1: Create the remote D1 database

```bash
wrangler d1 create marketing-team-workflow-db
```

Note the output — it gives you a `database_id`. Copy it.

### Step 2: Update wrangler.toml

Open `wrangler.toml` and replace the placeholder `database_id`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "marketing-team-workflow-db"
database_id = "<YOUR_DATABASE_ID_FROM_STEP_1>"
migrations_dir = "drizzle/migrations"
```

### Step 3: Apply the migration to the remote D1

```bash
wrangler d1 migrations apply DB --remote
```

### Step 4: Seed the remote D1

```bash
npx tsx scripts/seed-db.ts > /tmp/seed.sql
wrangler d1 execute DB --remote --file=/tmp/seed.sql
```

### Step 5: Create the admin login account on remote D1

```bash
node -e "
const { pbkdf2Sync, randomBytes } = require('crypto');
const password = process.argv[1];
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, 100000, 32, 'sha256');
const credHash = salt.toString('base64') + ':' + hash.toString('base64');
const sql = \`INSERT INTO auth_account (id, member_id, email, credential_hash, created_at)
  VALUES ('auth_jisoo_01', 'm_admin_01', 'jisoo@auralee.co', '\${credHash}', '\${new Date().toISOString()}')
  ON CONFLICT (id) DO NOTHING;\`;
require('fs').writeFileSync('/tmp/create_admin_auth.sql', sql);
" -- <YOUR_ADMIN_PASSWORD>
wrangler d1 execute DB --remote --file=/tmp/create_admin_auth.sql
```

The seeded admin account is `jisoo@auralee.co`. Use the password you set above to log in.

### Step 6: Build and deploy

```bash
npm run build
npm run deploy
```

`npm run deploy` runs `wrangler deploy`, which packages the OpenNext build output and deploys to Cloudflare Workers.

---

## Blocker (current state)

**`wrangler whoami` returns "You are not authenticated."**

The current environment does not have Cloudflare credentials (`CLOUDFLARE_API_TOKEN` is not set and `wrangler login` has not been run). As a result, steps 1–6 above could not be executed in this session.

**What was completed locally:**
- Migration applied to local D1: `npm run db:migrate` succeeded
- Seed data applied: `npm run db:seed` — 46 statements executed
- Local admin account created: `jisoo@auralee.co` / `secret123`
- Build succeeds: `npm run build` — all pages compile cleanly
- All 110 tests pass: `npm test`
- TypeScript is clean: `npm run typecheck`

**To deploy:** authenticate with `wrangler login`, then follow steps 1–6 above.
