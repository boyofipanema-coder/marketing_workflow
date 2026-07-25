/// <reference types="@cloudflare/workers-types" />

// Extend the CloudflareEnv interface (from @opennextjs/cloudflare) to include
// the D1 database binding declared in wrangler.toml.
declare interface CloudflareEnv {
  DB: D1Database;
}
