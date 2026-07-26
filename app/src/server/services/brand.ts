import { and, eq } from "drizzle-orm";
import {
  brand,
  type Brand,
  type NewBrand,
} from "@/server/db/schema";
import { type Database } from "@/server/db/client";
import { ValidationError } from "./errors";

const BRAND_COLORS = [
  "#0a84ff",
  "#af52de",
  "#ff9500",
  "#30b0c7",
  "#34c759",
  "#ff375f",
] as const;

function validateName(raw: string): string {
  const name = raw.trim();
  if (!name) throw new ValidationError("브랜드명을 입력해 주세요.");
  if (name.length > 120)
    throw new ValidationError("브랜드명은 120자 이하로 입력해 주세요.");
  return name;
}

function validateColor(raw?: string | null): string {
  if (!raw) return BRAND_COLORS[0];
  if (!/^#[0-9a-f]{6}$/i.test(raw))
    throw new ValidationError("브랜드 색상 형식이 올바르지 않습니다.");
  return raw.toLowerCase();
}

export async function createBrand(
  db: Database,
  params: { workspaceId: string; name: string; color?: string | null }
): Promise<Brand> {
  const name = validateName(params.name);
  const duplicate = await db
    .select({ id: brand.id })
    .from(brand)
    .where(
      and(
        eq(brand.workspace_id, params.workspaceId),
        eq(brand.name, name)
      )
    )
    .limit(1);
  if (duplicate.length > 0)
    throw new ValidationError("같은 이름의 브랜드가 이미 있습니다.");

  const now = new Date().toISOString();
  const row: NewBrand = {
    id: crypto.randomUUID(),
    workspace_id: params.workspaceId,
    name,
    color: validateColor(params.color),
    sort_order: 999,
    archived_at: null,
    created_at: now,
    updated_at: now,
  };
  await db.insert(brand).values(row);
  return row as Brand;
}
