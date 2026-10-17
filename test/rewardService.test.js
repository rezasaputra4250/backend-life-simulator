const test = require('node:test');
const assert = require('node:assert/strict');
const { recordMissionReward } = require('../src/services/rewardService');

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
  assert.match(connection.calls[2].sql, /FOR UPDATE/);
  assert.equal(connection.calls[3].params[1], 100);
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
