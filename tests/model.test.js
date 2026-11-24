// The jet lag plan model, tested directly in Node (no browser needed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, buildReturnPlan } from '../js/core/model.js';

const BASE = {
  depTime: '18:30', durH: 7, durM: 0, tripDays: 7, bed: '23:00', wake: '07:00', chrono: 'neutral',
  caffSens: 'normal', cups: 2, weight: 70, weightUnit: 'kg', activity: 'moderate', climate: 'temperate',
  alcohol: 0, strategy: 'auto', preDays: 0, pace: 1, personalWater: false, depDate: '2026-12-01',
};
const plan = (o) => buildPlan({ ...BASE, ...o });

test('eastward trip advances the body clock about 1 hour a day', () => {
  const p = plan({ home: 'code:LAX', dest: 'code:LHR', durH: 10 });
  assert.equal(p.clockDiff, 8);
  assert.equal(p.sign, 1);
  assert.equal(p.strategy, 'gradual');
  assert.equal(p.daysToAdjust, 8);
  assert.ok(p.days.at(-1).isAdjusted || p.days.some((d) => d.isAdjusted));
});

test('westward trip delays the body clock about 1.5 hours a day', () => {
  const p = plan({ home: 'code:LHR', dest: 'code:LAX', depTime: '11:00', durH: 11 });
  assert.equal(p.sign, -1);
  assert.equal(p.daysToAdjust, 6);
});

test('a 14 hour gap is crossed the shorter way around the clock', () => {
  const p = plan({ home: 'code:JFK', dest: 'code:HND', depTime: '12:00', durH: 14 });
  assert.equal(p.clockDiff, 14);
  assert.equal(p.target, -10); // delay 10 hours instead of advancing 14
});

test('small time differences need no plan', () => {
  const p = plan({ home: 'code:JFK', dest: 'code:ORD', durH: 2 });
  assert.equal(p.strategy, 'gradual'); // 1 hour still shifts
  const q = plan({ home: 'code:JFK', dest: 'code:ATL', durH: 2 });
  assert.equal(q.strategy, 'none');
});

test('short trips default to staying on home time', () => {
  const p = plan({ home: 'code:JFK', dest: 'code:CDG', depTime: '19:00', tripDays: 2 });
  assert.equal(p.strategy, 'home');
});

test('a 6:30 am landing starts a new day instead of sending the traveler to bed', () => {
  const p = plan({ home: 'code:JFK', dest: 'code:LHR' }); // lands 06:30 London
  const d = p.days[0];
  assert.equal(p.arrHour, 6.5);
  assert.equal(d.lateArrival, false);
  assert.equal(d.arrivalSleep, null);
  assert.ok(d.bed > 20, 'bedtime is tonight');
});

test('a late evening landing goes to bed soon after arrival', () => {
  const p = plan({ home: 'code:JFK', dest: 'code:HND', durH: 14 }); // lands 22:30 Tokyo
  assert.equal(p.days[0].lateArrival, true);
  assert.equal(p.days[0].bed, p.arrHour + 1);
});

test('an after-midnight landing sleeps until wake time, then keeps tonight\'s bedtime', () => {
  const p = plan({ home: 'code:JFK', dest: 'code:LAX', depTime: '23:00', durH: 6 }); // lands 02:00 LA
  const d = p.days[0];
  assert.deepEqual(d.arrivalSleep, [3, 5.5]);
  assert.ok(d.bed > 20);
});

test('a sleep log shifts the rest of the plan', () => {
  const trip = { home: 'code:JFK', dest: 'code:HND', durH: 14 };
  const before = plan(trip).daysToAdjust;
  const after = buildPlan({ ...BASE, ...trip }, { 1: { bed: '18:30', wake: '02:30' } }).daysToAdjust;
  assert.notEqual(before, after);
});

test('caffeine limit is standard unless personalized', () => {
  const light = { home: 'code:LHR', dest: 'code:JFK', depTime: '10:00', durH: 8, cups: 5, weight: 45 };
  assert.equal(plan(light).cups, 4);
  assert.equal(plan({ ...light, personalWater: true }).cups, 2);
  assert.equal(plan({ ...light, caffSens: 'high' }).cups, 2);
});

test('water target is standard unless personalized', () => {
  const t = { home: 'code:JFK', dest: 'code:LHR' };
  assert.equal(plan(t).days[1].water.base, 2700);
  assert.equal(plan({ ...t, personalWater: true, weight: 90, climate: 'hot' }).days[1].water.base, 3900);
  assert.equal(plan({ ...t, alcohol: 2 }).days[1].water.base, 3200);
});

test('return trip undoes only what the body adjusted', () => {
  const trip = { ...BASE, home: 'code:JFK', dest: 'code:LHR', ret: true, retTime: '17:00', retDurH: 8, retDurM: 0 };
  const out = buildPlan(trip);
  const full = buildReturnPlan({ ...trip, retDate: '2026-12-09' }, out);
  assert.equal(full.adjustedBeforeReturn, 5);
  assert.equal(full.target, -5);
  const partial = buildReturnPlan({ ...trip, retDate: '2026-12-04' }, out);
  assert.equal(partial.adjustedBeforeReturn, 2);
  const stayedHome = buildReturnPlan({ ...trip, retDate: '2026-12-04', strategy: 'home' }, buildPlan({ ...trip, strategy: 'home' }));
  assert.equal(stayedHome.strategy, 'none');
});

test('return trip rejects a date before arrival', () => {
  const trip = { ...BASE, home: 'code:JFK', dest: 'code:LHR', ret: true, retDate: '2026-11-20', retTime: '17:00' };
  assert.ok(buildReturnPlan(trip, buildPlan(trip)).error);
  assert.equal(buildReturnPlan({ ...trip, ret: false }, buildPlan(trip)), null);
});
