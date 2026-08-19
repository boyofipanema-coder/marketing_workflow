const GOOGLE_CALENDAR_ICS_URL =
  "https://calendar.google.com/calendar/ical/gpvjgso7avdc7npu6ln7qf2qgk%40group.calendar.google.com/public/basic.ics";

export interface GoogleCalendarEvent {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
}

export interface GoogleCalendarFeed {
  events: GoogleCalendarEvent[];
  available: boolean;
}

interface ParsedDate {
  date: string;
  time: string | null;
  allDay: boolean;
}

interface RawEvent {
  uid: string;
  title: string;
  start: ParsedDate | null;
  end: ParsedDate | null;
  rule: string | null;
  exdates: ParsedDate[];
  recurrenceId: ParsedDate | null;
  cancelled: boolean;
}

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function dayDistance(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}

function seoulParts(date: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${value.year}-${value.month}-${value.day}`,
    time: `${value.hour}:${value.minute}`,
  };
}

function parseDate(value: string, params = ""): ParsedDate | null {
  const dateOnly = params.includes("VALUE=DATE") || /^\d{8}$/.test(value);
  if (dateOnly) {
    return {
      date: `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`,
      time: null,
      allDay: true,
    };
  }
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!match) return null;
  if (match[7]) {
    const instant = new Date(
      Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4]),
        Number(match[5]),
        Number(match[6] ?? 0),
      ),
    );
    const zoned = seoulParts(instant);
    return { ...zoned, allDay: false };
  }
  return {
    date: `${match[1]}-${match[2]}-${match[3]}`,
    time: `${match[4]}:${match[5]}`,
    allDay: false,
  };
}

function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function property(line: string): { name: string; params: string; value: string } | null {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const [name, ...params] = line.slice(0, colon).split(";");
  return {
    name: name!.toUpperCase(),
    params: params.join(";").toUpperCase(),
    value: line.slice(colon + 1),
  };
}

function parseRawEvent(lines: string[]): RawEvent | null {
  let nested = 0;
  let uid = "";
  let title = "제목 없는 일정";
  let start: ParsedDate | null = null;
  let end: ParsedDate | null = null;
  let rule: string | null = null;
  let recurrenceId: ParsedDate | null = null;
  let cancelled = false;
  const exdates: ParsedDate[] = [];

  for (const line of lines) {
    if (line.startsWith("BEGIN:")) {
      nested += 1;
      continue;
    }
    if (line.startsWith("END:")) {
      nested = Math.max(0, nested - 1);
      continue;
    }
    if (nested) continue;
    const field = property(line);
    if (!field) continue;
    if (field.name === "UID") uid = field.value;
    if (field.name === "SUMMARY") title = unescapeText(field.value);
    if (field.name === "DTSTART") start = parseDate(field.value, field.params);
    if (field.name === "DTEND") end = parseDate(field.value, field.params);
    if (field.name === "RRULE") rule = field.value;
    if (field.name === "RECURRENCE-ID") {
      recurrenceId = parseDate(field.value, field.params);
    }
    if (field.name === "EXDATE") {
      for (const value of field.value.split(",")) {
        const parsed = parseDate(value, field.params);
        if (parsed) exdates.push(parsed);
      }
    }
    if (field.name === "STATUS" && field.value === "CANCELLED") cancelled = true;
  }
  if (!uid) return null;
  return { uid, title, start, end, rule, exdates, recurrenceId, cancelled };
}

function rawEvents(ics: string): RawEvent[] {
  const lines = ics.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
  const events: RawEvent[] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = [];
      continue;
    }
    if (line === "END:VEVENT" && current) {
      const event = parseRawEvent(current);
      if (event) events.push(event);
      current = null;
      continue;
    }
    if (current) current.push(line);
  }
  return events;
}

function ruleValues(rule: string): Map<string, string> {
  return new Map(
    rule.split(";").flatMap((part) => {
      const [key, value] = part.split("=");
      return key && value ? [[key.toUpperCase(), value.toUpperCase()]] : [];
    }),
  );
}

function weekday(date: string): string {
  return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]!;
}

function monthDistance(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  return (toYear! - fromYear!) * 12 + toMonth! - fromMonth!;
}

function matchesOrdinalWeekday(date: string, token: string): boolean {
  const match = token.match(/^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/);
  if (!match || weekday(date) !== match[2]) return false;
  if (!match[1]) return true;
  const ordinal = Number(match[1]);
  const day = Number(date.slice(-2));
  if (ordinal > 0) return Math.ceil(day / 7) === ordinal;
  const [year, month] = date.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
  return -Math.ceil((daysInMonth - day + 1) / 7) === ordinal;
}

function recurrenceDates(
  event: RawEvent,
  rangeStart: string,
  rangeEnd: string,
): string[] {
  if (!event.start || !event.rule) return [];
  const values = ruleValues(event.rule);
  const frequency = values.get("FREQ");
  const interval = Math.max(1, Number(values.get("INTERVAL") ?? 1));
  const countLimit = Number(values.get("COUNT") ?? Number.POSITIVE_INFINITY);
  const until = values.get("UNTIL");
  const untilDate = until ? parseDate(until)?.date ?? rangeEnd : rangeEnd;
  const byDays = (values.get("BYDAY") ?? "").split(",").filter(Boolean);
  const byMonthDays = (values.get("BYMONTHDAY") ?? "")
    .split(",")
    .filter(Boolean)
    .map(Number);
  const byMonths = (values.get("BYMONTH") ?? "")
    .split(",")
    .filter(Boolean)
    .map(Number);
  const dates: string[] = [];
  let occurrences = 0;

  for (let cursor = event.start.date; cursor <= rangeEnd && cursor <= untilDate; cursor = addDays(cursor, 1)) {
    const elapsedDays = dayDistance(event.start.date, cursor);
    const elapsedMonths = monthDistance(event.start.date, cursor);
    const cursorDay = Number(cursor.slice(-2));
    const cursorMonth = Number(cursor.slice(5, 7));
    let matches = false;
    if (frequency === "DAILY") matches = elapsedDays % interval === 0;
    if (frequency === "WEEKLY") {
      matches =
        Math.floor(elapsedDays / 7) % interval === 0 &&
        (byDays.length ? byDays.some((day) => day.slice(-2) === weekday(cursor)) : weekday(cursor) === weekday(event.start.date));
    }
    if (frequency === "MONTHLY") {
      matches =
        elapsedMonths % interval === 0 &&
        (byMonthDays.length
          ? byMonthDays.includes(cursorDay)
          : byDays.length
            ? byDays.some((day) => matchesOrdinalWeekday(cursor, day))
            : cursorDay === Number(event.start.date.slice(-2)));
    }
    if (frequency === "YEARLY") {
      const startYear = Number(event.start.date.slice(0, 4));
      const cursorYear = Number(cursor.slice(0, 4));
      matches =
        (cursorYear - startYear) % interval === 0 &&
        (byMonths.length ? byMonths.includes(cursorMonth) : cursorMonth === Number(event.start.date.slice(5, 7))) &&
        (byMonthDays.length ? byMonthDays.includes(cursorDay) : cursorDay === Number(event.start.date.slice(-2)));
    }
    if (!matches) continue;
    occurrences += 1;
    if (occurrences > countLimit) break;
    if (cursor >= rangeStart) dates.push(cursor);
  }
  return dates;
}

function occurrenceEnd(event: RawEvent, startDate: string): ParsedDate | null {
  if (!event.start || !event.end) return null;
  return {
    ...event.end,
    date: addDays(startDate, dayDistance(event.start.date, event.end.date)),
  };
}

function expandOccurrence(
  event: RawEvent,
  start: ParsedDate,
  end: ParsedDate | null,
  rangeStart: string,
  rangeEnd: string,
): GoogleCalendarEvent[] {
  const finalDate = end
    ? start.allDay
      ? addDays(end.date, -1)
      : end.date
    : start.date;
  const inclusiveEnd = finalDate < start.date ? start.date : finalDate;
  const results: GoogleCalendarEvent[] = [];
  for (let date = start.date; date <= inclusiveEnd; date = addDays(date, 1)) {
    if (date < rangeStart || date > rangeEnd) continue;
    results.push({
      id: `${event.uid}:${start.date}:${date}`,
      title: event.title,
      date,
      startTime: date === start.date ? start.time : null,
      endTime: end && date === inclusiveEnd ? end.time : null,
      allDay: start.allDay,
    });
  }
  return results;
}

export function parseGoogleCalendarIcs(
  ics: string,
  rangeStart: string,
  rangeEnd: string,
): GoogleCalendarEvent[] {
  const parsed = rawEvents(ics);
  const bases = new Map(
    parsed.filter((event) => !event.recurrenceId).map((event) => [event.uid, event]),
  );
  const exceptions = new Map(
    parsed
      .filter((event) => event.recurrenceId)
      .map((event) => [`${event.uid}:${event.recurrenceId!.date}`, event]),
  );
  const result: GoogleCalendarEvent[] = [];

  for (const event of parsed) {
    if (event.recurrenceId) {
      if (event.cancelled || !event.start) continue;
      const base = bases.get(event.uid);
      const normalized = {
        ...event,
        title: event.title === "제목 없는 일정" ? base?.title ?? event.title : event.title,
      };
      result.push(...expandOccurrence(normalized, event.start, event.end, rangeStart, rangeEnd));
      continue;
    }
    if (event.cancelled || !event.start) continue;
    if (!event.rule) {
      result.push(...expandOccurrence(event, event.start, event.end, rangeStart, rangeEnd));
      continue;
    }
    const excluded = new Set(event.exdates.map((date) => date.date));
    for (const date of recurrenceDates(event, rangeStart, rangeEnd)) {
      if (excluded.has(date) || exceptions.has(`${event.uid}:${date}`)) continue;
      const start = { ...event.start, date };
      result.push(
        ...expandOccurrence(
          event,
          start,
          occurrenceEnd(event, date),
          rangeStart,
          rangeEnd,
        ),
      );
    }
  }

  return result.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.startTime ?? "").localeCompare(b.startTime ?? "") ||
      a.title.localeCompare(b.title, "ko"),
  );
}

export async function getGoogleCalendarFeed(today: string): Promise<GoogleCalendarFeed> {
  const year = Number(today.slice(0, 4));
  const rangeStart = `${year - 1}-01-01`;
  const rangeEnd = `${year + 2}-12-31`;
  try {
    const response = await fetch(GOOGLE_CALENDAR_ICS_URL, {
      next: { revalidate: 120 },
    });
    if (!response.ok) return { events: [], available: false };
    const ics = await response.text();
    return {
      events: parseGoogleCalendarIcs(ics, rangeStart, rangeEnd),
      available: true,
    };
  } catch {
    return { events: [], available: false };
  }
}
