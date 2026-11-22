// "2026-11" → { start: 1 Nov 2026, end: 1 Dec 2026, label: "2026-11" }. Bad or missing input → current month.
export function monthRange(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(value || '');
  const now = new Date();
  const year = match ? Number(match[1]) : now.getFullYear();
  const month = match ? Number(match[2]) - 1 : now.getMonth();
  return {
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 1),
    label: `${year}-${String(month + 1).padStart(2, '0')}`,
  };
}

export const money = (n) => Math.round(n * 100) / 100;