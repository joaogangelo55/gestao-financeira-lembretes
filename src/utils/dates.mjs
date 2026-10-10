function partsFromIso(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  return match ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) } : null;
}

function isValidParts({ year, month, day }) {
  if (!Number.isInteger(year) || year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function formatDateInput(value) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 1) return digits;
  if (digits.length === 2) return `${digits}/`;
  if (digits.length <= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  if (digits.length === 4) return `${digits.slice(0, 2)}/${digits.slice(2)}/`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function isoToBrDate(value) {
  const parts = partsFromIso(value);
  if (!parts || !isValidParts(parts)) return '';
  return `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}/${parts.year}`;
}

export function isValidBrDate(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value ?? ''));
  return Boolean(match && isValidParts({ day: Number(match[1]), month: Number(match[2]), year: Number(match[3]) }));
}

export function brDateToIso(value) {
  if (!isValidBrDate(value)) return null;
  const [day, month, year] = value.split('/');
  return `${year}-${month}-${day}`;
}

export function getLocalTodayIso(now = new Date(), timezoneOffsetMinutes = now.getTimezoneOffset()) {
  const localMillis = now.getTime() - timezoneOffsetMinutes * 60_000;
  const local = new Date(localMillis);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`;
}

export function isValidIsoDate(value) {
  const parts = partsFromIso(value);
  return Boolean(parts && isValidParts(parts));
}
