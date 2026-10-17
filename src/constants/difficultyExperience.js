const difficultyExperienceBases = {
  easy: 100,
  normal: 150,
  hard: 225,
  expert: 338,
};
const maxExperienceRequirement = Number.MAX_SAFE_INTEGER;

function experienceForDifficultyLevel(level, difficulty = 'easy') {
  const targetLevel = Math.max(1, Math.min(100, Number(level) || 1));
  let requirement = difficultyExperienceBases[difficulty] || difficultyExperienceBases.easy;
  for (let currentLevel = 1; currentLevel < targetLevel; currentLevel += 1) {
    requirement = Math.min(maxExperienceRequirement, Math.round(requirement * 1.5));
  }
  return targetLevel === 100 ? 0 : requirement;
}

function buildDifficultyExperienceSeeds() {
  return Object.keys(difficultyExperienceBases).flatMap((difficulty) => (
    Array.from({ length: 100 }, (_, index) => ({
      difficulty,
      level: index + 1,
      experience_to_next_level: experienceForDifficultyLevel(index + 1, difficulty),
    }))
  ));
}

module.exports = {
  difficultyExperienceBases,
  experienceForDifficultyLevel,
  buildDifficultyExperienceSeeds,
};
