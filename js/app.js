// @ts-check
// Connects buttons and forms with logic and storage.
import { MAX_NOTE_LENGTH, deserialize, formatCents, isIsoDate, parseAmount, serialize, toIsoDate } from './logic.js';
import { deleteAll, loadEntries, readRaw, saveEntries } from './storage.js';
import { el, render, showMessage } from './ui.js';

/** @typedef {import('./logic.js').Entry} Entry */

let { entries, broken } = loadEntries();
/** @type {Entry['type']} */
let formType = 'debt';

const dialog = /** @type {HTMLDialogElement} */ (el('dialog'));
const form = /** @type {HTMLFormElement} */ (el('form'));
const amountInput = /** @type {HTMLInputElement} */ (el('amount'));
const dateInput = /** @type {HTMLInputElement} */ (el('date'));
const noteInput = /** @type {HTMLInputElement} */ (el('note'));
const importInput = /** @type {HTMLInputElement} */ (el('import-file'));
const addButtons = /** @type {HTMLButtonElement[]} */ ([el('add-debt'), el('add-payment')]);

function refresh() {
  render(entries, removeEntry);
  // While saved data is unreadable, block new entries so nothing gets overwritten.
  addButtons.forEach((button) => { button.disabled = broken; });
}

/** Saves first, shows after: the screen never claims something that is not stored. @param {Entry[]} next */
function commit(next) {
  try {
    saveEntries(next);
  } catch (error) {
    console.error('Speichern fehlgeschlagen', error);
    showMessage('Speichern hat nicht geklappt. Ist der Speicher voll oder „Privat surfen“ an?', true);
    return false;
  }
  entries = next;
  broken = false;
  refresh();
  return true;
}

/** @param {Entry['type']} type */
function openForm(type) {
  formType = type;
  form.reset();
  dateInput.value = toIsoDate(new Date());
  el('form-title').textContent = type === 'debt' ? 'Neue Schuld' : 'Neue Rückzahlung';
  el('form-error').textContent = '';
  dialog.showModal();
}

/** @param {SubmitEvent} event */
function submitForm(event) {
  event.preventDefault();
  const cents = parseAmount(amountInput.value);
  if (cents === null) {
    el('form-error').textContent = 'Bitte einen Betrag größer als 0 eingeben, z. B. 25,50.';
    amountInput.focus();
    return;
  }
  if (!isIsoDate(dateInput.value)) {
    el('form-error').textContent = 'Bitte ein Datum wählen.';
    return;
  }
  const entry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    type: formType,
    cents,
    date: dateInput.value,
    note: noteInput.value.trim().slice(0, MAX_NOTE_LENGTH),
  };
  const saved = commit([...entries, entry]);
  dialog.close();
  if (saved) showMessage(`${formatCents(cents)} gespeichert.`);
}

/** @param {Entry} entry */
function removeEntry(entry) {
  if (!confirm(`Eintrag über ${formatCents(entry.cents)} wirklich löschen?`)) return;
  if (commit(entries.filter((e) => e.id !== entry.id))) showMessage('Eintrag gelöscht.');
}

async function exportBackup() {
  const content = broken ? readRaw() ?? '' : serialize(entries);
  const file = new File([content], `schulden-sicherung-${toIsoDate(new Date())}.json`, { type: 'application/json' });
  try {
    // iPhone: the share sheet offers "In Dateien sichern".
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(file);
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return;
    console.error('Sichern fehlgeschlagen', error);
    showMessage('Sicherung konnte nicht erstellt werden.', true);
  }
}

async function importBackup() {
  const file = importInput.files?.[0];
  importInput.value = '';
  if (!file) return;
  try {
    const imported = deserialize(await file.text());
    if (!confirm(`Alle jetzigen Einträge durch ${imported.length} Einträge aus der Sicherung ersetzen?`)) return;
    if (commit(imported)) showMessage('Sicherung geladen.');
  } catch (error) {
    console.error('Laden der Sicherung fehlgeschlagen', error);
    showMessage('Diese Datei ist keine gültige Sicherung. Nichts wurde geändert.', true);
  }
}

function wipe() {
  if (!confirm('Wirklich ALLE Einträge löschen? Das kann man nicht rückgängig machen.')) return;
  try {
    deleteAll();
  } catch (error) {
    console.error('Löschen fehlgeschlagen', error);
    showMessage('Löschen hat nicht geklappt.', true);
    return;
  }
  entries = [];
  broken = false;
  refresh();
  showMessage('Alle Daten gelöscht.');
}

el('add-debt').addEventListener('click', () => openForm('debt'));
el('add-payment').addEventListener('click', () => openForm('payment'));
el('cancel').addEventListener('click', () => dialog.close());
form.addEventListener('submit', submitForm);
el('export').addEventListener('click', exportBackup);
el('import').addEventListener('click', () => importInput.click());
importInput.addEventListener('change', importBackup);
el('wipe').addEventListener('click', wipe);

refresh();
if (broken) {
  showMessage('Deine gespeicherten Daten sind nicht lesbar. Erst „Sichern“, dann eine Sicherung laden oder alles löschen.', true);
}

navigator.storage?.persist?.().catch((error) => console.error(error));
navigator.serviceWorker?.register('./sw.js').catch((error) => console.error('Offline-Modus nicht verfügbar', error));
