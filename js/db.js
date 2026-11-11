import DexieFallback from 'https://cdn.jsdelivr.net/npm/dexie@3.2.4/dist/dexie.mjs';

const Dexie = (typeof window !== 'undefined' && window.Dexie) ? window.Dexie : DexieFallback;

/**
 * RoadmapTracker Database using Dexie.js
 * Tables:
 * - roadmaps: id, title, description, category, sourceUrl, createdAt
 * - nodes: id, roadmapId, title, status ('pending'|'in_progress'|'completed'), order, notes, updatedAt
 * - lessons: id, nodeId, sourceUrl, summary, keyTakeaways, lessons, quiz, completed, score, createdAt
 * - flashcards: id, nodeId, front, back, intervalDays, dueAt
 * - gamification: id ('user_stats'), streakCount, lastActiveDate, totalXP, badges
 */

export const db = new Dexie('RoadmapJournalDB');

db.version(1).stores({
  roadmaps: 'id, title, category, createdAt',
  nodes: 'id, roadmapId, title, status, order, updatedAt',
  lessons: 'id, nodeId, sourceUrl, completed, score, createdAt',
  flashcards: 'id, nodeId, intervalDays, dueAt',
  gamification: 'id'
});

// Helper to generate UUIDs
export function generateId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Format date helper (YYYY-MM-DD)
export function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * GAMIFICATION STORE HELPERS
 */
export async function initGamification() {
  let stats = await db.gamification.get('user_stats');
  if (!stats) {
    stats = {
      id: 'user_stats',
      streakCount: 0,
      lastActiveDate: null,
      totalXP: 0,
      badges: []
    };
    await db.gamification.put(stats);
  }
  return stats;
}

export async function getUserStats() {
  let stats = await db.gamification.get('user_stats');
  if (!stats) {
    stats = await initGamification();
  }
  return stats;
}

export async function updateUserStats(updates) {
  const stats = await getUserStats();
  const newStats = { ...stats, ...updates };
  await db.gamification.put(newStats);
  return newStats;
}

/**
 * ROADMAPS CRUD
 */
export async function getAllRoadmaps() {
  return await db.roadmaps.orderBy('createdAt').reverse().toArray();
}

export async function getRoadmap(id) {
  return await db.roadmaps.get(id);
}

export async function createRoadmap(data) {
  const roadmap = {
    id: data.id || generateId('rm'),
    title: data.title || 'Untitled Field Roadmap',
    description: data.description || '',
    category: data.category || 'General',
    sourceUrl: data.sourceUrl || '',
    createdAt: data.createdAt || new Date().toISOString()
  };
  await db.roadmaps.add(roadmap);
  return roadmap;
}

export async function updateRoadmap(id, data) {
  await db.roadmaps.update(id, data);
  return await db.roadmaps.get(id);
}

export async function deleteRoadmap(id) {
  // Cascading delete
  const nodes = await db.nodes.where({ roadmapId: id }).toArray();
  const nodeIds = nodes.map(n => n.id);

  if (nodeIds.length > 0) {
    await db.lessons.where('nodeId').anyOf(nodeIds).delete();
    await db.flashcards.where('nodeId').anyOf(nodeIds).delete();
    await db.nodes.where('roadmapId').equals(id).delete();
  }

  await db.roadmaps.delete(id);
  return true;
}

/**
 * TOPIC NODES CRUD
 */
