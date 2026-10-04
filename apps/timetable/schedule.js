// Timetable logic (pure, no DOM): current time in India, the class on now, and the next class.

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAY_NAMES = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
export const TIME_ZONE = 'Asia/Kolkata';

/** Day (Mon..Sun) and minutes since midnight in the given time zone. */
export function zonedNow(date = new Date(), timeZone = TIME_ZONE) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return { day: parts.weekday.slice(0, 3), minutes: Number(parts.hour) * 60 + Number(parts.minute), seconds: Number(parts.second) };
}

export const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
};

export function fmtTime(hhmm) {
  const mins = toMinutes(hhmm);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function fmtDuration(mins) {
  if (mins < 1) return 'less than a minute';
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  const parts = [];
  if (d) parts.push(`${d} day${d > 1 ? 's' : ''}`);
  if (h) parts.push(`${h} hr`);
  if (m && !d) parts.push(`${m} min`);
  return parts.join(' ');
}

/** Rows that are valid, sorted by day then start time. */
export function normaliseRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => r && DAYS.includes(r.day) && /^\d{2}:\d{2}$/.test(r.start) && /^\d{2}:\d{2}$/.test(r.end) && r.subject && toMinutes(r.end) > toMinutes(r.start))
    .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || toMinutes(a.start) - toMinutes(b.start));
}

/**
 * What is on now and what comes next.
 * now: the class in progress (with minutes left), or null.
 * next: the next class that has not started, searching up to a week ahead, with minutes until it starts.
 */
export function status(rows, now) {
  const list = normaliseRows(rows);
  const todayIdx = DAYS.indexOf(now.day);
  const current = list.find((r) => r.day === now.day && toMinutes(r.start) <= now.minutes && now.minutes < toMinutes(r.end)) || null;
  let next = null;
  for (let offset = 0; offset < 8 && !next; offset += 1) {
    const day = DAYS[(todayIdx + offset) % 7];
    const candidates = list.filter((r) => r.day === day && (offset > 0 || toMinutes(r.start) > now.minutes));
    if (candidates.length) {
      const r = candidates[0];
      next = { ...r, dayOffset: offset, inMinutes: offset * 1440 + toMinutes(r.start) - now.minutes };
    }
  }
  const today = list.filter((r) => r.day === now.day).map((r) => ({ ...r, state: toMinutes(r.end) <= now.minutes ? 'done' : toMinutes(r.start) <= now.minutes ? 'now' : 'later' }));
  return {
    now: current ? { ...current, minutesLeft: toMinutes(current.end) - now.minutes, progress: (now.minutes - toMinutes(current.start)) / (toMinutes(current.end) - toMinutes(current.start)) } : null,
    next,
    today,
    hasRows: list.length > 0,
  };
}

/** Parses rows pasted from a spreadsheet: Day, Start, End, Subject[, Teacher[, Room]] per line (tabs or commas). */
export function parsePasted(text) {
  const out = [];
  for (const line of String(text).split(/\r?\n/)) {
    const cells = line.split(line.includes('\t') ? '\t' : ',').map((c) => c.trim());
    if (cells.length < 4) continue;
    const day = DAYS.find((d) => d.toLowerCase() === cells[0].slice(0, 3).toLowerCase());
    const t = (v) => {
      const m = /^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/i.exec(v || '');
      if (!m) return null;
      let h = Number(m[1]);
      if (m[3]?.toLowerCase() === 'pm' && h < 12) h += 12;
      if (m[3]?.toLowerCase() === 'am' && h === 12) h = 0;
      return h < 24 && Number(m[2]) < 60 ? `${String(h).padStart(2, '0')}:${m[2]}` : null;
    };
    const start = t(cells[1]);
    const end = t(cells[2]);
    if (!day || !start || !end || !cells[3]) continue;
    out.push({ day, start, end, subject: cells[3], ...(cells[4] ? { teacher: cells[4] } : {}), ...(cells[5] ? { room: cells[5] } : {}) });
  }
  return normaliseRows(out);
}
