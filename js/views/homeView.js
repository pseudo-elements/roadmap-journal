import { getAllRoadmaps, getNodesByRoadmap, createRoadmap, deleteRoadmap, getUserStats } from '../db.js';
import { awardXP, XP_VALUES, getLevelDetails } from '../gamification.js';
import { getAvailablePresets, importRoadmapJson } from '../roadmapImporter.js';

export async function renderHomeView(container, { router }) {
  const [roadmaps, stats] = await Promise.all([
    getAllRoadmaps(),
    getUserStats()
  ]);

  // Compute completion stats for each roadmap
  const roadmapsWithStats = await Promise.all(
    roadmaps.map(async (rm) => {
      const nodes = await getNodesByRoadmap(rm.id);
      const total = nodes.length;
      const completed = nodes.filter(n => n.status === 'completed').length;
      const inProgress = nodes.filter(n => n.status === 'in_progress').length;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
      return {
        ...rm,
        totalNodes: total,
        completedNodes: completed,
        inProgressNodes: inProgress,
        percentage
      };
    })
  );

  const totalCompletedTopics = roadmapsWithStats.reduce((sum, r) => sum + r.completedNodes, 0);
  const levelInfo = getLevelDetails(stats.totalXP);

  container.innerHTML = `
    <div class="field-container page-home">
      <!-- Ledger Header & Scholar Status -->
      <header class="folio-header">
        <div class="header-left">
          <div class="field-stamp">[ARCHIVAL FIELD REGISTER // VOL. 2026]</div>
          <h1 class="display-title">Personal Roadmaps & Curriculum Folio</h1>
          <p class="editorial-subtitle">A tactile, client-side ledger for self-directed technical research, deliberate practice, and archival mastery.</p>
        </div>
        <div class="header-right">
          <div class="stat-pills-row">
            <div class="stat-pill">
              <span class="stat-icon">🔥</span>
              <div class="stat-meta">
                <span class="stat-num">${stats.streakCount || 0}</span>
                <span class="stat-lbl">Day Streak</span>
              </div>
            </div>
            <div class="stat-pill">
              <span class="stat-icon">⚡</span>
              <div class="stat-meta">
                <span class="stat-num">${stats.totalXP || 0}</span>
                <span class="stat-lbl">Total XP</span>
              </div>
            </div>
            <div class="stat-pill">
              <span class="stat-icon">🎖️</span>
              <div class="stat-meta">
                <span class="stat-num">Lvl ${levelInfo.level}</span>
                <span class="stat-lbl">${levelInfo.title}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- Ledger Action Bar -->
      <div class="action-bar-strip">
        <div class="action-bar-left">
          <span class="monospace-tag">[ACTIVE VOLUMES: ${roadmaps.length}]</span>
          <span class="monospace-tag">[MASTERED TOPICS: ${totalCompletedTopics}]</span>
        </div>
        <div class="action-bar-right">
          <button id="btn-open-create-roadmap" class="btn btn-primary">
            <span class="btn-icon">+</span> Inscribe New Roadmap
          </button>
          <button id="btn-open-import-roadmap" class="btn btn-secondary">
            <span class="btn-icon">📥</span> Import from roadmap.sh / JSON
          </button>
        </div>
      </div>

      <!-- Roadmaps Grid or Empty State -->
      ${roadmapsWithStats.length === 0 ? renderEmptyState() : renderRoadmapsGrid(roadmapsWithStats)}

      <!-- Create Roadmap Modal Container -->
      <div id="modal-create-roadmap" class="field-modal-overlay" style="display: none;">
        <div class="field-modal-card">
          <div class="modal-tab-header">
            <span class="modal-tab-title">[NEW FIELD ROADMAP ENTRY]</span>
            <button class="btn-close-modal" id="btn-close-create-modal" aria-label="Close">✕</button>
          </div>
          <div class="modal-body">
            <h2 class="editorial-modal-title">Inscribe New Curriculum Volume</h2>
            <p class="modal-desc">Establish a new technical pathway in your archival journal.</p>
            <form id="form-create-roadmap" class="archival-form">
              <div class="form-group">
                <label for="new-rm-title" class="form-label">Roadmap Title *</label>
                <input type="text" id="new-rm-title" class="form-input ledger-line-input" placeholder="e.g. Distributed Database Engineering" required />
              </div>
              <div class="form-group">
                <label for="new-rm-category" class="form-label">Classification Category</label>
                <input type="text" id="new-rm-category" class="form-input ledger-line-input" placeholder="e.g. Systems, Web, Machine Learning, Theory" value="General" />
              </div>
              <div class="form-group">
                <label for="new-rm-desc" class="form-label">Field Description & Objective</label>
                <textarea id="new-rm-desc" class="form-textarea ledger-paper-area" rows="3" placeholder="Define the pedagogical goals, scope, and target competencies of this roadmap..."></textarea>
              </div>
              <div class="form-actions">
                <button type="button" class="btn btn-secondary" id="btn-cancel-create">Cancel</button>
                <button type="submit" class="btn btn-primary">Inscribe Into Archive</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Import Roadmap Modal Container -->
      <div id="modal-import-roadmap" class="field-modal-overlay" style="display: none;">
        <div class="field-modal-card field-modal-wide">
          <div class="modal-tab-header">
            <span class="modal-tab-title">[IMPORT ROADMAP // ROADMAP.SH / JSON]</span>
            <button class="btn-close-modal" id="btn-close-import-modal" aria-label="Close">✕</button>
          </div>
          <div class="modal-body">
            <div class="import-tabs-nav">
              <button class="tab-btn active" id="tab-btn-presets">Curated Presets</button>
              <button class="tab-btn" id="tab-btn-paste">Paste JSON or roadmap.sh Graph</button>
            </div>

            <!-- Tab 1: Presets -->
            <div id="tab-content-presets" class="tab-panel active">
              <p class="modal-desc">Select a pre-architected, authoritative curriculum ready for immediate study and ingestion:</p>
              <div class="presets-grid">
                ${getAvailablePresets().map(p => `
                  <div class="preset-card" data-preset-id="${p.id}">
                    <div class="preset-tag">[${p.category.toUpperCase()}]</div>
                    <h3 class="preset-title">${p.title}</h3>
                    <p class="preset-desc">${p.description}</p>
                    <div class="preset-footer">
                      <span class="preset-count">📝 ${p.nodes.length} Structured Topics</span>
                      <button class="btn btn-secondary btn-sm btn-load-preset" data-preset-id="${p.id}">Load Curriculum</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Tab 2: Custom Paste -->
            <div id="tab-content-paste" class="tab-panel" style="display: none;">
              <p class="modal-desc">Paste raw JSON exported from <code>roadmap.sh</code> or this application's backup format:</p>
              <textarea id="import-json-textarea" class="form-textarea code-editor-area" rows="10" placeholder='{ "title": "My Pathway", "nodes": [{ "title": "Topic 1" }, ...] }'></textarea>
              <div class="form-actions" style="margin-top: 1rem;">
                <button type="button" class="btn btn-secondary" id="btn-cancel-import">Cancel</button>
                <button type="button" class="btn btn-primary" id="btn-execute-import">Parse & Inscribe</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
  setupHomeEventListeners(container, router);
}

