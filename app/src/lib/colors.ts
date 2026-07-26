/** Shared owner-color palette — one consistent color per person, wherever an avatar shows up. */
export const OWNER_COLORS = ["#0a84ff", "#af52de", "#30b0c7", "#ff9500", "#34c759", "#ff375f"];

export function ownerColor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return OWNER_COLORS[h % OWNER_COLORS.length]!;
}

export function initials(name?: string): string {
  return (name ?? "").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}
