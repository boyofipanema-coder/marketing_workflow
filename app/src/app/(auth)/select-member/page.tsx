import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/server/db/client";
import { member as memberTable } from "@/server/db/schema";
import { ownerColor, initials } from "@/lib/colors";
import { selectMemberAction } from "@/app/actions/identity";

export const dynamic = "force-dynamic";

/**
 * Entry screen — pick who you are. No password: this is a small, known team
 * sharing one workspace, not a public login. See server/auth/active-member.ts.
 */
export default async function SelectMemberPage() {
  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.DB);
  const members = await db.select().from(memberTable);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-bg px-4">
      <h1 className="text-xl font-semibold text-text">누구신가요?</h1>
      <div className="flex flex-wrap items-center justify-center gap-8">
        {members.map((m) => (
          <form key={m.id} action={selectMemberAction.bind(null, m.id)}>
            <button
              type="submit"
              className="group flex flex-col items-center gap-2.5 focus-visible:outline-none"
            >
              <span
                className="grid size-20 place-items-center rounded-full text-2xl font-bold text-white shadow-sm transition-transform group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-bg"
                style={{ background: ownerColor(m.id) }}
              >
                {initials(m.name)}
              </span>
              <span className="text-sm font-medium text-text">{m.name}</span>
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
