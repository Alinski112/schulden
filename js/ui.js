// @ts-check
// Draws the data onto the page. User text is only ever set via textContent.
import { formatCents, monthlyPayments, sortByDate, summarize } from './logic.js';

/** @typedef {import('./logic.js').Entry} Entry */

/** @param {string} id */
export function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Element #${id} fehlt`);
  return node;
}

/** @param {string} tag @param {string} className @param {string} [text] */
function create(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** @param {Entry[]} entries @param {(entry: Entry) => void} onDelete */
export function render(entries, onDelete) {
  renderSummary(entries);
  renderMonths(entries);
  renderHistory(entries, onDelete);
}

/** @param {Entry[]} entries */
function renderSummary(entries) {
  const { debt, paid, open, percent } = summarize(entries);
  el('open-label').textContent = open < 0 ? 'Dein Guthaben' : 'Noch offen';
  el('open-amount').textContent = formatCents(Math.abs(open));

  let status = `${formatCents(paid)} von ${formatCents(debt)} geschafft`;
  if (debt === 0) status = 'Noch keine Schulden eingetragen';
  else if (open <= 0) status = `Alles zurückgezahlt: ${formatCents(paid)}`;
  el('status').textContent = status;
  el('progress-fill').style.width = `${percent}%`;
}

/** @param {Entry[]} entries */
function renderMonths(entries) {
  const months = monthlyPayments(entries, new Date());
  el('months-section').hidden = months.every((m) => m.cents === 0);
  const max = Math.max(...months.map((m) => m.cents), 1);
  el('months').replaceChildren(...months.map((month) => {
    const item = create('li', 'month');
    const value = month.cents ? `${Math.round(month.cents / 100).toLocaleString('de-DE')} €` : '';
    const bar = create('span', month.cents ? 'month-bar filled' : 'month-bar');
    bar.style.height = `${(month.cents / max) * 100}%`;
    const track = create('span', 'month-track');
    track.append(bar);
    item.append(create('span', 'month-value', value), track, create('span', 'month-label', month.label));
    item.setAttribute('aria-label', `${month.label}: ${formatCents(month.cents)}`);
    return item;
  }));
}

/** @param {Entry[]} entries @param {(entry: Entry) => void} onDelete */
function renderHistory(entries, onDelete) {
  el('empty').hidden = entries.length > 0;
  el('history').replaceChildren(...sortByDate(entries).map((entry) => {
    const isPayment = entry.type === 'payment';
    const title = entry.note || (isPayment ? 'Rückzahlung' : 'Schuld');
    const date = new Date(`${entry.date}T00:00`).toLocaleDateString('de-DE', {
      day: 'numeric', month: 'short', year: 'numeric',
    });

    const text = create('div', 'entry-text');
    text.append(
      create('span', 'entry-title', title),
      create('span', 'entry-date', `${isPayment ? 'Zurückgezahlt' : 'Geliehen'}, ${date}`),
    );
    const amount = create('span', `entry-amount ${entry.type}`,
      `${isPayment ? '−' : '+'}${formatCents(entry.cents)}`);
    const remove = create('button', 'entry-delete', '✕');
    remove.setAttribute('type', 'button');
    remove.setAttribute('aria-label', `${title} über ${formatCents(entry.cents)} löschen`);
    remove.addEventListener('click', () => onDelete(entry));

    const item = create('li', 'entry');
    item.append(text, amount, remove);
    return item;
  }));
}

/** @param {string} message empty string hides the banner */
export function showMessage(message, isError = false) {
  const banner = el('message');
  banner.textContent = message;
  banner.classList.toggle('error', isError);
}
