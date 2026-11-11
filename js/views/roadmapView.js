import { getRoadmap, getNodesByRoadmap, updateRoadmap, deleteRoadmap, createNode, updateNode, deleteNode, getLessonsByNode } from '../db.js';
import { awardXP, XP_VALUES } from '../gamification.js';

export async function renderRoadmapView(container, { id, router }) {
  const roadmap = await getRoadmap(id);

  if (!roadmap) {
    container.innerHTML = `
      <div class="field-container error-panel">
        <h2 class="editorial-title">Volume Not Found</h2>
        <p>The requested roadmap volume [ID: ${escapeHtml(id)}] does not exist or was purged from the archive.</p>
        <button class="btn btn-primary" id="btn-back-home">Return to Field Index</button>
      </div>
    `;
    container.querySelector('#btn-back-home')?.addEventListener('click', () => router.navigateTo('/'));
    return;
  }

  const nodes = await getNodesByRoadmap(id);

  // Fetch lesson counts for each node
  const nodesWithLessons = await Promise.all(
    nodes.map(async (n) => {
      const lessons = await getLessonsByNode(n.id);
      return {
        ...n,
        lessonCount: lessons.length
      };
    })
  );

  const total = nodes.length;
  const completed = nodes.filter(n => n.status === 'completed').length;
  const inProgress = nodes.filter(n => n.status === 'in_progress').length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  container.innerHTML = `
    <div class="field-container page-roadmap">
      <!-- Breadcrumb Bar -->
      <nav class="archival-breadcrumb">
        <a href="#/" class="breadcrumb-link">← Field Index</a>
        <span class="breadcrumb-separator">/</span>
        <span class="breadcrumb-current">[VOL: ${escapeHtml(roadmap.category).toUpperCase()}] ${escapeHtml(roadmap.title)}</span>
      </nav>

      <!-- Roadmap Folio Header -->
      <header class="folio-header roadmap-header-card">
        <div class="header-tab-stamp">
          <span class="category-chip">[${escapeHtml(roadmap.category).toUpperCase()}]</span>
          <span class="field-stamp">[CATALOG ID: ${roadmap.id.slice(-6)}]</span>
        </div>

        <div class="roadmap-title-row">
          <h1 class="display-title">${escapeHtml(roadmap.title)}</h1>
          <div class="header-action-buttons">
            <button id="btn-edit-roadmap-meta" class="btn btn-secondary btn-sm" title="Edit Volume Info">
              ✎ Edit Info
            </button>
            <button id="btn-delete-this-roadmap" class="btn btn-secondary btn-sm" title="Purge Volume">
              Purge
            </button>
          </div>
        </div>

        <p class="editorial-subtitle">${escapeHtml(roadmap.description || 'No descriptive overview provided for this volume.')}</p>

        <!-- Progress Overview -->
        <div class="roadmap-summary-bar">
          <div class="progress-section" style="flex: 1;">
            <div class="progress-meta-row">
              <span class="progress-label">Mastery Verification Status:</span>
              <span class="progress-pct font-mono">${percentage}% (${completed}/${total} Topics Mastered)</span>
            </div>
            <div class="progress-track">
              <div class="progress-bar ${percentage === 100 ? 'bar-complete' : ''}" style="width: ${percentage}%;"></div>
            </div>
          </div>
          <div class="node-quick-stats font-mono">
            <span>[PENDING: ${total - completed - inProgress}]</span>
            <span>[IN PROGRESS: ${inProgress}]</span>
            <span>[VERIFIED: ${completed}]</span>
          </div>
        </div>
      </header>

      <!-- Action Strip: Add Node -->
      <div class="action-bar-strip">
        <div class="action-bar-left">
          <span class="monospace-tag">[CURRICULUM TOPICS: ${total}]</span>
        </div>
        <div class="action-bar-right">
          <button id="btn-open-add-node" class="btn btn-primary">
            <span class="btn-icon">+</span> Inscribe New Topic Node
          </button>
        </div>
      </div>

      <!-- Topics / Nodes Timeline Spine -->
      <section class="roadmap-nodes-timeline">
        ${nodesWithLessons.length === 0 ? renderEmptyNodesState() : renderNodesList(nodesWithLessons, id)}
      </section>

      <!-- Modal: Inscribe New Topic Node -->
      <div id="modal-add-node" class="field-modal-overlay" style="display: none;">
        <div class="field-modal-card">
          <div class="modal-tab-header">
            <span class="modal-tab-title">[INSCRIBE TOPIC NODE]</span>
            <button class="btn-close-modal" id="btn-close-node-modal" aria-label="Close">✕</button>
          </div>
          <div class="modal-body">
            <h2 class="editorial-modal-title">New Curriculum Topic Node</h2>
            <form id="form-add-node" class="archival-form">
              <div class="form-group">
                <label for="new-node-title" class="form-label">Topic Title *</label>
                <input type="text" id="new-node-title" class="form-input ledger-line-input" placeholder="e.g. Asynchronous Control Flow & Promises" required />
              </div>
              <div class="form-group">
                <label for="new-node-status" class="form-label">Initial Status</label>
                <select id="new-node-status" class="form-input ledger-line-input">
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed / Verified</option>
                </select>
              </div>
              <div class="form-group">
                <label for="new-node-notes" class="form-label">Field Notes / Objectives</label>
                <textarea id="new-node-notes" class="form-textarea ledger-paper-area" rows="3" placeholder="Key learning targets, references, or study questions..."></textarea>
              </div>
              <div class="form-actions">
                <button type="button" class="btn btn-secondary" id="btn-cancel-node">Cancel</button>
                <button type="submit" class="btn btn-primary">Inscribe Topic</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Modal: Edit Roadmap Metadata -->
      <div id="modal-edit-roadmap" class="field-modal-overlay" style="display: none;">
        <div class="field-modal-card">
          <div class="modal-tab-header">
            <span class="modal-tab-title">[EDIT ROADMAP METADATA]</span>
            <button class="btn-close-modal" id="btn-close-edit-modal" aria-label="Close">✕</button>
          </div>
          <div class="modal-body">
            <h2 class="editorial-modal-title">Amend Roadmap Volume</h2>
            <form id="form-edit-roadmap" class="archival-form">
              <div class="form-group">
                <label for="edit-rm-title" class="form-label">Roadmap Title *</label>
                <input type="text" id="edit-rm-title" class="form-input ledger-line-input" value="${escapeHtml(roadmap.title)}" required />
              </div>
              <div class="form-group">
                <label for="edit-rm-category" class="form-label">Category</label>
                <input type="text" id="edit-rm-category" class="form-input ledger-line-input" value="${escapeHtml(roadmap.category)}" />
              </div>
              <div class="form-group">
                <label for="edit-rm-desc" class="form-label">Description</label>
                <textarea id="edit-rm-desc" class="form-textarea ledger-paper-area" rows="3">${escapeHtml(roadmap.description || '')}</textarea>
              </div>
              <div class="form-actions">
                <button type="button" class="btn btn-secondary" id="btn-cancel-edit-rm">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;

  setupRoadmapEventListeners(container, roadmap, nodes, router);
}

function renderEmptyNodesState() {
  return `
    <div class="empty-folio-card">
      <div class="field-stamp">[NO TOPICS INSCRIBED]</div>
      <h3 class="editorial-title">Curriculum Spine is Empty</h3>
      <p class="editorial-desc">Begin structuring this volume by adding topic nodes using the button above.</p>
    </div>
  `;
}

function renderNodesList(nodes, roadmapId) {
  return `
    <div class="nodes-stream">
      ${nodes.map((node, index) => {
        const coordinate = String(index + 1).padStart(2, '0') + '.0';
        const isCompleted = node.status === 'completed';
        const isInProgress = node.status === 'in_progress';

        return `
          <article class="node-card ${isCompleted ? 'node-completed' : ''} ${isInProgress ? 'node-in-progress' : ''}" data-node-id="${node.id}">
            <!-- In-progress washi tape -->
            ${isInProgress ? '<div class="node-washi-tape">FOCUS TRACK</div>' : ''}

            <!-- Completed Rubber Stamp -->
            ${isCompleted ? '<div class="rubber-stamp-done">VERIFIED // DONE</div>' : ''}

            <div class="node-header">
              <div class="node-meta-left">
                <span class="node-coordinate font-mono">[NODE-${coordinate}]</span>
                <!-- Interactive Status Badge -->
                <button class="status-badge status-${node.status}" data-action="toggle-status" data-id="${node.id}" title="Click to cycle status (Pending → In Progress → Completed)">
                  ${renderStatusLabel(node.status)}
                </button>
              </div>

              <div class="node-meta-right">
                <a href="#/roadmap/${roadmapId}/topic/${node.id}" class="btn btn-secondary btn-sm btn-open-topic">
                  Dossier & Lessons (${node.lessonCount}) →
                </a>
              </div>
            </div>

            <div class="node-body">
              <h3 class="node-title">
                <a href="#/roadmap/${roadmapId}/topic/${node.id}" class="node-title-link">
                  ${escapeHtml(node.title)}
                </a>
              </h3>

              <!-- Collapsible / Editable Note Area -->
              <div class="node-notes-container">
                <div class="node-notes-header">
                  <span class="notes-header-label">Field Notes & Annotations:</span>
                  <button class="btn-save-inline-notes btn-link-action" data-id="${node.id}">
                    Save Notes
                  </button>
                </div>
                <textarea class="node-inline-textarea" data-id="${node.id}" rows="2" placeholder="Annotate thoughts, key insights, or questions for this node...">${escapeHtml(node.notes || '')}</textarea>
              </div>
            </div>

            <div class="node-footer">
              <div class="node-order-controls">
                <button class="btn-order-node" data-action="move-up" data-id="${node.id}" data-index="${index}" title="Move Up" ${index === 0 ? 'disabled' : ''}>▲</button>
                <button class="btn-order-node" data-action="move-down" data-id="${node.id}" data-index="${index}" title="Move Down" ${index === nodes.length - 1 ? 'disabled' : ''}>▼</button>
              </div>
              <button class="btn-delete-node icon-btn" data-id="${node.id}" title="Purge Topic Node">
                ✕ Remove Node
              </button>
            </div>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function renderStatusLabel(status) {
  switch (status) {
    case 'completed': return '✓ Completed';
    case 'in_progress': return '● In Progress';
    default: return '○ Pending';
  }
}

function setupRoadmapEventListeners(container, roadmap, nodes, router) {
  // Modal toggles
  const addNodeModal = container.querySelector('#modal-add-node');
  const editModal = container.querySelector('#modal-edit-roadmap');

  container.querySelector('#btn-open-add-node')?.addEventListener('click', () => {
    addNodeModal.style.display = 'flex';
    container.querySelector('#new-node-title')?.focus();
  });

  container.querySelector('#btn-close-node-modal')?.addEventListener('click', () => {
    addNodeModal.style.display = 'none';
  });
  container.querySelector('#btn-cancel-node')?.addEventListener('click', () => {
    addNodeModal.style.display = 'none';
  });

  container.querySelector('#btn-edit-roadmap-meta')?.addEventListener('click', () => {
    editModal.style.display = 'flex';
  });
  container.querySelector('#btn-close-edit-modal')?.addEventListener('click', () => {
    editModal.style.display = 'none';
  });
  container.querySelector('#btn-cancel-edit-rm')?.addEventListener('click', () => {
    editModal.style.display = 'none';
  });

  // Handle Add Node Form
  container.querySelector('#form-add-node')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = container.querySelector('#new-node-title').value.trim();
    const status = container.querySelector('#new-node-status').value;
    const notes = container.querySelector('#new-node-notes').value.trim();

    if (!title) return;

    await createNode({
      roadmapId: roadmap.id,
      title,
      status,
      notes,
      order: nodes.length + 1
    });

    await awardXP(XP_VALUES.NODE_CREATED, `Inscribed Topic: ${title}`);
    addNodeModal.style.display = 'none';
    renderRoadmapView(container, { id: roadmap.id, router });
  });

  // Handle Edit Roadmap Form
  container.querySelector('#form-edit-roadmap')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = container.querySelector('#edit-rm-title').value.trim();
    const category = container.querySelector('#edit-rm-category').value.trim();
    const description = container.querySelector('#edit-rm-desc').value.trim();

    await updateRoadmap(roadmap.id, { title, category, description });
    editModal.style.display = 'none';
    renderRoadmapView(container, { id: roadmap.id, router });
  });

  // Handle Delete Entire Roadmap
  container.querySelector('#btn-delete-this-roadmap')?.addEventListener('click', async () => {
    if (confirm(`Permanently purge "${roadmap.title}" and all associated lessons and flashcards?`)) {
      await deleteRoadmap(roadmap.id);
      router.navigateTo('/');
    }
  });

  // Toggle Status Badge Click
  const statusBadges = container.querySelectorAll('[data-action="toggle-status"]');
  statusBadges.forEach(badge => {
    badge.addEventListener('click', async (e) => {
      e.stopPropagation();
      const nodeId = badge.getAttribute('data-id');
      const targetNode = nodes.find(n => n.id === nodeId);
      if (!targetNode) return;

      let nextStatus = 'pending';
      if (targetNode.status === 'pending') nextStatus = 'in_progress';
      else if (targetNode.status === 'in_progress') nextStatus = 'completed';
      else nextStatus = 'pending';

      await updateNode(nodeId, { status: nextStatus });

      if (nextStatus === 'completed') {
        await awardXP(XP_VALUES.NODE_COMPLETED, `Mastered Topic: ${targetNode.title}`);
      }

      renderRoadmapView(container, { id: roadmap.id, router });
    });
  });

  // Save Inline Notes
  const saveNoteBtns = container.querySelectorAll('.btn-save-inline-notes');
  saveNoteBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const nodeId = btn.getAttribute('data-id');
      const textarea = container.querySelector(`.node-inline-textarea[data-id="${nodeId}"]`);
      if (textarea) {
        btn.textContent = 'Saving...';
        await updateNode(nodeId, { notes: textarea.value });
        btn.textContent = 'Saved ✓';
        setTimeout(() => {
          btn.textContent = 'Save Notes';
        }, 1500);
      }
    });
  });

  // Reordering nodes
  const orderBtns = container.querySelectorAll('.btn-order-node');
  orderBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.getAttribute('data-action');
      const index = parseInt(btn.getAttribute('data-index'), 10);
      const targetNode = nodes[index];
      const swapIndex = action === 'move-up' ? index - 1 : index + 1;
      const otherNode = nodes[swapIndex];

      if (targetNode && otherNode) {
        const tempOrder = targetNode.order || index;
        await updateNode(targetNode.id, { order: otherNode.order || swapIndex });
        await updateNode(otherNode.id, { order: tempOrder });
        renderRoadmapView(container, { id: roadmap.id, router });
      }
    });
  });

  // Delete Node
  const deleteNodeBtns = container.querySelectorAll('.btn-delete-node');
  deleteNodeBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const nodeId = btn.getAttribute('data-id');
      if (confirm('Permanently remove this topic node and its lessons?')) {
        await deleteNode(nodeId);
        renderRoadmapView(container, { id: roadmap.id, router });
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
