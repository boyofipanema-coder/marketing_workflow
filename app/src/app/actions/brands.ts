"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMember } from "@/server/data/queries";
import { createBrand } from "@/server/services/brand";
import { runAction, type ActionResult } from "./result";
import type { Brand } from "@/server/db/schema";

export async function createBrandAction(input: {
  name: string;
  color?: string | null;
}): Promise<ActionResult<Brand>> {
  const result = await runAction("createBrandAction", async () => {
    const { member, db } = await getCurrentMember();
    return createBrand(db, {
      workspaceId: member.workspace_id,
      ...input,
    });
  });
  if (result.success) revalidatePath("/", "layout");
  return result;
}
