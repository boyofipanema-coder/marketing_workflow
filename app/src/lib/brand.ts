/** Fixed, closed list — not user-manageable, so a plain enum, not a table. */
export const BRANDS = [
  "BEAKER 공통",
  "BEAKER 바잉",
  "BEAKER OG",
  "Maison Kitsune",
  "GANNI",
  "Studio Nicholson",
  "Kaptain Sunshine",
  "Margaret Howell",
  "Auralee",
  "공통",
] as const;

export type Brand = (typeof BRANDS)[number];