export async function getNodesByRoadmap(roadmapId) {
  const nodes = await db.nodes.where({ roadmapId }).toArray();
  return nodes.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function getNode(id) {
  return await db.nodes.get(id);
}

export async function createNode(data) {
  const node = {
    id: data.id || generateId('node'),
    roadmapId: data.roadmapId,
    title: data.title || 'Untitled Topic',
    status: data.status || 'pending', // 'pending' | 'in_progress' | 'completed'
    order: typeof data.order === 'number' ? data.order : 0,
    notes: data.notes || '',
    updatedAt: new Date().toISOString()
  };
  await db.nodes.add(node);
  return node;
}

export async function updateNode(id, data) {
  const updates = { ...data, updatedAt: new Date().toISOString() };
  await db.nodes.update(id, updates);
  return await db.nodes.get(id);
}

export async function deleteNode(id) {
  await db.lessons.where({ nodeId: id }).delete();
  await db.flashcards.where({ nodeId: id }).delete();
  await db.nodes.delete(id);
  return true;
}

/**
 * LESSONS CRUD
 */
export async function getLessonsByNode(nodeId) {
  const lessons = await db.lessons.where({ nodeId }).toArray();
  return lessons.sort((a, b) => {
    if (typeof a.order === 'number' && typeof b.order === 'number' && a.order !== b.order) {
      return a.order - b.order;
    }
    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
  });
}

export async function getLesson(id) {
  return await db.lessons.get(id);
}

export async function createLesson(data) {
  const isSynthesized = Boolean(data.summary || (Array.isArray(data.lessons) && data.lessons.length > 0));
  const lesson = {
    id: data.id || generateId('les'),
    nodeId: data.nodeId,
    title: data.title || 'Lesson Synthesis',
    shortDescription: data.shortDescription || '',
    citation: data.citation || '',
    status: data.status || (isSynthesized ? 'synthesized' : 'outline'),
    order: typeof data.order === 'number' ? data.order : 0,
    sourceUrl: data.sourceUrl || '',
    rawSourceContext: data.rawSourceContext || '',
    summary: data.summary || '',
    keyTakeaways: Array.isArray(data.keyTakeaways) ? data.keyTakeaways : [],
    lessons: Array.isArray(data.lessons) ? data.lessons : [],
    quiz: Array.isArray(data.quiz) ? data.quiz : [],
    completed: Boolean(data.completed),
    score: typeof data.score === 'number' ? data.score : null,
    createdAt: data.createdAt || new Date().toISOString()
  };
  await db.lessons.add(lesson);
  return lesson;
}

export async function updateLesson(id, data) {
  await db.lessons.update(id, data);
  return await db.lessons.get(id);
}

export async function deleteLesson(id) {
  await db.lessons.delete(id);
  return true;
}

/**
 * FLASHCARDS CRUD & SRS
 */
export async function getFlashcardsByNode(nodeId) {
  return await db.flashcards.where({ nodeId }).toArray();
}

export async function getAllFlashcards() {
  return await db.flashcards.toArray();
}

export async function getDueFlashcards() {
  const today = getTodayDateString();
  const all = await db.flashcards.toArray();
  // Return cards where dueAt <= today
  return all.filter(c => !c.dueAt || c.dueAt <= today);
}

export async function createFlashcard(data) {
  const card = {
    id: data.id || generateId('card'),
    nodeId: data.nodeId,
    front: data.front || '',
    back: data.back || '',
    intervalDays: data.intervalDays || 1,
    dueAt: data.dueAt || getTodayDateString()
  };
  await db.flashcards.add(card);
  return card;
}

export async function updateFlashcard(id, data) {
  await db.flashcards.update(id, data);
  return await db.flashcards.get(id);
}

export async function deleteFlashcard(id) {
  await db.flashcards.delete(id);
  return true;
}

/**
 * BACKUP & RESTORE
 */
export async function exportDatabaseToJson() {
  const roadmaps = await db.roadmaps.toArray();
  const nodes = await db.nodes.toArray();
  const lessons = await db.lessons.toArray();
  const flashcards = await db.flashcards.toArray();
  const gamification = await db.gamification.toArray();

  return {
    version: 1,
    exportDate: new Date().toISOString(),
    data: {
      roadmaps,
      nodes,
      lessons,
      flashcards,
      gamification
    }
  };
}

export async function importDatabaseFromJson(backup) {
  if (!backup || !backup.data) {
    throw new Error('Invalid backup file format.');
  }

  const { roadmaps = [], nodes = [], lessons = [], flashcards = [], gamification = [] } = backup.data;

  await db.transaction('rw', [db.roadmaps, db.nodes, db.lessons, db.flashcards, db.gamification], async () => {
    await db.roadmaps.clear();
    await db.nodes.clear();
    await db.lessons.clear();
    await db.flashcards.clear();
    await db.gamification.clear();

    if (roadmaps.length) await db.roadmaps.bulkAdd(roadmaps);
    if (nodes.length) await db.nodes.bulkAdd(nodes);
    if (lessons.length) await db.lessons.bulkAdd(lessons);
    if (flashcards.length) await db.flashcards.bulkAdd(flashcards);
    if (gamification.length) await db.gamification.bulkAdd(gamification);
  });

  return true;
}

/**
 * STORAGE ESTIMATE HELPER
 */
export async function getStorageQuotaEstimate() {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      usageBytes: estimate.usage || 0,
      quotaBytes: estimate.quota || 0,
      usageFormatted: formatBytes(estimate.usage || 0),
      quotaFormatted: formatBytes(estimate.quota || 0),
      percentage: estimate.quota ? Math.round(((estimate.usage || 0) / estimate.quota) * 1000) / 10 : 0
    };
  }
  return {
    usageBytes: 0,
    quotaBytes: 0,
    usageFormatted: 'N/A',
    quotaFormatted: 'N/A',
    percentage: 0
  };
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
