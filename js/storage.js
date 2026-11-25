// @ts-check
// Data lives only on this device (localStorage).
import { deserialize, serialize } from './logic.js';

/** @typedef {import('./logic.js').Entry} Entry */

const KEY = 'schuldencounter';

/** @returns {{ entries: Entry[], broken: boolean }} broken = saved data exists but is unreadable */
export function loadEntries() {
  try {
    const raw = localStorage.getItem(KEY);
    return { entries: raw === null ? [] : deserialize(raw), broken: false };
  } catch (error) {
    console.error('Laden fehlgeschlagen', error);
    return { entries: [], broken: true };
  }
}

/** Throws if the device refuses to save. @param {Entry[]} entries */
export function saveEntries(entries) {
  localStorage.setItem(KEY, serialize(entries));
}

export function readRaw() {
  return localStorage.getItem(KEY);
}

export function deleteAll() {
  localStorage.removeItem(KEY);
}
