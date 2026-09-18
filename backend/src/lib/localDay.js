// "Today" for a client in Lebanon (prompt-94).
//
// Everything in this app stores instants (Mongo Dates, i.e. UTC). A day boundary, though, is a
// local idea: a client who eats a 1am snack has eaten it *today* as far as she is concerned,
// and a UTC boundary would file it under tomorrow. Beirut runs UTC+2 in winter and UTC+3 in
// summer, so a hardcoded offset is wrong for half the year — and wrong in the direction that
// matters, since the switch lands in late March/late October rather than anywhere quiet.
//
// So the zone is named, not numeric, and the offset is derived from it per-instant. Node 20
// ships full ICU, so Intl resolves Asia/Beirut including its DST rules without a date library.
export const CLIENT_TIMEZONE = "Asia/Beirut";

// How far the named zone is ahead of UTC at this particular instant, in ms.
//
// Formats the instant in the zone, reads the wall-clock fields back, and treats them as if
// they were UTC. The difference between that and the real instant IS the offset — which is the
// standard way to get a zone offset out of Intl, since Intl exposes formatted fields but not
// the offset itself.
function zoneOffsetMs(instant, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(instant)
    .reduce((acc, p) => (p.type === "literal" ? acc : { ...acc, [p.type]: Number(p.value) }), {});

  // hour comes back as 24 for midnight under hour12:false in some ICU versions.
  const asIfUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour % 24,
    parts.minute,
    parts.second,
  );
  return asIfUtc - instant.getTime();
}

// The local calendar date (y/m/d) at an instant, in the given zone.
function zoneDateParts(instant, timeZone) {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(instant)
    .split("-")
    .map(Number);
  return { year, month, day };
}

// The UTC instant at which a given local calendar date begins.
//
// Two passes: the offset is taken at a first guess, then re-taken at the resulting instant and
// the guess corrected. One correction is enough because the two offsets can only differ across
// a DST transition, and re-measuring at the corrected instant lands on the right side of it.
// Beirut switches at midnight local, which is exactly this boundary — so the second pass isn't
// theoretical here, it's the twice-a-year case.
function startOfLocalDay({ year, month, day }, timeZone) {
  const naiveUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  const firstGuess = new Date(naiveUtc - zoneOffsetMs(new Date(naiveUtc), timeZone));
  return new Date(naiveUtc - zoneOffsetMs(firstGuess, timeZone));
}

// Half-open [start, end) range covering the local day an instant falls in, plus the local date
// string and the weekday index with MONDAY = 0 — which is the convention MealPlan.items.day
// uses (0..6 = Mon..Sun, matching the frontend's DAYS array), not JS's Sunday-first getUTCDay.
export function localDayRange(now = new Date(), timeZone = CLIENT_TIMEZONE) {
  const parts = zoneDateParts(now, timeZone);
  const start = startOfLocalDay(parts, timeZone);

  // Next local date derived by adding a day to the calendar fields, not 24h to the instant —
  // a DST day is 23 or 25 hours long, and adding 24h would clip or overrun it.
  const nextParts = zoneDateParts(new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1)), timeZone);
  const end = startOfLocalDay(nextParts, timeZone);

  const sundayFirst = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  return {
    start,
    end,
    date: `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`,
    dayIndex: (sundayFirst + 6) % 7,
    timeZone,
  };
}

// Local wall-clock time as "HH:MM", for reporting "it is now 14:32 for this client".
export function localTimeHHMM(now = new Date(), timeZone = CLIENT_TIMEZONE) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
}
