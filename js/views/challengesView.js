import { getDueFlashcards, getAllFlashcards, updateFlashcard, getNode, getRoadmap } from '../db.js';
import { awardXP, XP_VALUES, calculateSrsInterval } from '../gamification.js';

export async function renderChallengesView(container, { router }) {
  let dueCards = await getDueFlashcards();
  let currentIndex = 0;
  let isFlipped = false;
  let isPracticeMode = false;

  // Enhance cards with topic node titles for context
  async function enrichCards(cards) {
    return await Promise.all(
      cards.map(async (c) => {
        let topicTitle = 'Field Topic';
        if (c.nodeId) {
          const node = await getNode(c.nodeId);
          if (node) topicTitle = node.title;
        }
        return { ...c, topicTitle };
      })
    );
  }

  let enrichedCards = await enrichCards(dueCards);

  function render() {
    container.innerHTML = `
      <div class="field-container page-challenges">
        <!-- Breadcrumb Bar -->
        <nav class="archival-breadcrumb">
          <a href="#/" class="breadcrumb-link">← Field Index</a>
          <span class="breadcrumb-separator">/</span>
          <a href="#/progress" class="breadcrumb-link">Progress Ledger</a>
          <span class="breadcrumb-separator">/</span>
          <span class="breadcrumb-current">[SPACED REPETITION SYSTEM]</span>
        </nav>

        <!-- Folio Header -->
        <header class="folio-header">
          <div class="header-left">
            <div class="field-stamp">[MNEMONIC VERIFICATION LAB]</div>
            <h1 class="display-title">Spaced Repetition & Daily Challenges</h1>
            <p class="editorial-subtitle">Optimized review intervals reinforce neural memory pathways. Rate your recall confidence to calibrate future review intervals.</p>
          </div>
          <div class="header-right">
            <div class="stat-pill">
              <span class="stat-icon">🗂️</span>
              <div class="stat-meta">
                <span class="stat-num">${enrichedCards.length - currentIndex}</span>
                <span class="stat-lbl">${isPracticeMode ? 'Practice Remaining' : 'Cards Due Today'}</span>
              </div>
            </div>
          </div>
        </header>

        <!-- Active Flashcard Arena or Finished Queue -->
        ${currentIndex >= enrichedCards.length ? renderCompletedQueue() : renderActiveCard()}
      </div>
    `;

    attachListeners();
  }

  function renderActiveCard() {
    const card = enrichedCards[currentIndex];
    const totalCount = enrichedCards.length;
    const currentNum = currentIndex + 1;
    const progressPct = Math.round((currentNum / totalCount) * 100);

    return `
      <div class="srs-stage">
        <!-- Progress Bar Strip -->
        <div class="srs-progress-bar-row">
          <div class="progress-meta-row font-mono">
            <span>CARD ${currentNum} OF ${totalCount}</span>
            <span>CURRENT INTERVAL: ${card.intervalDays || 1} DAYS</span>
          </div>
          <div class="progress-track">
            <div class="progress-bar" style="width: ${progressPct}%;"></div>
          </div>
        </div>

        <!-- 3D Flippable Card Scene -->
        <div class="flashcard-scene" id="flashcard-scene">
          <div class="flashcard ${isFlipped ? 'flipped' : ''}" id="flashcard-element">
            <!-- Front Face -->
            <div class="flashcard-face flashcard-front">
              <div class="card-face-header font-mono">
                <span class="topic-tag">[${escapeHtml(card.topicTitle)}]</span>
                <span class="field-stamp">[PROMPT // SIDE A]</span>
              </div>
              <div class="card-face-body">
                <p class="flashcard-prompt-text">${escapeHtml(card.front)}</p>
              </div>
              <div class="card-face-footer font-mono">
                <span class="flip-hint-badge">CLICK OR PRESS SPACE TO FLIP ↩</span>
              </div>
            </div>

            <!-- Back Face -->
            <div class="flashcard-face flashcard-back">
              <div class="card-face-header font-mono">
                <span class="topic-tag">[${escapeHtml(card.topicTitle)}]</span>
                <span class="field-stamp">[SYNTHESIS // SIDE B]</span>
              </div>
              <div class="card-face-body">
                <p class="flashcard-answer-text">${escapeHtml(card.back)}</p>
              </div>
              <div class="card-face-footer font-mono">
                <span class="flip-hint-badge">SELECT RETRIEVAL CONFIDENCE BELOW ↓</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Confidence Rating Controls -->
        <div class="srs-controls-row">
          <button class="btn-srs-rating srs-hard" data-quality="hard" title="Shortcut: Press 1">
            <div class="srs-btn-title">Hard (1)</div>
            <div class="srs-btn-sub font-mono">Interval: 1 Day</div>
          </button>

          <button class="btn-srs-rating srs-good" data-quality="good" title="Shortcut: Press 2">
            <div class="srs-btn-title">Good (2)</div>
            <div class="srs-btn-sub font-mono">Interval: ~${Math.max(2, Math.round((card.intervalDays || 1) * 1.8))} Days</div>
          </button>

          <button class="btn-srs-rating srs-easy" data-quality="easy" title="Shortcut: Press 3">
            <div class="srs-btn-title">Easy (3)</div>
            <div class="srs-btn-sub font-mono">Interval: ~${Math.max(4, Math.round((card.intervalDays || 1) * 2.5))} Days</div>
          </button>
        </div>

        <div class="keyboard-shortcuts-hint font-mono">
          [KEYBOARD CONTROLS: SPACE = FLIP CARD | 1 = HARD | 2 = GOOD | 3 = EASY]
        </div>
      </div>
    `;
  }

  function renderCompletedQueue() {
    return `
      <div class="empty-folio-card srs-finished-card">
        <div class="paper-clip-ornament">🎖️</div>
        <div class="field-stamp">[DAILY RETENTION COMPLETE]</div>
        <h2 class="editorial-title">Memory Queue Cleared for Today!</h2>
        <p class="editorial-desc">You have reviewed all due flashcards in your active rotation. Your conceptual retention is calibrated and in equilibrium.</p>
        <div class="empty-action-group">
          <button class="btn btn-secondary" id="btn-practice-all">
            📚 Review All Flashcards (Practice Mode)
          </button>
          <a href="#/progress" class="btn btn-primary">
            View Archival Progress →
          </a>
        </div>
      </div>
    `;
  }

  function attachListeners() {
    const cardElement = container.querySelector('#flashcard-element');
    const scene = container.querySelector('#flashcard-scene');

    // Click to flip
    scene?.addEventListener('click', () => {
      isFlipped = !isFlipped;
      cardElement?.classList.toggle('flipped', isFlipped);
    });

    // Rating buttons
    const ratingBtns = container.querySelectorAll('.btn-srs-rating');
    ratingBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const quality = btn.getAttribute('data-quality');
        await processCardReview(quality);
      });
    });

    // Practice all cards button
    container.querySelector('#btn-practice-all')?.addEventListener('click', async () => {
      const allCards = await getAllFlashcards();
      if (allCards.length === 0) {
        alert('No flashcards found in your archive yet. Ingest lessons with Gemini to generate cards.');
        return;
      }
      enrichedCards = await enrichCards(allCards);
      currentIndex = 0;
      isFlipped = false;
      isPracticeMode = true;
      render();
    });
  }

  async function processCardReview(quality) {
    if (currentIndex >= enrichedCards.length) return;

    const currentCard = enrichedCards[currentIndex];
    const srsUpdate = calculateSrsInterval(currentCard.intervalDays || 1, quality);

    // Save to IndexedDB
    await updateFlashcard(currentCard.id, {
      intervalDays: srsUpdate.intervalDays,
      dueAt: srsUpdate.dueAt
    });

    // Award +5 XP per review
    await awardXP(XP_VALUES.FLASHCARD_REVIEWED, `Reviewed Flashcard: ${currentCard.front.slice(0, 25)}...`);

    // Advance queue
    currentIndex++;
    isFlipped = false;

    // If reached end, celebrate!
    if (currentIndex >= enrichedCards.length) {
      if (typeof window.confetti === 'function') {
        window.confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#2E5C52', '#F4CE42', '#C86446']
        });
      }
    }

    render();
  }

  // Keyboard shortcut listener
  const keyHandler = async (e) => {
    // Only handle if not in an input/textarea
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

    if (e.code === 'Space' || e.key === 'Enter') {
      e.preventDefault();
      const cardElement = container.querySelector('#flashcard-element');
      if (cardElement) {
        isFlipped = !isFlipped;
        cardElement.classList.toggle('flipped', isFlipped);
      }
    } else if (e.key === '1') {
      await processCardReview('hard');
    } else if (e.key === '2') {
      await processCardReview('good');
    } else if (e.key === '3') {
      await processCardReview('easy');
    }
  };

  window.addEventListener('keydown', keyHandler);

  render();

  // Return cleanup function to remove keydown listener when unmounted
  return () => {
    window.removeEventListener('keydown', keyHandler);
  };
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
