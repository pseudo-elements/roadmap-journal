import { initGamification, getAllRoadmaps, getNodesByRoadmap, createLesson, createFlashcard } from './db.js';
import { HashRouter } from './router.js';
import { getAvailablePresets, importRoadmapJson } from './roadmapImporter.js';

// Views
import { renderHomeView } from './views/homeView.js';
import { renderRoadmapView } from './views/roadmapView.js';
import { renderTopicView } from './views/topicView.js';
import { renderLessonView } from './views/lessonView.js';
import { renderProgressView } from './views/progressView.js';
import { renderChallengesView } from './views/challengesView.js';

/**
 * Route Definitions conforming strictly to specifications:
 * - /#/ — Homepage (Roadmaps list & roadmap creation)
 * - /#/roadmap/:id — Topics/Nodes view & topic creation
 * - /#/roadmap/:id/topic/:topicId — Lessons list view for a given topic
 * - /#/roadmap/:id/topic/:topicId/lesson/:lessonId — Lesson reading view & interactive quiz
 * - /#/progress — Overview of streaks, total XP, unlocked badges, and stats
 * - /#/progress/challenges — Spaced Repetition Flashcards (SRS) & daily challenge queue
 */
const routes = [
  { pattern: '/', handler: renderHomeView },
  { pattern: '/roadmap/:id', handler: renderRoadmapView },
  { pattern: '/roadmap/:id/topic/:topicId', handler: renderTopicView },
  { pattern: '/roadmap/:id/topic/:topicId/lesson/:lessonId', handler: renderLessonView },
  { pattern: '/progress', handler: renderProgressView },
  { pattern: '/progress/challenges', handler: renderChallengesView }
];

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
  const rootElement = document.getElementById('app-root');

  // Initialize theme
  initTheme();

  // Initialize database and gamification store
  await initGamification();

  // Initial Seed: If first time opening and database has no roadmaps, seed with Frontend preset & demo lesson
  const existingRoadmaps = await getAllRoadmaps();
  if (existingRoadmaps.length === 0) {
    const defaultPreset = getAvailablePresets()[0];
    if (defaultPreset) {
      const created = await importRoadmapJson(defaultPreset);
      await seedDemoLessonAndFlashcards(created.id);
    }
  }

  // Initialize Router
  const router = new HashRouter(routes, rootElement);
  router.init();

  // Setup Global Notification Listeners (XP & Badges)
  setupNotificationListeners();
});

/**
 * Theme Management (Stationery Light vs. Blueprint Slate Dark)
 * Note: Only the theme string ('light'|'dark') is saved to localStorage.
 * STRICT ARCHITECTURAL RULE: No API keys or credentials in storage.
 */
function initTheme() {
  const themeToggleBtn = document.getElementById('btn-theme-toggle');
  const themeIcon = document.getElementById('theme-icon');
  const savedTheme = localStorage.getItem('roadmap_journal_theme') || 'light';

  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme, themeIcon);

  themeToggleBtn?.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('roadmap_journal_theme', nextTheme);
    updateThemeIcon(nextTheme, themeIcon);
  });
}

function updateThemeIcon(theme, iconEl) {
  if (iconEl) {
    iconEl.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
}

/**
 * Global Notifications & Toast System
 */
function setupNotificationListeners() {
  // Listen for XP awards
  window.addEventListener('xp-awarded', (e) => {
    const { amount, reason } = e.detail || {};
    showToast({
      icon: '⚡',
      title: `+${amount} Knowledge XP`,
      message: reason || 'Archival progress verified'
    });
  });

  // Listen for Badge unlocks
  window.addEventListener('badge-unlocked', (e) => {
    const badge = e.detail || {};
    showToast({
      icon: badge.icon || '🎖️',
      title: `Seal Unlocked: ${badge.title}`,
      message: badge.desc || 'Milestone achieved and inscribed!',
      duration: 5000
    });
  });
}

export function showToast({ icon = '📜', title = '', message = '', duration = 3500 }) {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;

  const toast = document.createElement('div');
  toast.className = 'archival-toast';
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <div class="toast-body">
      <span class="toast-title">${escapeHtml(title)}</span>
      <span class="toast-msg">${escapeHtml(message)}</span>
    </div>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, duration);
}

