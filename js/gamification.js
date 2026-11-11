import { getUserStats, updateUserStats, getTodayDateString, db } from './db.js';

export const XP_VALUES = {
  NODE_CREATED: 10,
  NODE_COMPLETED: 20,
  LESSON_CREATED: 10,
  QUIZ_COMPLETED: 15,
  QUIZ_PERFECT: 10,
  FLASHCARD_REVIEWED: 5
};

export const LEVEL_TIERS = [
  { level: 1, name: 'Apprentice Scribe', minXP: 0, maxXP: 99 },
  { level: 2, name: 'Journeyman Scholar', minXP: 100, maxXP: 249 },
  { level: 3, name: 'Field Researcher', minXP: 250, maxXP: 499 },
  { level: 4, name: 'Archival Master', minXP: 500, maxXP: 999 },
  { level: 5, name: 'Grand Synthesizer', minXP: 1000, maxXP: 1999 },
  { level: 6, name: 'Curator Emeritus', minXP: 2000, maxXP: Infinity }
];

export const BADGE_DEFINITIONS = [
  {
    id: 'first_roadmap',
    title: 'First Cartography',
    category: 'Cartography',
    desc: 'Inscribed your first learning roadmap into the archive.',
    icon: '🗺️',
    check: async (stats, counts) => (counts.roadmaps || 0) >= 1
  },
  {
    id: 'first_node_done',
    title: 'Pencil on Paper',
    category: 'Milestone',
    desc: 'Completed and verified your first roadmap topic.',
    icon: '✏️',
    check: async (stats, counts) => (counts.completedNodes || 0) >= 1
  },
  {
    id: 'first_lesson',
    title: 'First Inscription',
    category: 'Curriculum',
    desc: 'Ingested and generated your first synthesized lesson.',
    icon: '📖',
    check: async (stats, counts) => (counts.lessons || 0) >= 1
  },
  {
    id: 'first_quiz',
    title: 'Field Examination',
    category: 'Testing',
    desc: 'Tested your knowledge by completing a lesson quiz.',
    icon: '📝',
    check: async (stats, counts) => (counts.completedQuizzes || 0) >= 1
  },
  {
    id: 'perfect_score',
    title: 'Flawless Recitation',
    category: 'Testing',
    desc: 'Achieved a perfect 100% score on a lesson quiz.',
    icon: '🎯',
    check: async (stats, counts) => (counts.perfectQuizzes || 0) >= 1
  },
  {
    id: 'streak_3',
    title: 'Field Dedication',
    category: 'Streak',
    desc: 'Maintained an unbroken 3-day learning streak.',
    icon: '🔥',
    check: async (stats) => (stats.streakCount || 0) >= 3
  },
  {
    id: 'streak_7',
    title: 'Master Archivist',
    category: 'Streak',
    desc: 'Maintained an unbroken 7-day learning streak.',
    icon: '⚡',
    check: async (stats) => (stats.streakCount || 0) >= 7
  },
  {
    id: 'cards_10',
    title: 'Mnemonic Scholar',
    category: 'Memory',
    desc: 'Conducted 10 spaced repetition flashcard reviews.',
    icon: '🗂️',
    check: async (stats, counts) => (counts.reviewedFlashcards || 0) >= 10
  },
  {
    id: 'cards_50',
    title: 'Iron Memory',
    category: 'Memory',
    desc: 'Conducted 50 spaced repetition flashcard reviews.',
    icon: '🧠',
    check: async (stats, counts) => (counts.reviewedFlashcards || 0) >= 50
  },
  {
    id: 'xp_100',
    title: 'Centurion Scholar',
    category: 'Rank',
    desc: 'Accumulated 100 lifetime knowledge XP.',
    icon: '🥉',
    check: async (stats) => (stats.totalXP || 0) >= 100
  },
  {
    id: 'xp_500',
    title: 'Distinguished Scribe',
    category: 'Rank',
    desc: 'Accumulated 500 lifetime knowledge XP.',
    icon: '🥈',
    check: async (stats) => (stats.totalXP || 0) >= 500
  },
  {
    id: 'xp_1000',
    title: 'Grand Synthesizer',
    category: 'Rank',
    desc: 'Accumulated 1,000 lifetime knowledge XP.',
    icon: '🥇',
    check: async (stats) => (stats.totalXP || 0) >= 1000
  },
  {
    id: 'nodes_10',
    title: 'Expedition Master',
    category: 'Cartography',
    desc: 'Completed and verified 10 roadmap topics.',
    icon: '🧭',
    check: async (stats, counts) => (counts.completedNodes || 0) >= 10
  }
];

/**
 * Calculates level details from total XP
 */
export function getLevelDetails(totalXP = 0) {
  let currentTier = LEVEL_TIERS[0];
  let nextTier = LEVEL_TIERS[1];

  for (let i = 0; i < LEVEL_TIERS.length; i++) {
    if (totalXP >= LEVEL_TIERS[i].minXP && totalXP <= LEVEL_TIERS[i].maxXP) {
      currentTier = LEVEL_TIERS[i];
      nextTier = LEVEL_TIERS[i + 1] || null;
      break;
    }
  }

  let progress = 100;
  let xpIntoLevel = totalXP - currentTier.minXP;
  let xpNeededForNext = 0;

  if (nextTier) {
    const range = nextTier.minXP - currentTier.minXP;
    progress = Math.min(100, Math.max(0, Math.round((xpIntoLevel / range) * 100)));
    xpNeededForNext = nextTier.minXP - totalXP;
  }

  return {
    level: currentTier.level,
    title: currentTier.name,
    currentXP: totalXP,
    minXP: currentTier.minXP,
    maxXP: currentTier.maxXP,
    nextTier,
    progressPercentage: progress,
    xpNeededForNext
  };
}

