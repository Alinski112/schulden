import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deserialize, isIsoDate, monthlyPayments, parseAmount, serialize, sortByDate, summarize,
} from '../js/logic.js';

const entry = (type, cents, date, id = `${type}-${cents}`) => ({ id, type, cents, date, note: '' });

test('parseAmount reads German and plain input', () => {
  assert.equal(parseAmount('1.234,56'), 123456);
  assert.equal(parseAmount('12,5'), 1250);
  assert.equal(parseAmount('12.50 €'), 1250);
  assert.equal(parseAmount('1.000'), 100000);
  assert.equal(parseAmount('0,29'), 29);
});

test('parseAmount rejects invalid input', () => {
  for (const bad of ['', '0', '-5', 'abc', '1,234', '1,234.56', '12.3.4', '1e5', '99999999999']) {
    assert.equal(parseAmount(bad), null, bad);
  }
});

test('summarize calculates open amount and never shows 100 % too early', () => {
  const list = [entry('debt', 100000, '2026-01-01'), entry('payment', 99999, '2026-02-01')];
  assert.deepEqual(summarize(list), { debt: 100000, paid: 99999, open: 1, percent: 99 });
  assert.equal(summarize([...list, entry('payment', 500, '2026-03-01')]).percent, 100);
  assert.deepEqual(summarize([]), { debt: 0, paid: 0, open: 0, percent: 0 });
});

test('monthlyPayments covers six months across a year change', () => {
  const list = [
    entry('payment', 100, '2025-09-30'), entry('payment', 200, '2025-10-01'),
    entry('payment', 300, '2026-03-31'), entry('debt', 900, '2026-03-01'),
  ];
  assert.deepEqual(monthlyPayments(list, new Date(2026, 2, 31)).map((m) => m.cents), [200, 0, 0, 0, 0, 300]);
});

test('sortByDate puts newest first', () => {
  const list = [entry('debt', 1, '2026-01-01', 'a'), entry('debt', 2, '2026-02-01', 'b'), entry('debt', 3, '2026-02-01', 'c')];
  assert.deepEqual(sortByDate(list).map((e) => e.id), ['c', 'b', 'a']);
});

test('isIsoDate rejects impossible dates', () => {
  assert.ok(isIsoDate('2024-02-29'));
  assert.ok(!isIsoDate('2026-02-29'));
  assert.ok(!isIsoDate('01.01.2026'));
});

test('backup round trip works and broken files are rejected', () => {
  const list = [entry('debt', 100, '2026-01-01')];
  assert.deepEqual(deserialize(serialize(list)), list);
  for (const bad of ['nonsense', '{}', serialize([{ ...list[0], cents: -1 }])]) {
    assert.throws(() => deserialize(bad));
  }
});
