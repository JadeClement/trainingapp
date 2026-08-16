export const SPORTS = [
  { value: 'swim', label: 'Swim', color: '#2f7c9e' },
  { value: 'bike', label: 'Bike', color: '#4f8f52' },
  { value: 'run', label: 'Run', color: '#b6503d' },
  { value: 'strength', label: 'Strength', color: '#7c5a94' },
  { value: 'other', label: 'Other', color: '#6c8683' },
];

export function sportMeta(sport) {
  return SPORTS.find((s) => s.value === sport) || SPORTS[SPORTS.length - 1];
}

export function toISODate(date) {
  const d = new Date(date);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfMonth(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfMonth(date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1, 0);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekDays(anchorDate) {
  const start = startOfWeek(anchorDate);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// Returns a flat array of dates covering full weeks (Sun-Sat) that contain the month.
export function getMonthGridDays(anchorDate) {
  const firstOfMonth = startOfMonth(anchorDate);
  const lastOfMonth = endOfMonth(anchorDate);
  const gridStart = startOfWeek(firstOfMonth);
  const gridEnd = addDays(startOfWeek(lastOfMonth), 6);

  const days = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function formatDurationSeconds(seconds) {
  if (seconds === null || seconds === undefined) return null;
  const mins = Math.round(seconds / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