/**
 * Evaluates and updates daily streak
 */
export function evaluateDailyStreak(lastActiveDate, currentStreak = 0) {
  const today = getTodayDateString();

  if (!lastActiveDate) {
    return { streak: 1, updated: true, isNewDay: true };
  }

  if (lastActiveDate === today) {
    return { streak: Math.max(1, currentStreak), updated: false, isNewDay: false };
  }

  // Calculate day difference
  const lastDate = new Date(lastActiveDate + 'T00:00:00');
  const currDate = new Date(today + 'T00:00:00');
  const diffTime = currDate.getTime() - lastDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    // Consecutive day
    return { streak: currentStreak + 1, updated: true, isNewDay: true };
  } else if (diffDays > 1) {
    // Missed at least one day, reset to 1
    return { streak: 1, updated: true, isNewDay: true };
  }

  return { streak: currentStreak, updated: false, isNewDay: false };
}

/**
 * Awards XP and checks for badges + streak update
 */
export async function awardXP(amount, reason = '') {
  const stats = await getUserStats();
  const today = getTodayDateString();

  // Evaluate streak
  const streakResult = evaluateDailyStreak(stats.lastActiveDate, stats.streakCount);
  const newStreak = streakResult.streak;
  const newXP = (stats.totalXP || 0) + amount;

  const updatedStats = {
    ...stats,
    totalXP: newXP,
    streakCount: newStreak,
    lastActiveDate: today
  };

  // Evaluate badges
  const newBadges = await evaluateBadges(updatedStats);
  updatedStats.badges = newBadges;

  await updateUserStats(updatedStats);

  // Trigger global notification event
  window.dispatchEvent(new CustomEvent('xp-awarded', {
    detail: {
      amount,
      reason,
      totalXP: newXP,
      streak: newStreak
    }
  }));

  return {
    awardedXP: amount,
    totalXP: newXP,
    streak: newStreak,
    badges: newBadges
  };
}

/**
 * Check badges condition against db records
 */
export async function evaluateBadges(stats) {
  const currentBadges = Array.isArray(stats.badges) ? [...stats.badges] : [];
  const currentBadgeIds = new Set(currentBadges.map(b => (typeof b === 'string' ? b : b.id)));

  // Query counts for checks
  const roadmapsCount = await db.roadmaps.count();
  const nodes = await db.nodes.toArray();
  const completedNodesCount = nodes.filter(n => n.status === 'completed').length;
  const lessons = await db.lessons.toArray();
  const completedQuizzesCount = lessons.filter(l => l.completed).length;
  const perfectQuizzesCount = lessons.filter(l => l.score === 100).length;
  const allCards = await db.flashcards.toArray();
  // We can track card reviews via interval > 1 or stored stats
  const reviewedCardsCount = allCards.filter(c => (c.intervalDays || 1) > 1).length;

  const counts = {
    roadmaps: roadmapsCount,
    nodes: nodes.length,
    completedNodes: completedNodesCount,
    lessons: lessons.length,
    completedQuizzes: completedQuizzesCount,
    perfectQuizzes: perfectQuizzesCount,
    reviewedFlashcards: reviewedCardsCount
  };

  const unlockedNow = [];

  for (const def of BADGE_DEFINITIONS) {
    if (!currentBadgeIds.has(def.id)) {
      const isUnlocked = await def.check(stats, counts);
      if (isUnlocked) {
        const badgeRecord = {
          id: def.id,
          unlockedAt: new Date().toISOString()
        };
        currentBadges.push(badgeRecord);
        currentBadgeIds.add(def.id);
        unlockedNow.push(def);
      }
    }
  }

  // If any new badges unlocked, dispatch event
  if (unlockedNow.length > 0) {
    unlockedNow.forEach(badge => {
      window.dispatchEvent(new CustomEvent('badge-unlocked', { detail: badge }));
    });
  }

  return currentBadges;
}

/**
 * SuperMemo SM-2 inspired Spaced Repetition calculation
 * quality: 'hard' | 'good' | 'easy'
 */
export function calculateSrsInterval(currentInterval = 1, quality = 'good') {
  let nextInterval = 1;

  if (quality === 'hard') {
    nextInterval = 1; // Due tomorrow
  } else if (quality === 'good') {
    nextInterval = Math.max(2, Math.round(currentInterval * 1.8));
  } else if (quality === 'easy') {
    nextInterval = Math.max(4, Math.round(currentInterval * 2.5));
  }

  // Calculate next due date
  const now = new Date();
  now.setDate(now.getDate() + nextInterval);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dueAt = `${year}-${month}-${day}`;

  return {
    intervalDays: nextInterval,
    dueAt
  };
}
