import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/server/db/client";
import { member as memberTable } from "@/server/db/schema";
import { ownerColor } from "@/lib/colors";
import { selectMemberAction } from "@/app/actions/identity";

/** Member choice follows the shared password gate and controls task attribution. */
export default async function SelectMemberPage() {
  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.DB);
  const members = await db.select().from(memberTable);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="flex flex-wrap items-center justify-center gap-8">
        {members.map((m) => (
          <form key={m.id} action={selectMemberAction.bind(null, m.id)}>
            <button
              type="submit"
              className="group rounded-full focus-visible:outline-none"
            >
              <span
                className="grid size-24 place-items-center rounded-full text-xl font-bold tracking-tight text-white shadow-sm transition-[transform,box-shadow] group-hover:scale-[1.04] group-hover:shadow-md group-active:scale-[0.97] group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-bg"
                style={{ background: ownerColor(m.id) }}
              >
                {m.name}
              </span>
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
