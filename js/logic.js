// @ts-check
// Pure calculations. All money is stored as whole cents to avoid rounding errors.

/** @typedef {{ id: string, type: 'debt' | 'payment', cents: number, date: string, note: string }} Entry */

export const MAX_CENTS = 1_000_000_000; // 10 million euros
export const MAX_NOTE_LENGTH = 80;

/**
 * Reads German or plain input ("1.234,56", "12,5", "12.50").
 * @param {string} text
 * @returns {number | null} cents, or null if not a valid positive amount
 */
export function parseAmount(text) {
  let value = text.replace(/[\s€]/g, '');
  if (value.includes(',')) {
    if (!/^(\d+|\d{1,3}(\.\d{3})+),\d{0,2}$/.test(value)) return null;
    value = value.replaceAll('.', '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(value)) {
    value = value.replaceAll('.', '');
  }
  if (!/^\d+(\.\d{0,2})?$/.test(value)) return null;
  const cents = Math.round(Number(value) * 100);
  return cents > 0 && cents <= MAX_CENTS ? cents : null;
}

/** @param {number} cents */
export function formatCents(cents) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

/** @param {Date} date @returns {string} local date as YYYY-MM-DD */
export function toIsoDate(date) {
  const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** @param {unknown} text @returns {text is string} */
export function isIsoDate(text) {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [year, month, day] = text.split('-').map(Number);
  return toIsoDate(new Date(year, month - 1, day)) === text;
}

/** @param {Entry[]} entries */
export function summarize(entries) {
  let debt = 0;
  let paid = 0;
  for (const entry of entries) {
    if (entry.type === 'debt') debt += entry.cents;
    else paid += entry.cents;
  }
  // Rounded down, so 100 % only shows once everything is really paid.
  const percent = debt > 0 ? Math.min(100, Math.floor((paid * 100) / debt)) : 0;
  return { debt, paid, open: debt - paid, percent };
}

/**
 * Payments per month, oldest first, ending with the month of `today`.
 * @param {Entry[]} entries @param {Date} today @param {number} [count]
 */
export function monthlyPayments(entries, today, count = 6) {
  return Array.from({ length: count }, (_, index) => {
    const month = new Date(today.getFullYear(), today.getMonth() - (count - 1 - index), 1);
    const key = toIsoDate(month).slice(0, 7);
    const cents = entries
      .filter((e) => e.type === 'payment' && e.date.startsWith(key))
      .reduce((sum, e) => sum + e.cents, 0);
    return { label: month.toLocaleDateString('de-DE', { month: 'short' }), cents };
  });
}

/** @param {Entry[]} entries @returns {Entry[]} newest first */
export function sortByDate(entries) {
  return entries.toReversed().sort((a, b) => b.date.localeCompare(a.date));
}

/** @param {unknown} value @returns {value is Entry} */
function isEntry(value) {
  if (typeof value !== 'object' || value === null) return false;
  const e = /** @type {Record<string, unknown>} */ (value);
  return typeof e.id === 'string'
    && (e.type === 'debt' || e.type === 'payment')
    && Number.isInteger(e.cents) && Number(e.cents) > 0 && Number(e.cents) <= MAX_CENTS
    && isIsoDate(e.date)
    && typeof e.note === 'string';
}

/** @param {Entry[]} entries */
export function serialize(entries) {
  return JSON.stringify({ version: 1, entries }, null, 2);
}

/**
 * Parses saved data or a backup file. Throws instead of silently dropping entries.
 * @param {string} text @returns {Entry[]}
 */
export function deserialize(text) {
  const data = JSON.parse(text);
  if (data?.version !== 1 || !Array.isArray(data.entries) || !data.entries.every(isEntry)) {
    throw new Error('Unbekanntes Datenformat');
  }
  return data.entries;
}
