import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayLocalISODate, toDateInputValue } from '../src/lib/formatters.js';

test('todayLocalISODate uses local calendar components', () => {
  const sample = new Date(2026, 9, 16, 0, 30, 0); // 16. okt lokal, etter midnatt
  assert.equal(todayLocalISODate(sample), '2026-10-16');
});

test('toDateInputValue prefers YYYY-MM-DD prefix over UTC conversion', () => {
  assert.equal(toDateInputValue('2024-01-15T22:00:00.000Z'), '2024-01-15');
  assert.equal(toDateInputValue('2024-06-01'), '2024-06-01');
  assert.equal(toDateInputValue(''), '');
});
