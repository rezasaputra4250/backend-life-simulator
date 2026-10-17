const { grantExperience } = require('./progressionService');

async function recordMissionReward(connection, userId, mission) {
  const amount = mission.reward_type === 'xp' ? Number(mission.reward || 0) : 1;
  const [rewardResult] = await connection.query(
    `INSERT INTO user_rewards
       (user_id, mission_id, reward_type, reward_name, amount)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE deleted_at = NULL, amount = VALUES(amount)`,
    [userId, mission.id, mission.reward_type, mission.reward_name || `${amount} XP`, amount]
  );

  if (!rewardResult.affectedRows) {
    return { granted: false, progression: { amount: 0, levelUp: false } };
  }

  await connection.query(
    `INSERT IGNORE INTO reward_transactions
       (user_id, source_type, source_id, reward_type, amount)
     VALUES (?, 'mission', ?, ?, ?)`,
    [userId, mission.id, mission.reward_type, amount]
  );

  const progression = mission.reward_type === 'xp' && mission.grant_player_experience !== 0
    ? await grantExperience(connection, userId, amount, 'mission', mission.title, {
      sourceId: mission.id,
      idempotencyKey: `mission:${mission.id}:xp`,
    })
    : { amount: 0, levelUp: false };

  return { granted: true, progression };
}

async function recordGuildContributionReward(connection, userId, mission, amount) {
  const rewardAmount = Math.max(0, Number(amount) || 0);
  const [rewardResult] = await connection.query(
    `INSERT IGNORE INTO reward_transactions
       (user_id, source_type, source_id, reward_type, amount)
     VALUES (?, 'guild_mission_contribution', ?, 'xp', ?)`,
    [userId, mission.id, rewardAmount]
  );

  if (!rewardResult.affectedRows || !mission.grant_player_experience) {
    return { granted: false, amount: 0, duplicate: !rewardResult.affectedRows };
  }

  const progression = await grantExperience(connection, userId, rewardAmount, 'guild_mission', mission.title, {
    sourceId: mission.id,
    idempotencyKey: `guild_mission:${mission.id}:user:${userId}`,
  });

  return { granted: progression.amount > 0, amount: progression.amount, progression };
}

module.exports = { recordMissionReward, recordGuildContributionReward };
