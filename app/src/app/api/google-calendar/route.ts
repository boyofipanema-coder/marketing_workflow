import { GOOGLE_CALENDAR_ICS_URL } from "@/server/services/google-calendar";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await fetch(GOOGLE_CALENDAR_ICS_URL, {
      headers: { Accept: "text/calendar" },
      next: { revalidate: 120 },
    });
    if (!response.ok || !response.body) {
      return Response.json(
        { error: "Google Calendar를 불러오지 못했습니다." },
        { status: 502 },
      );
    }

    return new Response(response.body, {
      headers: {
        "Cache-Control": "public, max-age=120, s-maxage=120, stale-while-revalidate=300",
        "Content-Type": "text/calendar; charset=utf-8",
      },
    });
  } catch {
    return Response.json(
      { error: "Google Calendar를 불러오지 못했습니다." },
      { status: 502 },
    );
  }
}
