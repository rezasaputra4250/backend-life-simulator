const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateDailyStreak } = require('../src/controllers/missionController');

const day = (mission_date, completed_missions, total_missions = 2, failed_missions = 0) => ({
  today: '2026-10-18',
  mission_date,
  completed_missions,
  total_missions,
  failed_missions,
});

test('counts same-day completion as an active one-day streak', () => {
  assert.deepEqual(calculateDailyStreak([day('2026-10-18', 2)]), {
    streak_days: 1,
    last_completed_date: '2026-10-18',
    status: 'active',
  });
});

test('counts consecutive completed days', () => {
  assert.equal(calculateDailyStreak([
    day('2026-10-18', 2),
    day('2026-10-17', 2),
  ]).streak_days, 2);
});

test('does not bridge a skipped day', () => {
  assert.equal(calculateDailyStreak([
    day('2026-10-18', 2),
    day('2026-10-16', 2),
  ]).streak_days, 1);
});

test('marks a failed current day as broken', () => {
  assert.deepEqual(calculateDailyStreak([day('2026-10-18', 1, 2, 1)]), {
    streak_days: 0,
    last_completed_date: null,
    status: 'broken',
  });
});

test('keeps an incomplete current day pending', () => {
  assert.equal(calculateDailyStreak([day('2026-10-18', 1)]).status, 'pending');
});
