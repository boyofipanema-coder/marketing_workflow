import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/server/db/client";
import { getWorkspaceMembers } from "@/server/data/queries";
import { workspace } from "@/server/db/schema";
import LoginForm from "./LoginForm";

/**
 * Entry screen: one shared password, then pick who you are. The member list is
 * public on this page by design — the password is the gate, and you cannot
 * choose yourself without it.
 */
export default async function LoginPage() {
  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.DB);
  const [ws] = await db.select().from(workspace).limit(1);
  const members = ws ? await getWorkspaceMembers(db, ws.id) : [];

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-xl border border-separator bg-surface p-8 shadow-sm">
        <h1 className="mb-6 text-center font-serif text-2xl font-semibold text-text">
          마케팅 워크플로
        </h1>
        <LoginForm members={members} />
      </div>
    </div>
  );
}
