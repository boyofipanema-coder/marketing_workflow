"use server";

import { revalidatePath } from "next/cache";
import {
  createWorkstream,
  editWorkstream,
  reorderWorkstreams,
  type WorkstreamPatch,
} from "@/server/services/workstream";
import { getCurrentMember } from "@/server/data/queries";
import { runAction, type ActionResult } from "./result";
import type { Workstream } from "@/server/db/schema";

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function createWorkstreamAction(
  projectId: string,
  name: string
): Promise<ActionResult<Workstream>> {
  const result = await runAction("createWorkstreamAction", async () => {
    const { member, db } = await getCurrentMember();
    return createWorkstream(db, {
      projectId,
      workspaceId: member.workspace_id,
      name,
    });
  });
  if (result.success) revalidateAll();
  return result;
}

export async function editWorkstreamAction(
  workstreamId: string,
  patch: WorkstreamPatch
): Promise<ActionResult<Workstream>> {
  const result = await runAction("editWorkstreamAction", async () => {
    const { member, db } = await getCurrentMember();
    return editWorkstream(db, workstreamId, member.workspace_id, patch);
  });
  if (result.success) revalidateAll();
  return result;
}

export async function reorderWorkstreamsAction(
  projectId: string,
  orderedIds: string[]
): Promise<ActionResult<undefined>> {
  const result = await runAction("reorderWorkstreamsAction", async () => {
    const { member, db } = await getCurrentMember();
    await reorderWorkstreams(db, projectId, member.workspace_id, orderedIds);
    return undefined;
  });
  if (result.success) revalidateAll();
  return result;
}
