const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export function formatINR(value) {
  return inr.format(Number(value) || 0);
}

export const systemTypeLabel = { ON_GRID: 'On-Grid', OFF_GRID: 'Off-Grid' };

export const gridLabel = {
  RELIABLE: 'Reliable',
  FREQUENT_CUTS: 'Frequent power cuts',
  NO_GRID: 'No grid connection',
};

// "SURVEY_REQUESTED" → "Survey requested"
export function statusLabel(status) {
  if (!status) return '';
  return status.charAt(0) + status.slice(1).toLowerCase().replaceAll('_', ' ');
}

// 7 → "ENQ-00007" (same reference the customer saw)
export function leadRef(id) {
  return `ENQ-${String(id).padStart(5, '0')}`;
}

export function formatDate(value, withTime = false) {
  if (!value) return '—';
  const options = withTime
    ? { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { day: 'numeric', month: 'short', year: 'numeric' };
  return new Date(value).toLocaleString('en-IN', options);
}