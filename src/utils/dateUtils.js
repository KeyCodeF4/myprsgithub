export function toLocalDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function toDateKeyInTimeZone(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = type => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function parseLocalDateKey(key) {
  const [year, month, day] = String(key).split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function startOfLocalDay(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getLocalMonday(value = new Date()) {
  const monday = startOfLocalDay(value);
  const day = monday.getDay();
  monday.setDate(monday.getDate() - day + (day === 0 ? -6 : 1));
  return monday;
}

export function getLocalWeekKey(value = new Date()) {
  return toLocalDateKey(getLocalMonday(value));
}

export function getLocalMonthKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getLocalMonthRange(monthKey) {
  const [year, month] = String(monthKey).split('-').map(Number);
  return {
    start: new Date(year, month - 1, 1),
    end: new Date(year, month, 0),
  };
}

export function getLocalWeekRange(value = new Date()) {
  const start = getLocalMonday(value);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

export function daysUntilNextLocalWeek(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const day = date.getDay();
  return day === 0 ? 0 : 7 - day;
}

export function daysUntilNextLocalMonth(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  const today = startOfLocalDay(date);
  return Math.round((nextMonth.getTime() - today.getTime()) / 86400000);
}

export function getWorkoutDateKey(workout) {
  return toLocalDateKey(workout.date);
}
