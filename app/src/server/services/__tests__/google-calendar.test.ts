import { describe, expect, it } from "vitest";
import { parseGoogleCalendarIcs } from "@/server/services/google-calendar";

const ICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260819T050000Z
DTEND:20260819T060000Z
UID:utc-event@google.com
SUMMARY:비이커\\, MOP
BEGIN:VALARM
UID:alarm-must-not-replace-event
END:VALARM
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260821
DTEND;VALUE=DATE:20260823
UID:all-day@google.com
SUMMARY:팝업
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=Asia/Seoul:20260818T163000
DTEND;TZID=Asia/Seoul:20260818T173000
RRULE:FREQ=WEEKLY;COUNT=3;BYDAY=TU
EXDATE;TZID=Asia/Seoul:20260825T163000
UID:weekly@google.com
SUMMARY:Weekly Call
END:VEVENT
END:VCALENDAR`;

describe("parseGoogleCalendarIcs", () => {
  it("normalizes Seoul time, all-day spans, recurrence and exclusions", () => {
    const events = parseGoogleCalendarIcs(ICS, "2026-08-01", "2026-09-30");
    expect(events.map(({ title, date, startTime }) => ({ title, date, startTime }))).toEqual([
      { title: "Weekly Call", date: "2026-08-18", startTime: "16:30" },
      { title: "비이커, MOP", date: "2026-08-19", startTime: "14:00" },
      { title: "팝업", date: "2026-08-21", startTime: null },
      { title: "팝업", date: "2026-08-22", startTime: null },
      { title: "Weekly Call", date: "2026-09-01", startTime: "16:30" },
    ]);
    expect(events[1]?.id.startsWith("utc-event@google.com:")).toBe(true);
  });
});
