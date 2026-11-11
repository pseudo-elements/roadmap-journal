import { getRoadmap, getNode, getLesson, updateLesson, createFlashcard } from '../db.js';
import { awardXP, XP_VALUES } from '../gamification.js';
import {
  GEMINI_MODELS,
  DEFAULT_MODEL,
  synthesizeSingleLesson,
  buildSingleLessonPrompt,
  parseAndValidateLessonJson,
  setEphemeralSessionKey,
  getEphemeralSessionKey
} from '../aiService.js';

export async function renderLessonView(container, { id: roadmapId, topicId, lessonId, anchor, router }) {
  const [roadmap, node, lesson] = await Promise.all([
    getRoadmap(roadmapId),
    getNode(topicId),
    getLesson(lessonId)
  ]);

  if (!roadmap || !node || !lesson) {
    container.innerHTML = `
      <div class="field-container error-panel">
        <h2 class="editorial-title">Lesson Folio Missing</h2>
        <p>The requested lesson record was not located in this ledger.</p>
        <button class="btn btn-primary" id="btn-back-topic">Return to Topic</button>
      </div>
    `;
    container.querySelector('#btn-back-topic')?.addEventListener('click', () => router.navigateTo(`/roadmap/${roadmapId}/topic/${topicId}`));
    return;
  }

  const isSynthesized = Boolean(lesson.status === 'synthesized' || (lesson.summary && Array.isArray(lesson.lessons) && lesson.lessons.length > 0));
  const citation = lesson.citation || 'Section';
  const quizQuestions = Array.isArray(lesson.quiz) ? lesson.quiz : [];
  const userAnswers = {}; // questionIndex -> selectedOptionIndex

  container.innerHTML = `
    <div class="field-container page-lesson">
      <!-- Breadcrumb Bar -->
      <nav class="archival-breadcrumb">
        <a href="#/" class="breadcrumb-link">← Field Index</a>
        <span class="breadcrumb-separator">/</span>
        <a href="#/roadmap/${roadmapId}" class="breadcrumb-link">${escapeHtml(roadmap.title)}</a>
        <span class="breadcrumb-separator">/</span>
        <a href="#/roadmap/${roadmapId}/topic/${topicId}" class="breadcrumb-link">${escapeHtml(node.title)}</a>
        <span class="breadcrumb-separator">/</span>
        <span class="breadcrumb-current">${escapeHtml(lesson.title)}</span>
      </nav>

      <!-- Lesson Folio Article Shell -->
      <article class="lesson-folio-sheet">
        <div class="paper-margin-red-rule"></div>

        <!-- Header -->
        <header class="lesson-sheet-header">
          <div class="sheet-top-meta">
            <span class="category-chip">[${escapeHtml(roadmap.category).toUpperCase()}]</span>
            <span class="citation-badge font-mono">[${escapeHtml(citation)}]</span>
            <span class="field-stamp">[INSCRIBED: ${new Date(lesson.createdAt).toLocaleDateString()}]</span>
            ${lesson.completed ? `<span class="rubber-stamp-verified">[EXAMINED // SCORE: ${lesson.score}%]</span>` : ''}
          </div>

          <h1 class="lesson-display-headline">${escapeHtml(lesson.title)}</h1>

          ${lesson.sourceUrl ? `
            <div class="lesson-source-box font-mono">
              <span>FIELD CITATION:</span>
              <a href="${escapeHtml(lesson.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="external-drafting-link">
                ${escapeHtml(lesson.sourceUrl)} ↗
              </a>
            </div>
          ` : ''}

          <!-- Quick Navigation Bar -->
          <div class="lesson-quick-nav">
            ${isSynthesized ? `
              <a href="#/roadmap/${roadmapId}/topic/${topicId}/lesson/${lesson.id}#quiz" class="btn btn-secondary btn-sm" id="btn-jump-quiz">
                Jump to Field Examination (${quizQuestions.length} Questions) ↓
              </a>
              <a href="#/progress/challenges" class="btn btn-secondary btn-sm">
                Spaced Repetition Cards →
              </a>
              <button class="btn btn-secondary btn-sm" id="btn-open-resynth-modal">
                🔄 Re-Synthesize Lesson
              </button>
            ` : `
              <button class="btn btn-primary btn-sm" id="btn-open-synth-modal">
                ⚡ Synthesize Lesson Folio Now
              </button>
            `}
          </div>
        </header>

        ${!isSynthesized ? renderUnsynthesizedOutlineState(lesson) : renderSynthesizedLessonContent(lesson, quizQuestions)}
      </article>

      <!-- MODAL: SYNTHESIZE THIS LESSON -->
      <div id="modal-synthesize-lesson" class="field-modal-overlay" style="display: none;">
        <div class="field-modal-card field-modal-wide">
          <div class="modal-tab-header">
            <span class="modal-tab-title">[COMPILE LESSON FOLIO // ${escapeHtml(lesson.title)}]</span>
            <button class="btn-close-modal" id="btn-close-synth-modal" aria-label="Close">✕</button>
          </div>
          <div class="modal-body">
            <div class="lesson-target-banner">
              <div class="target-meta font-mono">
                <span class="target-label">TARGET CITATION:</span>
                <span class="citation-badge">${escapeHtml(citation)}</span>
              </div>
              <h2 class="target-title">${escapeHtml(lesson.title)}</h2>
              <p class="target-desc">${escapeHtml(lesson.shortDescription || 'Modular section synthesis.')}</p>
            </div>

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

            <!-- TAB 2B: EXTERNAL CHATBOT FALLBACK -->
            <div id="content-stage2-external" class="tab-panel" style="display: none;">
              <p class="modal-desc">
                Copy this prompt for your external AI chatbot (ChatGPT, Claude, etc.), and paste the generated JSON response below.
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

  setupLessonEventListeners(container, roadmap, node, lesson, quizQuestions, userAnswers, router);
}

function renderUnsynthesizedOutlineState(lesson) {
  return `
    <div class="empty-folio-card" style="margin: 3rem 0; text-align: left; padding: 2.5rem;">
      <div class="field-stamp">[AWAITING GRANULAR SYNTHESIS]</div>
      <h2 class="editorial-title" style="margin: 0.5rem 0;">Lesson Module Outlined</h2>
      <p class="editorial-subtitle" style="margin-bottom: 1.5rem;">
        ${escapeHtml(lesson.shortDescription || 'This lesson outline has been mapped from the curriculum source, but has not yet been synthesized with detailed lessons, multiple-choice quizzes, and spaced repetition flashcards.')}
      </p>
      <div class="lesson-target-banner" style="margin-bottom: 1.5rem;">
        <span class="font-mono" style="font-size: 0.75rem;">CITATION LOCATOR: <strong>${escapeHtml(lesson.citation || 'Section')}</strong></span>
      </div>
      <button class="btn btn-primary" id="btn-trigger-inline-synth">
        ⚡ Synthesize This Lesson Now
      </button>
    </div>
  `;
}

function renderSynthesizedLessonContent(lesson, quizQuestions) {
  return `
    <!-- Executive Summary Callout -->
    <section class="lesson-summary-folio">
      <div class="washi-tape-strip">EXECUTIVE RESEARCH BRIEF</div>
      <p class="summary-editorial-text">${escapeHtml(lesson.summary)}</p>
    </section>

    <!-- Key Takeaways & Core Axioms -->
    ${Array.isArray(lesson.keyTakeaways) && lesson.keyTakeaways.length > 0 ? `
      <section class="takeaways-folio-section">
        <h2 class="section-subheading">Core Principles & Mental Models</h2>
        <ul class="takeaways-ledger-list">
          ${lesson.keyTakeaways.map((item) => `
            <li class="takeaway-ledger-item">
              <span class="takeaway-bullet-box">✓</span>
              <span class="takeaway-text">${escapeHtml(item)}</span>
            </li>
          `).join('')}
        </ul>
      </section>
    ` : ''}

    <!-- Modular Lesson Subsections -->
    <section class="lesson-modules-body">
      ${Array.isArray(lesson.lessons) && lesson.lessons.length > 0 ? lesson.lessons.map((section, sIdx) => `
        <div class="lesson-section-block">
          <div class="section-coordinate font-mono">[SECTION 0${sIdx + 1} // ANALYSIS]</div>
          <h2 class="lesson-section-title">${escapeHtml(section.sectionTitle || `Section ${sIdx + 1}`)}</h2>
          <div class="lesson-section-content">
            ${formatParagraphs(section.content)}
          </div>
          ${section.codeSnippet ? `
            <div class="code-terminal-folio">
              <div class="code-terminal-header font-mono">
                <span class="terminal-dot"></span>
                <span class="terminal-dot"></span>
                <span class="terminal-dot"></span>
                <span class="terminal-title">FIELD_OBSERVATION.src</span>
              </div>
              <pre class="code-terminal-pre"><code>${escapeHtml(section.codeSnippet)}</code></pre>
            </div>
          ` : ''}
        </div>
      `).join('') : '<p class="editorial-desc">No detailed modular breakdown provided.</p>'}
    </section>

    <!-- INTERACTIVE FIELD QUIZ SECTION -->
    <section id="quiz" class="quiz-examination-section">
      <div class="quiz-section-header">
        <div class="field-stamp">[VERIFICATION LAB]</div>
        <h2 class="editorial-title">Field Examination & Knowledge Retention</h2>
        <p class="editorial-subtitle">Complete this interactive assessment to verify comprehension and award mastery XP into your archive.</p>
        ${lesson.completed ? `
          <div class="quiz-completed-banner">
            <span class="banner-icon">🎖️</span>
            <span>You previously completed this examination with a score of <strong>${lesson.score}%</strong>. You may retake it below to reinforce your memory.</span>
          </div>
        ` : ''}
      </div>

      ${quizQuestions.length === 0 ? `
        <div class="empty-folio-card">
          <p>No examination questions were generated for this lesson.</p>
        </div>
      ` : `
        <div class="quiz-questions-stream">
          ${quizQuestions.map((q, qIndex) => `
            <div class="quiz-question-card" data-q-index="${qIndex}">
              <div class="question-meta-row font-mono">
                <span>[QUESTION 0${qIndex + 1} OF 0${quizQuestions.length}]</span>
                <span class="question-status-tag" id="q-status-${qIndex}">Awaiting Selection</span>
              </div>

              <h3 class="question-prompt-text">${escapeHtml(q.question)}</h3>

              <div class="quiz-options-group">
                ${(q.options || []).map((opt, optIndex) => `
                  <button
                    type="button"
                    class="quiz-option-btn"
                    data-q-index="${qIndex}"
                    data-opt-index="${optIndex}"
                  >
                    <span class="option-marker font-mono">${String.fromCharCode(65 + optIndex)}</span>
                    <span class="option-text">${escapeHtml(opt)}</span>
                  </button>
                `).join('')}
              </div>

              <!-- Explanation Box (revealed on selection) -->
              <div class="quiz-explanation-box" id="explanation-${qIndex}" style="display: none;">
                <div class="explanation-title font-mono">[EXPLANATION & ANALYSIS]</div>
                <div class="explanation-content">${escapeHtml(q.explanation)}</div>
              </div>
            </div>
          `).join('')}

          <!-- Quiz Results & Submission Footer -->
          <div class="quiz-results-card" id="quiz-results-container">
            <div class="results-left">
              <div class="results-score-label">Current Examination Score:</div>
              <div class="results-score-num font-mono" id="quiz-score-display">0 / ${quizQuestions.length} Answered</div>
            </div>
            <div class="results-right">
              <button type="button" class="btn btn-primary" id="btn-submit-quiz" disabled>
                Inscribe Score & Award XP
              </button>
            </div>
          </div>
        </div>
      `}
    </section>
  `;
}

function formatParagraphs(text) {
  if (!text) return '';
  const paras = text.split(/\n\s*\n/);
  return paras.map(p => `<p class="lesson-para">${escapeHtml(p.trim())}</p>`).join('');
}

function setupLessonEventListeners(container, roadmap, node, lesson, quizQuestions, userAnswers, router) {
  // Jump to quiz button smooth scrolling
  container.querySelector('#btn-jump-quiz')?.addEventListener('click', (e) => {
    e.preventDefault();
    const quizEl = container.querySelector('#quiz');
    if (quizEl) {
      quizEl.scrollIntoView({ behavior: 'smooth' });
      history.replaceState(null, null, `#/roadmap/${roadmap.id}/topic/${node.id}/lesson/${lesson.id}#quiz`);
    }
  });

  // Modal open/close for lesson synthesis
  const synthModal = container.querySelector('#modal-synthesize-lesson');
  const openSynthBtns = container.querySelectorAll('#btn-open-synth-modal, #btn-open-resynth-modal, #btn-trigger-inline-synth');
  openSynthBtns.forEach(b => {
    b?.addEventListener('click', () => {
      synthModal.style.display = 'flex';
    });
  });

  const closeSynth = () => { synthModal.style.display = 'none'; };
  container.querySelector('#btn-close-synth-modal')?.addEventListener('click', closeSynth);
  container.querySelector('#btn-cancel-synth-modal')?.addEventListener('click', closeSynth);
  container.querySelector('#btn-cancel-synth-external')?.addEventListener('click', closeSynth);

  // Tabs inside synthesis modal
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

  // Copy prompt button
  container.querySelector('#btn-copy-stage2-prompt')?.addEventListener('click', async () => {
    const promptText = buildSingleLessonPrompt({
      topicTitle: node.title,
      lessonOutline: lesson,
      url: lesson.sourceUrl || '',
      rawText: lesson.rawSourceContext || ''
    });

    const copied = await copyToClipboard(promptText);
    const feedback = container.querySelector('#stage2-copy-feedback');
    if (feedback) {
      feedback.textContent = copied ? '✓ Copied to Clipboard!' : 'Failed to copy';
      feedback.style.display = 'inline';
      setTimeout(() => { feedback.style.display = 'none'; }, 2500);
    }
  });

  // Direct API submit inside lessonView
  const formSynthApi = container.querySelector('#form-synth-api');
  const stage2Error = container.querySelector('#stage2-error-box');
  const stage2Spinner = container.querySelector('#stage2-progress-indicator');
  const stage2SubmitBtn = container.querySelector('#btn-submit-stage2-api');

  formSynthApi?.addEventListener('submit', async (e) => {
    e.preventDefault();
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
        lessonOutline: lesson,
        url: lesson.sourceUrl || '',
        rawText: lesson.rawSourceContext || ''
      });

      await applySynthesizedLesson(lesson.id, detailedLesson);
      synthModal.style.display = 'none';
      renderLessonView(container, { id: roadmap.id, topicId: node.id, lessonId: lesson.id, router });
    } catch (err) {
      stage2Error.innerHTML = `<strong>Synthesis Failed:</strong> ${escapeHtml(err.message)}`;
      stage2Error.style.display = 'block';
    } finally {
      stage2Spinner.style.display = 'none';
      stage2SubmitBtn.disabled = false;
    }
  });

  // External JSON verify inside lessonView
  const btnVerifyStage2Json = container.querySelector('#btn-verify-stage2-json');
  const stage2ExternalError = container.querySelector('#stage2-external-error-box');

  btnVerifyStage2Json?.addEventListener('click', async () => {
    stage2ExternalError.style.display = 'none';
    const jsonText = container.querySelector('#stage2-external-json').value.trim();

    if (!jsonText) {
      stage2ExternalError.textContent = 'Please paste the JSON response from your external chatbot.';
      stage2ExternalError.style.display = 'block';
      return;
    }

    try {
      const detailedLesson = parseAndValidateLessonJson(jsonText);
      await applySynthesizedLesson(lesson.id, detailedLesson);
      synthModal.style.display = 'none';
      renderLessonView(container, { id: roadmap.id, topicId: node.id, lessonId: lesson.id, router });
    } catch (err) {
      stage2ExternalError.innerHTML = `<strong>Validation Error:</strong> ${escapeHtml(err.message)}`;
      stage2ExternalError.style.display = 'block';
    }
  });

  async function applySynthesizedLesson(lessonId, detailedLesson) {
    await updateLesson(lessonId, {
      title: detailedLesson.title || lesson.title,
      citation: detailedLesson.citation || lesson.citation,
      summary: detailedLesson.summary || '',
      keyTakeaways: detailedLesson.keyTakeaways || [],
      lessons: detailedLesson.lessons || [],
      quiz: detailedLesson.quiz || [],
      status: 'synthesized'
    });

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

  // Quiz Option selection handling
  const optionBtns = container.querySelectorAll('.quiz-option-btn');
  const submitQuizBtn = container.querySelector('#btn-submit-quiz');
  const scoreDisplay = container.querySelector('#quiz-score-display');

  optionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const qIndex = parseInt(btn.getAttribute('data-q-index'), 10);
      const optIndex = parseInt(btn.getAttribute('data-opt-index'), 10);

      if (userAnswers[qIndex] !== undefined) return;

      userAnswers[qIndex] = optIndex;
      const question = quizQuestions[qIndex];
      const isCorrect = optIndex === question.correctAnswerIndex;

      const siblingBtns = container.querySelectorAll(`.quiz-option-btn[data-q-index="${qIndex}"]`);
      siblingBtns.forEach(b => {
        const bOptIndex = parseInt(b.getAttribute('data-opt-index'), 10);
        b.disabled = true;
        if (bOptIndex === question.correctAnswerIndex) {
          b.classList.add('option-correct');
        } else if (bOptIndex === optIndex && !isCorrect) {
          b.classList.add('option-incorrect');
        }
      });

      const statusTag = container.querySelector(`#q-status-${qIndex}`);
      if (statusTag) {
        statusTag.textContent = isCorrect ? '✓ Verified Correct' : '✕ Incorrect';
        statusTag.className = `question-status-tag ${isCorrect ? 'status-correct' : 'status-incorrect'}`;
      }

      const expBox = container.querySelector(`#explanation-${qIndex}`);
      if (expBox) {
        expBox.style.display = 'block';
      }

      const answeredCount = Object.keys(userAnswers).length;
      let correctCount = 0;
      for (const [idx, chosen] of Object.entries(userAnswers)) {
        if (chosen === quizQuestions[idx].correctAnswerIndex) {
          correctCount++;
        }
      }

      const scorePct = Math.round((correctCount / quizQuestions.length) * 100);
      if (scoreDisplay) {
        scoreDisplay.textContent = `${correctCount} / ${quizQuestions.length} Correct (${scorePct}%)`;
      }

      if (answeredCount === quizQuestions.length && submitQuizBtn) {
        submitQuizBtn.disabled = false;
        submitQuizBtn.classList.add('btn-pulse');
      }
    });
  });

  // Submit Quiz Button
  submitQuizBtn?.addEventListener('click', async () => {
    let correctCount = 0;
    for (const [idx, chosen] of Object.entries(userAnswers)) {
      if (chosen === quizQuestions[idx].correctAnswerIndex) {
        correctCount++;
      }
    }
    const scorePct = Math.round((correctCount / quizQuestions.length) * 100);

    submitQuizBtn.disabled = true;
    submitQuizBtn.textContent = 'Inscribing Results...';

    await updateLesson(lesson.id, {
      completed: true,
      score: scorePct
    });

    let xpToAward = XP_VALUES.QUIZ_COMPLETED;
    let reason = `Completed Quiz: ${lesson.title} (${scorePct}%)`;

    if (scorePct === 100) {
      xpToAward += XP_VALUES.QUIZ_PERFECT;
      reason += ' [100% PERFECT RECITATION BONUS]';
    }

    await awardXP(xpToAward, reason);

    submitQuizBtn.textContent = 'Examination Recorded ✓';
    submitQuizBtn.classList.remove('btn-pulse');

    if (typeof window.confetti === 'function') {
      window.confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#C86446', '#2E5C52', '#F4CE42', '#1E232A']
      });
    }

    const celebrationMsg = scorePct === 100
      ? `🎉 Flawless Score! 100% Correct. Awarded +${xpToAward} XP!`
      : `✓ Examination Inscribed with ${scorePct}%. Awarded +${xpToAward} XP!`;

    alert(celebrationMsg);
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
