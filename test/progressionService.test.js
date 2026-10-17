const test = require('node:test');
const assert = require('node:assert/strict');
const { experienceForLevel, levelForExperience } = require('../src/services/progressionService');

test('uses progressive EXP requirements with stepwise rounding', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5].map(experienceForLevel),
    [100, 150, 225, 338, 507],
  );
});

test('supports multiple level-ups from cumulative EXP', () => {
  assert.equal(levelForExperience(100), 2);
  assert.equal(levelForExperience(250), 3);
  assert.equal(levelForExperience(1000), 5);
});
