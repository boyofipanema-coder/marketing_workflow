import { GOOGLE_CALENDAR_ICS_URL } from "@/server/services/google-calendar";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

type EdgeCacheStorage = CacheStorage & { readonly default?: Cache };

const RESPONSE_HEADERS = {
  "Cache-Control": "public, max-age=120, s-maxage=120, stale-while-revalidate=600",
  "Content-Type": "text/calendar; charset=utf-8",
};

export async function GET(request: Request) {
  try {
    const edgeCache = (globalThis.caches as EdgeCacheStorage | undefined)?.default;
    const cacheKey = new Request(
      new URL("/__calendar-cache/team-calendar-v2.ics", request.url),
    );
    const cached = await edgeCache?.match(cacheKey);
    if (cached) return cached;

    const response = await fetch(GOOGLE_CALENDAR_ICS_URL, {
      headers: { Accept: "text/calendar" },
    });
    if (!response.ok || !response.body) {
      return Response.json(
        { error: "Google Calendar를 불러오지 못했습니다." },
        { status: 502 },
      );
    }

    const calendarResponse = new Response(response.body, { headers: RESPONSE_HEADERS });
    if (edgeCache) {
      const cacheWrite = edgeCache.put(cacheKey, calendarResponse.clone());
      try {
        getCloudflareContext().ctx.waitUntil(cacheWrite);
      } catch {
        await cacheWrite;
      }
    }
    return calendarResponse;
  } catch {
    return Response.json(
      { error: "Google Calendar를 불러오지 못했습니다." },
      { status: 502 },
    );
  }
}