async function seedDemoLessonAndFlashcards(roadmapId) {
  try {
    const nodes = await getNodesByRoadmap(roadmapId);
    if (!nodes || nodes.length === 0) return;

    const firstNode = nodes[0];

    // Seed initial synthesized lesson folio
    await createLesson({
      nodeId: firstNode.id,
      title: 'DOM Rendering Pipeline & Critical Rendering Path',
      shortDescription: 'How browser engines transform raw network bytes into interactive pixel rasterizations.',
      citation: 'Section 01 // 00:00 - 18:30',
      status: 'synthesized',
      order: 1,
      sourceUrl: 'https://developer.mozilla.org/en-US/docs/Web/Performance/Critical_rendering_path',
      summary: 'An authoritative analysis of how browser engines transform raw bytes over the wire into interactive pixel rasterizations across the DOM, CSSOM, Render Tree, Layout, and Compositing pipelines.',
      keyTakeaways: [
        'DOM construction is incremental; CSSOM construction is strictly render-blocking.',
        'Script tags without defer or async immediately block the HTML tokenizer.',
        'Layout (Reflow) computes geometry; Paint draws pixels; Compositor renders independent GPU layers.',
        'Transform and opacity animations avoid Layout and Paint entirely, executing on the GPU compositor thread.'
      ],
      lessons: [
        {
          sectionTitle: 'Phase 1: Bytes to Object Models (DOM & CSSOM)',
          content: 'When an HTTP response arrives, the browser engine processes raw bytes through four discrete transformation phases: Bytes → Characters → Tokens → Nodes → DOM Tree. Concurrently, linked external stylesheets are downloaded and parsed into the CSS Object Model (CSSOM). Crucially, while HTML can be parsed incrementally as network chunks stream in, CSSOM parsing requires the complete CSS document before styles can cascade correctly without visual artifacts.',
          codeSnippet: `// Critical Rendering Path Sequence:
// 1. HTML Bytes -> Tokens -> DOM Nodes -> DOM Tree
// 2. CSS Bytes  -> Tokens -> Style Rules -> CSSOM Tree
// 3. DOM + CSSOM -> Render Tree (Visible nodes only)
// 4. Layout (Reflow): Calculate (x, y, width, height) coordinates
// 5. Paint & Composite: Rasterize layer textures to GPU framebuffers`
        },
        {
          sectionTitle: 'Phase 2: Render Tree Construction & Layout Thrashing',
          content: 'The browser combines the DOM and CSSOM trees into a unified Render Tree. The Render Tree only includes elements that will physically appear on screen, ignoring <head>, <script>, and any element styled with display: none. Next, the Layout phase computes exact pixel coordinates relative to the device viewport. Inadvertently reading geometry properties (like offsetHeight or getBoundingClientRect) immediately after writing to the DOM forces synchronous layout thrashing, severely degrading framerates.',
          codeSnippet: `// Anti-Pattern: Layout Thrashing
for (let i = 0; i < elements.length; i++) {
  // Reading geometry forces instantaneous synchronous reflow!
  const width = container.offsetWidth; 
  elements[i].style.width = width + 'px';
}

// Optimized: Batch reads first, then batch writes
const width = container.offsetWidth;
for (let i = 0; i < elements.length; i++) {
  elements[i].style.width = width + 'px';
}`
        }
      ],
      quiz: [
        {
          question: 'Which network resource strictly blocks initial page rendering until its object model is fully parsed?',
          options: [
            'Asynchronous image downloads (<img loading="lazy">)',
            'External stylesheets linked via <link rel="stylesheet">',
            'Inline vector SVG definitions',
            'Font files declared with font-display: swap'
          ],
          correctAnswerIndex: 1,
          explanation: 'CSS is treated as a render-blocking resource. Browsers will not render visible pixels until the CSSOM is built to prevent Flash of Unstyled Content (FOUC).'
        },
        {
          question: 'Why does animating CSS "transform" achieve consistent 60fps performance compared to animating "left" or "top"?',
          options: [
            'Transform runs inside WebAssembly threads',
            'Transform mutations bypass Layout (Reflow) and Paint, executing directly on the GPU Compositor thread',
            'Transform converts CSSOM elements into pre-compressed SVG sprites',
            'Browsers treat transform as an immutable constant'
          ],
          correctAnswerIndex: 1,
          explanation: 'Transform and opacity adjustments do not affect geometric layout coordinates or surface rasterization; the browser hands them off to the GPU compositor layer, eliminating CPU layout recalculations.'
        },
        {
          question: 'What is the root cause of layout thrashing (forced synchronous layout)?',
          options: [
            'Interleaving DOM style writes with immediate geometric measurement reads',
            'Opening an IndexedDB transaction inside a setTimeout callback',
            'Using the fetch API inside an async function',
            'Declaring CSS custom properties on the :root element'
          ],
          correctAnswerIndex: 0,
          explanation: 'When JavaScript mutates the DOM and immediately queries layout properties (like offsetWidth), the browser cannot wait for the next scheduled frame; it is forced to synchronously recalculate layout on the spot.'
        }
      ],
      completed: false,
      score: null
    });

    // Seed progressive outlined lessons awaiting Stage 2 synthesis
    await createLesson({
      nodeId: firstNode.id,
      title: 'CSSOM Cascades, Specificity & Render-Blocking Rules',
      shortDescription: 'Deep dive into stylesheet cascades, CSSOM tree computation, and blocking behavior in the rendering pipeline.',
      citation: 'Section 02 // 18:30 - 36:15',
      status: 'outline',
      order: 2,
      sourceUrl: 'https://developer.mozilla.org/en-US/docs/Web/Performance/Critical_rendering_path',
      summary: '',
      keyTakeaways: [],
      lessons: [],
      quiz: [],
      completed: false,
      score: null
    });

    await createLesson({
      nodeId: firstNode.id,
      title: 'Layout Thrashing, Composite Layers & GPU Acceleration',
      shortDescription: 'Mitigating forced synchronous reflow, creating composite layers, and profiling GPU composited animations.',
      citation: 'Section 03 // 36:15 - 58:00',
      status: 'outline',
      order: 3,
      sourceUrl: 'https://developer.mozilla.org/en-US/docs/Web/Performance/Critical_rendering_path',
      summary: '',
      keyTakeaways: [],
      lessons: [],
      quiz: [],
      completed: false,
      score: null
    });

    // Seed corresponding spaced repetition flashcards
    await createFlashcard({
      nodeId: firstNode.id,
      front: 'What are the 5 sequential stages of the browser Critical Rendering Path?',
      back: '1. DOM Tree Construction\n2. CSSOM Tree Construction\n3. Render Tree Generation\n4. Layout (Reflow)\n5. Paint & Compositing',
      intervalDays: 1
    });

    await createFlashcard({
      nodeId: firstNode.id,
      front: 'What is the operational difference between "async" and "defer" script attributes?',
      back: '"async" downloads asynchronously and executes immediately when ready (potentially pausing DOM parsing). "defer" downloads asynchronously and executes in order only after HTML parsing is complete.',
      intervalDays: 1
    });

    await createFlashcard({
      nodeId: firstNode.id,
      front: 'Which CSS properties can be animated without triggering Layout or Paint?',
      back: '"transform" and "opacity" can be manipulated directly by the GPU compositor layer without triggering Reflow or Repaint cycles.',
      intervalDays: 1
    });
  } catch (err) {
    console.warn('Initial demo lesson seeding skipped:', err);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m];
  });
}
