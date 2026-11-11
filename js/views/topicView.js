import { getRoadmap, getNode, getLessonsByNode, updateNode, createLesson, updateLesson, deleteLesson, createFlashcard } from '../db.js';
import { awardXP, XP_VALUES } from '../gamification.js';
import {
  GEMINI_MODELS,
  DEFAULT_MODEL,
  generateCurriculumOutline,
  synthesizeSingleLesson,
  buildOutlinePrompt,
  buildSingleLessonPrompt,
  parseAndValidateOutlineJson,
  parseAndValidateLessonJson,
  setEphemeralSessionKey,
  getEphemeralSessionKey
} from '../aiService.js';

export async function renderTopicView(container, { id: roadmapId, topicId, router }) {
  const [roadmap, node, lessons] = await Promise.all([
    getRoadmap(roadmapId),
    getNode(topicId),
    getLessonsByNode(topicId)
  ]);

  if (!roadmap || !node) {
    container.innerHTML = `
      <div class="field-container error-panel">
        <h2 class="editorial-title">Topic Dossier Not Found</h2>
        <p>The requested topic node or parent roadmap volume was not found in the archive.</p>
        <button class="btn btn-primary" id="btn-back-rm">Return to Volume</button>
      </div>
    `;
    container.querySelector('#btn-back-rm')?.addEventListener('click', () => router.navigateTo(`/roadmap/${roadmapId}`));
    return;
  }

  // Count synthesized vs outlined lessons
  const synthesizedCount = lessons.filter(l => l.status === 'synthesized' || (l.lessons && l.lessons.length > 0 && l.summary)).length;
  const outlineCount = lessons.length - synthesizedCount;

  

  container.innerHTML = `
    <div class="field-container page-topic">
      <!-- Breadcrumb Bar -->
      <nav class="archival-breadcrumb">
        <a href="#/" class="breadcrumb-link">← Field Index</a>
        <span class="breadcrumb-separator">/</span>
        <a href="#/roadmap/${roadmapId}" class="breadcrumb-link">[VOL] ${escapeHtml(roadmap.title)}</a>
        <span class="breadcrumb-separator">/</span>
        <span class="breadcrumb-current">[DOSSIER] ${escapeHtml(node.title)}</span>
      </nav>

      <!-- Topic Dossier Header -->
      <header class="folio-header topic-header-card">
        <div class="header-tab-stamp">
          <span class="monospace-tag">[STATUS: ${node.status.toUpperCase()}]</span>
          <span class="field-stamp">[TOPIC ID: ${node.id.slice(-6)}]</span>
        </div>

        <h1 class="display-title">${escapeHtml(node.title)}</h1>

        <!-- Editable Topic Notes in Dossier Header -->
        <div class="topic-dossier-notes-box">
          <div class="notes-header-row">
            <span class="notes-label">Field Dossier Directives & Notes:</span>
            <button id="btn-save-topic-notes" class="btn-link-action">Save Notes</button>
          </div>
          <textarea id="topic-notes-textarea" class="topic-notes-area" rows="3" placeholder="Inscribe study notes, mental models, or target references for this topic...">${escapeHtml(node.notes || '')}</textarea>
        </div>

        <div class="topic-header-actions">
          <button id="btn-open-ingest-modal" class="btn btn-primary">
            <span class="btn-icon">⚡</span> Ingest Resource & Map Lessons
          </button>
          <button id="btn-toggle-node-status" class="btn btn-secondary">
            Toggle Status (${node.status === 'completed' ? 'Verified ✓' : node.status === 'in_progress' ? 'In Progress' : 'Pending'})
          </button>
        </div>
      </header>

      <!-- Lessons Catalog Section Header -->
      <div class="action-bar-strip">
        <div class="action-bar-left">
          <span class="monospace-tag">[TOTAL LESSONS: ${lessons.length}]</span>
          <span class="monospace-tag">[SYNTHESIZED: ${synthesizedCount}]</span>
          <span class="monospace-tag">[AWAITING SYNTHESIS: ${outlineCount}]</span>
        </div>
      </div>

      <!-- Lessons Stream or Empty State -->
      <section class="lessons-stream">
        ${lessons.length === 0 ? renderEmptyLessonsState() : renderLessonsList(lessons, roadmapId, topicId)}
      </section>

      <!-- =================================================================
           STAGE 1 MODAL: CURRICULUM OUTLINE MAPPING
           ================================================================= -->
      <div id="modal-ingest-outline" class="field-modal-overlay" style="display: none;">
        <div class="field-modal-card field-modal-wide">
          <div class="modal-tab-header">
            <span class="modal-tab-title">[STAGE 1: CURRICULUM ARCHITECT // MAP LESSONS]</span>
            <button class="btn-close-modal" id="btn-close-outline-modal" aria-label="Close">✕</button>
          </div>
          <div class="modal-body">
            <div class="ingest-security-callout">
              <span class="callout-icon">🔒</span>
              <div class="callout-body">
                <strong>Zero Credential Persistence Policy:</strong>
                Your Gemini API key is kept exclusively in volatile JavaScript RAM during active requests. It is never written to LocalStorage, SessionStorage, Cookies, or IndexedDB.
              </div>
            </div>

            <!-- Ingestion Workflow Tabs: Direct API vs External AI Fallback -->
            <div class="import-tabs-nav">
              <button type="button" class="tab-btn active" id="tab-stage1-api">Direct Gemini API Synthesis</button>
              <button type="button" class="tab-btn" id="tab-stage1-external">Copy Prompt / External Chatbot Fallback</button>
            </div>

            <!-- Resource Input Fields (Common to both modes) -->
            <div class="form-group" style="margin-bottom: 1rem;">
              <div class="sub-tab-group">
                <button type="button" class="tab-btn-mini active" id="subtab-url">Resource URL</button>
                <button type="button" class="tab-btn-mini" id="subtab-raw">Raw Text / Transcript / Syllabus</button>
              </div>

              <div id="panel-source-url" style="margin-top: 0.5rem;">
                <label for="outline-url-input" class="form-label">Article / Video / Book / Course URL</label>
                <input
                  type="url"
                  id="outline-url-input"
                  class="form-input ledger-line-input"
                  placeholder="https://youtube.com/watch?v=... or https://..."
                />
                <span class="form-hint">Paste a comprehensive course video, book chapter, or documentation URL.</span>
              </div>

              <div id="panel-source-raw" style="display: none; margin-top: 0.5rem;">
                <label for="outline-raw-text" class="form-label">Raw Text, Transcript, or Table of Contents</label>
                <textarea
                  id="outline-raw-text"
                  class="form-textarea code-editor-area"
                  rows="6"
                  placeholder="Paste video transcript, syllabus, book table of contents, or article sections here..."
                ></textarea>
              </div>
            </div>

            <!-- TAB 1A: DIRECT GEMINI API -->
            <div id="content-stage1-api" class="tab-panel active">
              <form id="form-outline-api" class="archival-form">
                <div class="form-group">
                  <label for="stage1-model-select" class="form-label">Gemini Model Selection</label>
                  <select id="stage1-model-select" class="form-input ledger-line-input font-mono">
                    ${GEMINI_MODELS.map(m => `
                      <option value="${m.id}" ${m.id === DEFAULT_MODEL ? 'selected' : ''}>${m.name}</option>
                    `).join('')}
                  </select>
                </div>

                <div class="form-group">
                  <label for="stage1-api-key" class="form-label">Google Gemini API Key *</label>
                  <input
                    type="password"
                    id="stage1-api-key"
                    class="form-input ledger-line-input"
                    placeholder="AIzaSy..."
                    value="${getEphemeralSessionKey()}"
                    required
                  />
                  <div class="form-checkbox-row">
                    <label class="checkbox-label">
                      <input type="checkbox" id="chk-stage1-keep-key" ${getEphemeralSessionKey() ? 'checked' : ''} />
                      Retain key in volatile browser memory for this session
                    </label>
                  </div>
                </div>

                <!-- Spinner / Status -->
                <div id="stage1-progress-indicator" class="ingest-progress-box" style="display: none;">
                  <div class="ink-spinner"></div>
                  <div class="ingest-progress-status font-mono">
                    Analyzing resource and mapping granular lessons with Gemini...
                  </div>
                </div>

                <div id="stage1-error-box" class="archival-error-callout" style="display: none;"></div>

                <div class="form-actions">
                  <button type="button" class="btn btn-secondary" id="btn-cancel-outline-modal">Cancel</button>
                  <button type="submit" class="btn btn-primary" id="btn-submit-stage1-api">
                    Map Curriculum Outline
                  </button>
                </div>
              </form>
            </div>

            <!-- TAB 1B: EXTERNAL CHATBOT / COPY PROMPT FALLBACK -->
            <div id="content-stage1-external" class="tab-panel" style="display: none;">
              <p class="modal-desc">
                If you prefer using ChatGPT, Claude, Gemini Web, or a local LLM, copy this authoritative prompt and paste the generated JSON response below.
              </p>

              <div class="copy-prompt-bar">
                <button type="button" class="btn btn-secondary" id="btn-copy-stage1-prompt">
                  📋 Copy Stage 1 Prompt to Clipboard
                </button>
                <span id="stage1-copy-feedback" class="copy-feedback-msg font-mono" style="display: none;">✓ Copied!</span>
              </div>

              <div class="form-group" style="margin-top: 1rem;">
                <label for="stage1-external-json" class="form-label">Paste External AI JSON Response *</label>
                <textarea
                  id="stage1-external-json"
                  class="form-textarea code-editor-area"
                  rows="8"
                  placeholder='{ "sourceTitle": "...", "lessons": [ { "title": "...", "citation": "00:00:00 - 00:30:00", "shortDescription": "..." } ] }'
                ></textarea>
              </div>

              <div id="stage1-external-error-box" class="archival-error-callout" style="display: none;"></div>

              <div class="form-actions">
                <button type="button" class="btn btn-secondary" id="btn-cancel-outline-external">Cancel</button>
                <button type="button" class="btn btn-primary" id="btn-verify-stage1-json">
                  Verify & Inscribe Outlined Lessons
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- =================================================================
           STAGE 2 MODAL: INDIVIDUAL LESSON SYNTHESIS
           ================================================================= -->
      <div id="modal-synthesize-lesson" class="field-modal-overlay" style="display: none;">
        <div class="field-modal-card field-modal-wide">
          <div class="modal-tab-header">
            <span class="modal-tab-title">[STAGE 2: COMPILE GRANULAR LESSON FOLIO]</span>
            <button class="btn-close-modal" id="btn-close-synth-modal" aria-label="Close">✕</button>
          </div>
          <div class="modal-body">
            <!-- Target Lesson Context Banner -->
            <div class="lesson-target-banner">
              <div class="target-meta font-mono">
                <span class="target-label">TARGET MODULE:</span>
                <span id="synth-target-citation" class="citation-badge">Section</span>
              </div>
              <h2 id="synth-target-title" class="target-title">Lesson Title</h2>
              <p id="synth-target-desc" class="target-desc">Short description</p>
            </div>

            <!-- Ingestion Workflow Tabs -->
            <div class="import-tabs-nav">
              <button type="button" class="tab-btn active" id="tab-stage2-api">Direct Gemini API Synthesis</button>
              <button type="button" class="tab-btn" id="tab-stage2-external">Copy Prompt / External Chatbot Fallback</button>
            </div>

            <!-- TAB 2A: DIRECT GEMINI API -->
            <div id="content-stage2-api" class="tab-panel active">
              <form id="form-synth-api" class="archival-form">
                <div class="form-group">
                  <label for="stage2-model-select" class="form-label">Gemini Model Selection</label>
                  <select id="stage2-model-select" class="form-input ledger-line-input font-mono">
                    ${GEMINI_MODELS.map(m => `
                      <option value="${m.id}" ${m.id === DEFAULT_MODEL ? 'selected' : ''}>${m.name}</option>
                    `).join('')}
                  </select>
                </div>

                <div class="form-group">
                  <label for="stage2-api-key" class="form-label">Google Gemini API Key *</label>
                  <input
                    type="password"
                    id="stage2-api-key"
                    class="form-input ledger-line-input"
                    placeholder="AIzaSy..."
                    value="${getEphemeralSessionKey()}"
                    required
                  />
                  <div class="form-checkbox-row">
                    <label class="checkbox-label">
                      <input type="checkbox" id="chk-stage2-keep-key" ${getEphemeralSessionKey() ? 'checked' : ''} />
                      Retain key in volatile browser memory for this session
                    </label>
                  </div>
                </div>

                <!-- Spinner / Status -->
                <div id="stage2-progress-indicator" class="ingest-progress-box" style="display: none;">
                  <div class="ink-spinner"></div>
                  <div class="ingest-progress-status font-mono">
                    Synthesizing modular curriculum, examination quiz, and flashcards...
                  </div>
                </div>

                <div id="stage2-error-box" class="archival-error-callout" style="display: none;"></div>

                <div class="form-actions">
                  <button type="button" class="btn btn-secondary" id="btn-cancel-synth-modal">Cancel</button>
                  <button type="submit" class="btn btn-primary" id="btn-submit-stage2-api">
                    Synthesize Lesson Folio
                  </button>
                </div>
              </form>
            </div>

            <!-- TAB 2B: EXTERNAL CHATBOT / COPY PROMPT FALLBACK -->
            <div id="content-stage2-external" class="tab-panel" style="display: none;">
              <p class="modal-desc">
                Copy the tailored prompt for this specific lesson section. Paste into your external AI chatbot and paste the resulting JSON below.
              </p>

              <div class="copy-prompt-bar">
                <button type="button" class="btn btn-secondary" id="btn-copy-stage2-prompt">
                  📋 Copy Lesson Prompt to Clipboard
                </button>
                <span id="stage2-copy-feedback" class="copy-feedback-msg font-mono" style="display: none;">✓ Copied!</span>
              </div>

              <div class="form-group" style="margin-top: 1rem;">
                <label for="stage2-external-json" class="form-label">Paste External AI JSON Response *</label>
                <textarea
                  id="stage2-external-json"
                  class="form-textarea code-editor-area"
                  rows="8"
                  placeholder='{ "title": "...", "summary": "...", "lessons": [...], "quiz": [...], "flashcards": [...] }'
                ></textarea>
              </div>

              <div id="stage2-external-error-box" class="archival-error-callout" style="display: none;"></div>

              <div class="form-actions">
                <button type="button" class="btn btn-secondary" id="btn-cancel-synth-external">Cancel</button>
                <button type="button" class="btn btn-primary" id="btn-verify-stage2-json">
                  Verify & Save Synthesized Lesson
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  setupTopicEventListeners(container, roadmap, node, lessons, router);
}

function renderEmptyLessonsState() {
  return `
    <div class="empty-folio-card">
      <div class="paper-clip-ornament">📎</div>
      <div class="field-stamp">[DOSSIER EMPTY]</div>
      <h3 class="editorial-title">No Lessons Mapped Yet</h3>
      <p class="editorial-desc">Ingest a comprehensive resource (e.g. video course, book, documentation) using the button above. The AI will map the resource into distinct, granular lesson modules with exact citations.</p>
    </div>
  `;
}

function renderLessonsList(lessons, roadmapId, topicId) {
  return `
    <div class="lessons-grid">
      ${lessons.map((lesson, index) => {
        const orderNum = String(index + 1).padStart(2, '0');
        const isSynthesized = lesson.status === 'synthesized' || (lesson.lessons && lesson.lessons.length > 0 && lesson.summary);
        const citation = lesson.citation || `Section 0${index + 1}`;

        if (!isSynthesized) {
          // Outlined lesson awaiting Stage 2 synthesis
          return `
            <article class="lesson-summary-card lesson-outline-card" data-lesson-id="${lesson.id}">
              <div class="lesson-card-header">
                <span class="citation-badge font-mono">[${escapeHtml(citation)}]</span>
                <span class="status-badge status-pending">Awaiting Inscription</span>
              </div>

              <h3 class="lesson-card-title">
                <span class="lesson-index-prefix font-mono">${orderNum}.</span>
                ${escapeHtml(lesson.title)}
              </h3>

              <p class="lesson-card-summary">${escapeHtml(lesson.shortDescription || 'Modular curriculum section awaiting detailed synthesis.')}</p>

              <div class="lesson-card-footer">
                <button class="btn btn-primary btn-sm btn-open-synth-modal" data-id="${lesson.id}">
                  ⚡ Synthesize Lesson Folio
                </button>
                <button class="btn-delete-lesson icon-btn" data-id="${lesson.id}" title="Purge Lesson Shell">
                  🗑️
                </button>
              </div>
            </article>
          `;
        }

        // Fully synthesized lesson
        return `
          <article class="lesson-summary-card" data-lesson-id="${lesson.id}">
            <div class="card-washi-tape"></div>
            <div class="lesson-card-header">
              <span class="citation-badge font-mono">[${escapeHtml(citation)}]</span>
              ${lesson.completed ? '<span class="status-badge status-completed">Quiz Passed ✓</span>' : '<span class="status-badge status-pending">Quiz Pending</span>'}
            </div>

            <h3 class="lesson-card-title">
              <span class="lesson-index-prefix font-mono">${orderNum}.</span>
              <a href="#/roadmap/${roadmapId}/topic/${topicId}/lesson/${lesson.id}" class="card-title-link">
                ${escapeHtml(lesson.title)}
              </a>
            </h3>

            ${lesson.sourceUrl ? `
              <div class="lesson-source-citation font-mono">
                [SRC: <a href="${escapeHtml(lesson.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="external-drafting-link">${escapeHtml(lesson.sourceUrl)}</a>]
              </div>
            ` : ''}

            <p class="lesson-card-summary">${escapeHtml(lesson.summary)}</p>

            ${Array.isArray(lesson.keyTakeaways) && lesson.keyTakeaways.length > 0 ? `
              <div class="takeaways-preview">
                <span class="takeaways-header">Core Axioms:</span>
                <ul class="takeaways-mini-list">
                  ${lesson.keyTakeaways.slice(0, 3).map(t => `<li>${escapeHtml(t)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            <div class="lesson-card-footer">
              <div class="lesson-links-group">
                <a href="#/roadmap/${roadmapId}/topic/${topicId}/lesson/${lesson.id}" class="btn btn-primary btn-sm">
                  Study Lesson →
                </a>
                <a href="#/roadmap/${roadmapId}/topic/${topicId}/lesson/${lesson.id}#quiz" class="btn btn-secondary btn-sm">
                  Take Quiz 📝
                </a>
              </div>
              <div class="lesson-card-tools">
                <button class="btn-re-synth icon-btn" data-id="${lesson.id}" title="Re-synthesize this lesson">
                  🔄
                </button>
                <button class="btn-delete-lesson icon-btn" data-id="${lesson.id}" title="Purge Lesson">
                  🗑️
                </button>
              </div>
            </div>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function setupTopicEventListeners(container, roadmap, node, lessons, router) {
  // Save topic notes
  // Selected lesson for Stage 2 individual synthesis
  let activeLessonForSynthesis = null;
  const saveNotesBtn = container.querySelector('#btn-save-topic-notes');
  const notesTextarea = container.querySelector('#topic-notes-textarea');
  saveNotesBtn?.addEventListener('click', async () => {
    saveNotesBtn.textContent = 'Saving...';
    await updateNode(node.id, { notes: notesTextarea.value });
    saveNotesBtn.textContent = 'Saved ✓';
    setTimeout(() => { saveNotesBtn.textContent = 'Save Notes'; }, 1500);
  });

  // Toggle status
  const toggleStatusBtn = container.querySelector('#btn-toggle-node-status');
  toggleStatusBtn?.addEventListener('click', async () => {
    let nextStatus = 'pending';
    if (node.status === 'pending') nextStatus = 'in_progress';
    else if (node.status === 'in_progress') nextStatus = 'completed';
    else nextStatus = 'pending';

    await updateNode(node.id, { status: nextStatus });
    if (nextStatus === 'completed') {
      await awardXP(XP_VALUES.NODE_COMPLETED, `Mastered Topic: ${node.title}`);
    }
    renderTopicView(container, { id: roadmap.id, topicId: node.id, router });
  });

  // =========================================================================
  // STAGE 1: OUTLINE MODAL LOGIC
  // =========================================================================
  const outlineModal = container.querySelector('#modal-ingest-outline');
  container.querySelector('#btn-open-ingest-modal')?.addEventListener('click', () => {
    outlineModal.style.display = 'flex';
  });

  const closeOutline = () => { outlineModal.style.display = 'none'; };
  container.querySelector('#btn-close-outline-modal')?.addEventListener('click', closeOutline);
  container.querySelector('#btn-cancel-outline-modal')?.addEventListener('click', closeOutline);
  container.querySelector('#btn-cancel-outline-external')?.addEventListener('click', closeOutline);

  // Subtab toggle: URL vs Raw Text
  const subtabUrl = container.querySelector('#subtab-url');
  const subtabRaw = container.querySelector('#subtab-raw');
  const panelSourceUrl = container.querySelector('#panel-source-url');
  const panelSourceRaw = container.querySelector('#panel-source-raw');

  subtabUrl?.addEventListener('click', () => {
    subtabUrl.classList.add('active');
    subtabRaw.classList.remove('active');
    panelSourceUrl.style.display = 'block';
    panelSourceRaw.style.display = 'none';
  });

  subtabRaw?.addEventListener('click', () => {
    subtabRaw.classList.add('active');
    subtabUrl.classList.remove('active');
    panelSourceRaw.style.display = 'block';
    panelSourceUrl.style.display = 'none';
  });

  // Stage 1 Tab Toggle: Direct API vs External Chatbot
  const tabStage1Api = container.querySelector('#tab-stage1-api');
  const tabStage1External = container.querySelector('#tab-stage1-external');
  const contentStage1Api = container.querySelector('#content-stage1-api');
  const contentStage1External = container.querySelector('#content-stage1-external');

  tabStage1Api?.addEventListener('click', () => {
    tabStage1Api.classList.add('active');
    tabStage1External.classList.remove('active');
    contentStage1Api.style.display = 'block';
    contentStage1External.style.display = 'none';
  });

  tabStage1External?.addEventListener('click', () => {
    tabStage1External.classList.add('active');
    tabStage1Api.classList.remove('active');
    contentStage1External.style.display = 'block';
    contentStage1Api.style.display = 'none';
  });

  // Stage 1: Copy Prompt to Clipboard
  container.querySelector('#btn-copy-stage1-prompt')?.addEventListener('click', async () => {
    const url = container.querySelector('#outline-url-input').value.trim();
    const rawText = container.querySelector('#outline-raw-text').value.trim();
    const promptText = buildOutlinePrompt({ topicTitle: node.title, url, rawText });

    const copied = await copyToClipboard(promptText);
    const feedback = container.querySelector('#stage1-copy-feedback');
    if (feedback) {
      feedback.textContent = copied ? '✓ Copied to Clipboard!' : 'Failed to copy';
      feedback.style.display = 'inline';
      setTimeout(() => { feedback.style.display = 'none'; }, 2500);
    }
  });

  // Stage 1: Direct API Submit
  const formOutlineApi = container.querySelector('#form-outline-api');
  const stage1Error = container.querySelector('#stage1-error-box');
  const stage1Spinner = container.querySelector('#stage1-progress-indicator');
  const stage1SubmitBtn = container.querySelector('#btn-submit-stage1-api');

  formOutlineApi?.addEventListener('submit', async (e) => {
    e.preventDefault();
    stage1Error.style.display = 'none';

    const apiKey = container.querySelector('#stage1-api-key').value.trim();
    const model = container.querySelector('#stage1-model-select').value;
    const keepKey = container.querySelector('#chk-stage1-keep-key').checked;
    const url = container.querySelector('#outline-url-input').value.trim();
    const rawText = container.querySelector('#outline-raw-text').value.trim();

    if (!apiKey) {
      stage1Error.textContent = 'Please provide a valid Gemini API Key.';
      stage1Error.style.display = 'block';
      return;
    }

    if (!url && !rawText) {
      stage1Error.textContent = 'Please supply either a Resource URL or Raw Text/Transcript.';
      stage1Error.style.display = 'block';
      return;
    }

    if (keepKey) {
      setEphemeralSessionKey(apiKey);
    }

    stage1Spinner.style.display = 'flex';
    stage1SubmitBtn.disabled = true;

    try {
      const outlineData = await generateCurriculumOutline({
        apiKey,
        model,
        topicTitle: node.title,
        url,
        rawText
      });

      await inscribeOutlinedLessons(outlineData.lessons, url, rawText);
      outlineModal.style.display = 'none';
      renderTopicView(container, { id: roadmap.id, topicId: node.id, router });
    } catch (err) {
      stage1Error.innerHTML = `
        <strong>Mapping Failed:</strong> ${escapeHtml(err.message)}
        <br/><span style="font-size: 0.85em;">Tip: Try switching models or using the "Copy Prompt / External Chatbot Fallback" tab.</span>
      `;
      stage1Error.style.display = 'block';
    } finally {
      stage1Spinner.style.display = 'none';
      stage1SubmitBtn.disabled = false;
    }
  });

  // Stage 1: External JSON Verify & Inscribe
  const btnVerifyStage1Json = container.querySelector('#btn-verify-stage1-json');
  const stage1ExternalError = container.querySelector('#stage1-external-error-box');

  btnVerifyStage1Json?.addEventListener('click', async () => {
    stage1ExternalError.style.display = 'none';
    const jsonText = container.querySelector('#stage1-external-json').value.trim();
    const url = container.querySelector('#outline-url-input').value.trim();
    const rawText = container.querySelector('#outline-raw-text').value.trim();

    if (!jsonText) {
      stage1ExternalError.textContent = 'Please paste the JSON response from your external chatbot.';
      stage1ExternalError.style.display = 'block';
      return;
    }

    try {
      const outlineData = parseAndValidateOutlineJson(jsonText);
      await inscribeOutlinedLessons(outlineData.lessons, url, rawText);
      outlineModal.style.display = 'none';
      renderTopicView(container, { id: roadmap.id, topicId: node.id, router });
    } catch (err) {
      stage1ExternalError.innerHTML = `<strong>Validation Error:</strong> ${escapeHtml(err.message)}`;
      stage1ExternalError.style.display = 'block';
    }
  });

  // Helper to inscribe outline lessons into DB
  async function inscribeOutlinedLessons(mappedLessons, url, rawText) {
    let orderStart = lessons.length + 1;
    for (const item of mappedLessons) {
      await createLesson({
        nodeId: node.id,
        title: item.title,
        shortDescription: item.shortDescription || '',
        citation: item.citation || '',
        status: 'outline',
        order: orderStart++,
        sourceUrl: url || '',
        rawSourceContext: rawText || '',
        summary: '',
        keyTakeaways: [],
        lessons: [],
        quiz: [],
        completed: false,
        score: null
      });
    }

    await awardXP(XP_VALUES.NODE_CREATED * 2, `Mapped Curriculum Outline: ${mappedLessons.length} Lessons`);
  }

  // =========================================================================
  // STAGE 2: INDIVIDUAL LESSON SYNTHESIS MODAL LOGIC
  // =========================================================================
  const synthModal = container.querySelector('#modal-synthesize-lesson');
  const closeSynth = () => { synthModal.style.display = 'none'; };
  container.querySelector('#btn-close-synth-modal')?.addEventListener('click', closeSynth);
  container.querySelector('#btn-cancel-synth-modal')?.addEventListener('click', closeSynth);
  container.querySelector('#btn-cancel-synth-external')?.addEventListener('click', closeSynth);

  // Stage 2 Tab Toggle: Direct API vs External Chatbot
  const tabStage2Api = container.querySelector('#tab-stage2-api');
  const tabStage2External = container.querySelector('#tab-stage2-external');
  const contentStage2Api = container.querySelector('#content-stage2-api');
  const contentStage2External = container.querySelector('#content-stage2-external');

  tabStage2Api?.addEventListener('click', () => {
    tabStage2Api.classList.add('active');
    tabStage2External.classList.remove('active');
    contentStage2Api.style.display = 'block';
    contentStage2External.style.display = 'none';
  });

  tabStage2External?.addEventListener('click', () => {
    tabStage2External.classList.add('active');
    tabStage2Api.classList.remove('active');
    contentStage2External.style.display = 'block';
    contentStage2Api.style.display = 'none';
  });

  // Open Stage 2 Modal from any lesson card
  const synthBtns = container.querySelectorAll('.btn-open-synth-modal, .btn-re-synth');
  synthBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      
      const lessonId = btn.getAttribute('data-id');
      const targetLesson = lessons.find(l => l.id === lessonId);
      if (!targetLesson) return;

      activeLessonForSynthesis = targetLesson;

      // Populate banner
      container.querySelector('#synth-target-citation').textContent = targetLesson.citation || 'Section';
      container.querySelector('#synth-target-title').textContent = targetLesson.title;
      container.querySelector('#synth-target-desc').textContent = targetLesson.shortDescription || 'Deep modular curriculum synthesis.';

      // Pre-fill API key if session memory available
      const keyInput = container.querySelector('#stage2-api-key');
      if (keyInput) keyInput.value = getEphemeralSessionKey();

      synthModal.style.display = 'flex';
    });
  });

  // Stage 2: Copy Lesson Prompt
  container.querySelector('#btn-copy-stage2-prompt')?.addEventListener('click', async () => {
    if (!activeLessonForSynthesis) return;

    const promptText = buildSingleLessonPrompt({
      topicTitle: node.title,
      lessonOutline: activeLessonForSynthesis,
      url: activeLessonForSynthesis.sourceUrl || '',
      rawText: activeLessonForSynthesis.rawSourceContext || ''
    });

    const copied = await copyToClipboard(promptText);
    const feedback = container.querySelector('#stage2-copy-feedback');
    if (feedback) {
      feedback.textContent = copied ? '✓ Copied to Clipboard!' : 'Failed to copy';
      feedback.style.display = 'inline';
      setTimeout(() => { feedback.style.display = 'none'; }, 2500);
    }
  });

  // Stage 2: Direct API Submit
  const formSynthApi = container.querySelector('#form-synth-api');
  const stage2Error = container.querySelector('#stage2-error-box');
  const stage2Spinner = container.querySelector('#stage2-progress-indicator');
  const stage2SubmitBtn = container.querySelector('#btn-submit-stage2-api');

  formSynthApi?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeLessonForSynthesis) return;

    stage2Error.style.display = 'none';
    const apiKey = container.querySelector('#stage2-api-key').value.trim();
    const model = container.querySelector('#stage2-model-select').value;
    const keepKey = container.querySelector('#chk-stage2-keep-key').checked;

    if (!apiKey) {
      stage2Error.textContent = 'Please enter a valid Gemini API Key.';
      stage2Error.style.display = 'block';
      return;
    }

    if (keepKey) {
      setEphemeralSessionKey(apiKey);
    }

    stage2Spinner.style.display = 'flex';
    stage2SubmitBtn.disabled = true;

    try {
      const detailedLesson = await synthesizeSingleLesson({
        apiKey,
        model,
        topicTitle: node.title,
        lessonOutline: activeLessonForSynthesis,
        url: activeLessonForSynthesis.sourceUrl || '',
        rawText: activeLessonForSynthesis.rawSourceContext || ''
      });

      await applySynthesizedLesson(activeLessonForSynthesis.id, detailedLesson);
      synthModal.style.display = 'none';
      renderTopicView(container, { id: roadmap.id, topicId: node.id, router });
    } catch (err) {
      stage2Error.innerHTML = `
        <strong>Synthesis Failed:</strong> ${escapeHtml(err.message)}
        <br/><span style="font-size: 0.85em;">Tip: Try another model or use the Copy Prompt tab.</span>
      `;
      stage2Error.style.display = 'block';
    } finally {
      stage2Spinner.style.display = 'none';
      stage2SubmitBtn.disabled = false;
    }
  });

  // Stage 2: External JSON Verify & Inscribe
  const btnVerifyStage2Json = container.querySelector('#btn-verify-stage2-json');
  const stage2ExternalError = container.querySelector('#stage2-external-error-box');

  btnVerifyStage2Json?.addEventListener('click', async () => {
    if (!activeLessonForSynthesis) return;
    stage2ExternalError.style.display = 'none';

    const jsonText = container.querySelector('#stage2-external-json').value.trim();
    if (!jsonText) {
      stage2ExternalError.textContent = 'Please paste the JSON response from your external chatbot.';
      stage2ExternalError.style.display = 'block';
      return;
    }

    try {
      const detailedLesson = parseAndValidateLessonJson(jsonText);
      await applySynthesizedLesson(activeLessonForSynthesis.id, detailedLesson);
      synthModal.style.display = 'none';
      renderTopicView(container, { id: roadmap.id, topicId: node.id, router });
    } catch (err) {
      stage2ExternalError.innerHTML = `<strong>Validation Error:</strong> ${escapeHtml(err.message)}`;
      stage2ExternalError.style.display = 'block';
    }
  });

  // Helper to commit synthesized lesson and flashcards to DB
  async function applySynthesizedLesson(lessonId, detailedLesson) {
    await updateLesson(lessonId, {
      title: detailedLesson.title || activeLessonForSynthesis.title,
      citation: detailedLesson.citation || activeLessonForSynthesis.citation,
      summary: detailedLesson.summary || '',
      keyTakeaways: detailedLesson.keyTakeaways || [],
      lessons: detailedLesson.lessons || [],
      quiz: detailedLesson.quiz || [],
      status: 'synthesized'
    });

    // Auto-create flashcards
    if (Array.isArray(detailedLesson.flashcards)) {
      for (const card of detailedLesson.flashcards) {
        if (card.front && card.back) {
          await createFlashcard({
            nodeId: node.id,
            front: card.front,
            back: card.back,
            intervalDays: 1
          });
        }
      }
    }

    await awardXP(XP_VALUES.LESSON_CREATED, `Synthesized Lesson: ${detailedLesson.title}`);
  }

  // Delete lesson
  const deleteBtns = container.querySelectorAll('.btn-delete-lesson');
  deleteBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const lessonId = btn.getAttribute('data-id');
      if (confirm('Permanently purge this lesson from the dossier?')) {
        await deleteLesson(lessonId);
        renderTopicView(container, { id: roadmap.id, topicId: node.id, router });
      }
    });
  });
}

async function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Fallback
    }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    const success = document.execCommand('copy');
    document.body.removeChild(ta);
    return success;
  } catch (e) {
    document.body.removeChild(ta);
    return false;
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
