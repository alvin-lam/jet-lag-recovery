// Seasons and holidays that drive the automatic color theme.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectHoliday, detectSeason, hemisphereForTz, easterDate, thanksgivingDate } from '../js/core/calendar.js';
import { LUNAR_NEW_YEAR, DIWALI, HANUKKAH } from '../js/data/themes.js';

const day = (y, m, d) => new Date(y, m - 1, d, 12);

test('seasons follow the hemisphere of the device time zone', () => {
  assert.equal(hemisphereForTz('America/New_York'), 'north');
  assert.equal(hemisphereForTz('Australia/Sydney'), 'south');
  assert.equal(hemisphereForTz('America/Sao_Paulo'), 'south');
  assert.equal(detectSeason(day(2026, 11, 24), 'north'), 'autumn');
  assert.equal(detectSeason(day(2026, 11, 24), 'south'), 'spring');
  assert.equal(detectSeason(day(2026, 1, 10), 'north'), 'winter');
});

test('holidays switch on around their dates', () => {
  assert.equal(detectHoliday(day(2026, 11, 24), 'America/New_York'), 'thanksgiving');
  assert.equal(detectHoliday(day(2026, 12, 20), 'Europe/London'), 'christmas');
  assert.equal(detectHoliday(day(2026, 6, 15), 'Europe/London'), 'pride');
  assert.equal(detectHoliday(day(2026, 10, 25), 'Europe/London'), 'halloween');
  assert.equal(detectHoliday(day(2026, 8, 15), 'Europe/London'), null);
});

test('US-only holidays appear only in US time zones', () => {
  assert.equal(detectHoliday(day(2026, 11, 24), 'Australia/Sydney'), null);
  assert.equal(detectHoliday(day(2026, 7, 4), 'America/Chicago'), 'independence');
  assert.equal(detectHoliday(day(2026, 7, 4), 'Europe/Paris'), null);
});

test('computed holiday dates', () => {
  assert.equal(new Date(easterDate(2027)).toISOString().slice(0, 10), '2027-03-28');
  assert.equal(new Date(thanksgivingDate(2026)).toISOString().slice(0, 10), '2026-11-26');
});

test('lunisolar holiday tables cover 2025 through 2036', () => {
  for (const table of [LUNAR_NEW_YEAR, DIWALI, HANUKKAH]) {
    for (let y = 2025; y <= 2036; y++) assert.ok(table[y], `missing ${y}`);
  }
  assert.deepEqual(LUNAR_NEW_YEAR[2027], [2, 6]);
  assert.deepEqual(DIWALI[2036], [10, 18]);
});