function renderEmptyState() {
  return `
    <div class="empty-folio-card">
      <div class="paper-clip-ornament">📎</div>
      <div class="field-stamp">[ARCHIVE EMPTY]</div>
      <h2 class="editorial-title">Your Field Journal Awaits Inscription</h2>
      <p class="editorial-desc">No curriculum volumes have been registered yet. Choose an option below to initiate your personal roadmap journal.</p>
      <div class="empty-action-group">
        <button class="btn btn-primary" id="btn-empty-create">
          <span class="btn-icon">✏️</span> Create Custom Roadmap
        </button>
        <button class="btn btn-secondary" id="btn-empty-import">
          <span class="btn-icon">📚</span> Load Curated Presets
        </button>
      </div>
    </div>
  `;
}

function renderRoadmapsGrid(roadmaps) {
  return `
    <div class="roadmaps-grid">
      ${roadmaps.map(rm => `
        <article class="roadmap-card" data-roadmap-id="${rm.id}">
          <div class="card-washi-tape"></div>
          <div class="roadmap-card-header">
            <div class="category-chip">[${(rm.category || 'General').toUpperCase()}]</div>
            <span class="card-date-stamp">${new Date(rm.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
          </div>

          <h2 class="roadmap-card-title">
            <a href="#/roadmap/${rm.id}" class="card-title-link">${escapeHtml(rm.title)}</a>
          </h2>

          <p class="roadmap-card-desc">${escapeHtml(rm.description || 'No detailed annotations provided.')}</p>

          <!-- Archival Progress Bar -->
          <div class="progress-section">
            <div class="progress-meta-row">
              <span class="progress-label">Mastery Verification:</span>
              <span class="progress-pct font-mono">${rm.percentage}% (${rm.completedNodes}/${rm.totalNodes})</span>
            </div>
            <div class="progress-track">
              <div class="progress-bar ${rm.percentage === 100 ? 'bar-complete' : ''}" style="width: ${rm.percentage}%;"></div>
            </div>
          </div>

          <div class="roadmap-card-footer">
            <a href="#/roadmap/${rm.id}" class="btn btn-secondary btn-sm">
              Explore Field Notes →
            </a>
            <button class="btn-delete-roadmap icon-btn" data-id="${rm.id}" title="Archive/Delete Roadmap">
              🗑️
            </button>
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function setupHomeEventListeners(container, router) {
  const createModal = container.querySelector('#modal-create-roadmap');
  const importModal = container.querySelector('#modal-import-roadmap');

  // Open Create Modal
  const openCreateBtns = container.querySelectorAll('#btn-open-create-roadmap, #btn-empty-create');
  openCreateBtns.forEach(btn => {
    btn?.addEventListener('click', () => {
      createModal.style.display = 'flex';
      container.querySelector('#new-rm-title')?.focus();
    });
  });

  // Open Import Modal
  const openImportBtns = container.querySelectorAll('#btn-open-import-roadmap, #btn-empty-import');
  openImportBtns.forEach(btn => {
    btn?.addEventListener('click', () => {
      importModal.style.display = 'flex';
    });
  });

  // Close Modals
  container.querySelector('#btn-close-create-modal')?.addEventListener('click', () => {
    createModal.style.display = 'none';
  });
  container.querySelector('#btn-cancel-create')?.addEventListener('click', () => {
    createModal.style.display = 'none';
  });
  container.querySelector('#btn-close-import-modal')?.addEventListener('click', () => {
    importModal.style.display = 'none';
  });
  container.querySelector('#btn-cancel-import')?.addEventListener('click', () => {
    importModal.style.display = 'none';
  });

  // Handle Create Form Submit
  const createForm = container.querySelector('#form-create-roadmap');
  createForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = container.querySelector('#new-rm-title').value.trim();
    const category = container.querySelector('#new-rm-category').value.trim() || 'General';
    const description = container.querySelector('#new-rm-desc').value.trim();

    if (!title) return;

    const newRoadmap = await createRoadmap({ title, category, description });
    await awardXP(XP_VALUES.NODE_CREATED, `Inscribed Roadmap: ${title}`);

    createModal.style.display = 'none';
    router.navigateTo(`/roadmap/${newRoadmap.id}`);
  });

  // Import Tabs Switcher
  const tabBtnPresets = container.querySelector('#tab-btn-presets');
  const tabBtnPaste = container.querySelector('#tab-btn-paste');
  const tabContentPresets = container.querySelector('#tab-content-presets');
  const tabContentPaste = container.querySelector('#tab-content-paste');

  tabBtnPresets?.addEventListener('click', () => {
    tabBtnPresets.classList.add('active');
    tabBtnPaste.classList.remove('active');
    tabContentPresets.style.display = 'block';
    tabContentPaste.style.display = 'none';
  });

  tabBtnPaste?.addEventListener('click', () => {
    tabBtnPaste.classList.add('active');
    tabBtnPresets.classList.remove('active');
    tabContentPaste.style.display = 'block';
    tabContentPresets.style.display = 'none';
  });

  // Curated Preset Load
  const presetBtns = container.querySelectorAll('.btn-load-preset');
  presetBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const presetId = btn.getAttribute('data-preset-id');
      const preset = getAvailablePresets().find(p => p.id === presetId);
      if (preset) {
        btn.textContent = 'Inscribing...';
        btn.disabled = true;
        try {
          const created = await importRoadmapJson(preset);
          importModal.style.display = 'none';
          router.navigateTo(`/roadmap/${created.id}`);
        } catch (err) {
          alert(`Import failed: ${err.message}`);
          btn.textContent = 'Load Curriculum';
          btn.disabled = false;
        }
      }
    });
  });

  // Custom JSON Import Execute
  container.querySelector('#btn-execute-import')?.addEventListener('click', async () => {
    const jsonText = container.querySelector('#import-json-textarea').value.trim();
    if (!jsonText) {
      alert('Please paste valid JSON roadmap data.');
      return;
    }

    try {
      const created = await importRoadmapJson(jsonText);
      importModal.style.display = 'none';
      router.navigateTo(`/roadmap/${created.id}`);
    } catch (err) {
      alert(`Import error: ${err.message}`);
    }
  });

  // Delete Roadmap handlers
  const deleteBtns = container.querySelectorAll('.btn-delete-roadmap');
  deleteBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (confirm('Permanently purge this roadmap volume and all associated field notes, lessons, and flashcards?')) {
        await deleteRoadmap(id);
        renderHomeView(container, { router });
      }
    });
  });
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
