// Zile calendaristice între date; perioadele de culpă includ ambele capete.
export function periodDays(start, end, inclusive = false) {
  const timestamp = (value) => {
    const match = String(value || "").match(/^(\d{2})[./](\d{2})[./](\d{4})$/);
    if (!match) return null;
    const [, day, month, year] = match.map(Number);
    if (year <= 1900) return null;
    const stamp = Date.UTC(year, month - 1, day);
    const date = new Date(stamp);
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? stamp : null;
  };
  const first = timestamp(start);
  const last = timestamp(end);
  if (first === null || last === null || last < first) return null;
  return (last - first) / 86400000 + (inclusive ? 1 : 0);
}
