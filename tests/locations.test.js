// Airport data and search.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOCATIONS, searchLocations, parseLoc, migrateKey } from '../js/data/locations.js';

const codes = (q, n = 5) => searchLocations(q, n).map((l) => l.code || l.key);

test('the airport list is large, unique and uses valid time zones', () => {
  assert.ok(LOCATIONS.length > 3000);
  const seen = new Set();
  for (const l of LOCATIONS) {
    assert.match(l.code, /^[A-Z]{3}$/);
    assert.ok(!seen.has(l.code), `duplicate ${l.code}`);
    seen.add(l.code);
    assert.doesNotThrow(() => new Intl.DateTimeFormat('en', { timeZone: l.tz }), l.tz);
  }
});

test('search by code, metro code, city, airport name and old names', () => {
  assert.deepEqual(codes('lhr', 1), ['LHR']);
  assert.deepEqual(codes('nyc', 3), ['JFK', 'EWR', 'LGA']);
  assert.deepEqual(codes('london', 4), ['LHR', 'LGW', 'STN', 'LCY']);
  assert.equal(codes('heathrow', 1)[0], 'LHR');
  assert.equal(codes('bombay', 1)[0], 'BOM');
  assert.equal(codes('bali', 1)[0], 'DPS');
  assert.equal(codes('new', 1)[0], 'JFK');
});

test('accents and special letters are optional', () => {
  assert.equal(codes('tromso', 1)[0], 'TOS');
  assert.equal(codes('sao paulo', 1)[0], 'GRU');
  assert.equal(codes('münchen', 1)[0], 'MUC');
});

test('places without a listed airport fall back to time zones', () => {
  const r = searchLocations('utc', 8);
  assert.ok(r.some((l) => l.key === 'tz:UTC'));
  assert.equal(parseLoc('tz:UTC').label, 'UTC');
  assert.match(parseLoc('tz:Pacific/Kiritimati').label, /^Kiritimati \(UTC\+14\)$/);
});

test('location keys saved by earlier versions are upgraded', () => {
  assert.equal(migrateKey('London|Europe/London'), 'code:LHR');
  assert.equal(migrateKey('code:JFK'), 'code:JFK');
});
