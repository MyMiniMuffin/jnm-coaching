const { test } = require('node:test');
const assert = require('node:assert/strict');

/** Speiler isValidCalendarDate i netlify/functions/data.js */
const isValidCalendarDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};

test('accepts real calendar dates', () => {
  assert.equal(isValidCalendarDate('2024-02-29'), true);
  assert.equal(isValidCalendarDate('2023-01-31'), true);
  assert.equal(isValidCalendarDate('2026-10-16'), true);
});

test('rejects rolled-over and malformed dates', () => {
  assert.equal(isValidCalendarDate('2023-02-29'), false);
  assert.equal(isValidCalendarDate('2024-04-31'), false);
  assert.equal(isValidCalendarDate('2024-13-01'), false);
  assert.equal(isValidCalendarDate('2024-00-10'), false);
  assert.equal(isValidCalendarDate('2024-1-1'), false);
  assert.equal(isValidCalendarDate(''), false);
  assert.equal(isValidCalendarDate(null), false);
});
