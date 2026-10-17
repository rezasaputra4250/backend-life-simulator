const test = require('node:test');
const assert = require('node:assert/strict');
const { recordMissionReward, recordGuildContributionReward, reverseMissionExperience } = require('../src/services/rewardService');

function fakeConnection(results) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      return results.shift() || [{ affectedRows: 0 }, []];
    },
  };
}

test('records XP reward and delegates progression to the shared service', async () => {
  const connection = fakeConnection([
    [{ affectedRows: 1 }, []],
    [{ affectedRows: 1 }, []],
    [{ affectedRows: 1 }, []],
    [[{ level: 1, experience: 0 }], []],
    [{ affectedRows: 1 }, []],
    [{ affectedRows: 1 }, []],
  ]);

  const result = await recordMissionReward(connection, 7, {
    id: 12,
    title: 'Fokus kerja',
    reward: 100,
    reward_type: 'xp',
    reward_name: '100 XP',
    grant_player_experience: 1,
  });

  assert.equal(result.granted, true);
  assert.equal(result.progression.amount, 100);
  assert.match(connection.calls[3].sql, /FOR UPDATE/);
  assert.equal(connection.calls[4].params[1], 100);
});

test('does not update Player EXP for non-XP rewards', async () => {
  const connection = fakeConnection([
    [{ affectedRows: 1 }, []],
    [{ affectedRows: 1 }, []],
  ]);

  const result = await recordMissionReward(connection, 7, {
    id: 13,
    title: 'Latihan pagi',
    reward: 25,
    reward_type: 'item',
    reward_name: 'Potion Energi',
    grant_player_experience: 1,
  });

  assert.equal(result.granted, true);
  assert.equal(result.progression.amount, 0);
  assert.equal(connection.calls.length, 2);
});

test('treats duplicate reward insert as idempotent', async () => {
  const connection = fakeConnection([[{ affectedRows: 0 }, []]]);
  const result = await recordMissionReward(connection, 7, {
    id: 12,
    title: 'Fokus kerja',
    reward: 100,
    reward_type: 'xp',
    reward_name: '100 XP',
    grant_player_experience: 1,
  });

  assert.equal(result.granted, false);
  assert.equal(result.progression.amount, 0);
  assert.equal(connection.calls.length, 1);
});

test('keeps guild contribution EXP disabled unless explicitly configured', async () => {
  const connection = fakeConnection([[{ affectedRows: 1 }, []]]);
  const result = await recordGuildContributionReward(connection, 7, {
    id: 21,
    title: 'Target guild',
    grant_player_experience: 0,
  }, 50);

  assert.equal(result.amount, 0);
  assert.equal(connection.calls.length, 1);
});

test('grants explicit guild contribution EXP through progression service', async () => {
  const connection = fakeConnection([
    [{ affectedRows: 1 }, []],
    [{ affectedRows: 1 }, []],
    [[{ level: 1, experience: 0 }], []],
    [{ affectedRows: 1 }, []],
    [{ affectedRows: 1 }, []],
  ]);
  const result = await recordGuildContributionReward(connection, 7, {
    id: 22,
    title: 'Target guild',
    grant_player_experience: 1,
  }, 50);

  assert.equal(result.amount, 50);
  assert.equal(connection.calls.length, 5);
});

test('records mission EXP correction as a negative ledger transaction', async () => {
  const connection = fakeConnection([
    [{ affectedRows: 1 }, []],
    [[{ level: 2, experience: 100 }], []],
    [{ affectedRows: 1 }, []],
    [{ affectedRows: 1 }, []],
  ]);
  const result = await reverseMissionExperience(connection, 7, {
    id: 31,
    title: 'Fokus kerja',
    reward_type: 'xp',
  }, 50);

  assert.equal(result.amount, -50);
  assert.match(connection.calls[2].sql, /UPDATE user_stats/);
  assert.equal(connection.calls[2].params[1], 50);
});
