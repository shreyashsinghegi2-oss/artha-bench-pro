import { describe, expect, it } from 'vitest';
import { fmtDuration, fmtTime, parsePasted, status, zonedNow } from '../apps/timetable/schedule.js';

const rows = [
  { day: 'Mon', start: '09:00', end: '09:50', subject: 'Maths' },
  { day: 'Mon', start: '10:00', end: '10:50', subject: 'Physics', room: 'Lab 2' },
  { day: 'Tue', start: '09:00', end: '09:50', subject: 'Chemistry' },
  { day: 'Fri', start: '15:00', end: '15:50', subject: 'Sports' },
];

describe('timetable schedule', () => {
  it('reads India time regardless of the viewer time zone', () => {
    // 2026-09-30T03:30:00Z = Wednesday 09:00 IST
    expect(zonedNow(new Date('2026-09-30T03:30:00Z'))).toMatchObject({ day: 'Wed', minutes: 540 });
  });

  it('finds the class on now and the next one', () => {
    const s = status(rows, { day: 'Mon', minutes: 9 * 60 + 20 });
    expect(s.now).toMatchObject({ subject: 'Maths', minutesLeft: 30 });
    expect(s.next).toMatchObject({ subject: 'Physics', inMinutes: 40, dayOffset: 0 });
    expect(s.today.map((r: { state: string }) => r.state)).toEqual(['now', 'later']);
  });

  it('in a break: nothing now, next is later today', () => {
    const s = status(rows, { day: 'Mon', minutes: 9 * 60 + 55 });
    expect(s.now).toBeNull();
    expect(s.next).toMatchObject({ subject: 'Physics', inMinutes: 5 });
  });

  it('after the last class: next is tomorrow; over the weekend it wraps to Monday', () => {
    expect(status(rows, { day: 'Mon', minutes: 18 * 60 }).next).toMatchObject({ subject: 'Chemistry', dayOffset: 1 });
    expect(status(rows, { day: 'Sat', minutes: 600 }).next).toMatchObject({ subject: 'Maths', dayOffset: 2, day: 'Mon' });
    expect(status(rows, { day: 'Fri', minutes: 16 * 60 }).next).toMatchObject({ subject: 'Maths', dayOffset: 3 });
  });

  it('same weekday next week when it is the only class', () => {
    expect(status([rows[3]], { day: 'Fri', minutes: 16 * 60 }).next).toMatchObject({ subject: 'Sports', dayOffset: 7 });
  });

  it('handles an empty timetable', () => {
    expect(status([], { day: 'Mon', minutes: 0 })).toMatchObject({ now: null, next: null, hasRows: false });
  });

  it('formats times and durations', () => {
    expect(fmtTime('09:05')).toBe('9:05 AM');
    expect(fmtTime('13:00')).toBe('1:00 PM');
    expect(fmtTime('00:30')).toBe('12:30 AM');
    expect(fmtDuration(95)).toBe('1 hr 35 min');
    expect(fmtDuration(1500)).toBe('1 day 1 hr');
  });

  it('parses rows pasted from a spreadsheet', () => {
    expect(parsePasted('Monday\t9:00\t9:50\tMaths\tMr Rao\t101\nbad line\nTue, 2:00 pm, 2:50 pm, Physics')).toEqual([
      { day: 'Mon', start: '09:00', end: '09:50', subject: 'Maths', teacher: 'Mr Rao', room: '101' },
      { day: 'Tue', start: '14:00', end: '14:50', subject: 'Physics' },
    ]);
  });
});
