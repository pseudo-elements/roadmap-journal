import { getUserStats, getStorageQuotaEstimate, exportDatabaseToJson, importDatabaseFromJson, db } from '../db.js';
import { getLevelDetails, BADGE_DEFINITIONS } from '../gamification.js';

export async function renderProgressView(container, { router }) {
  const [stats, quota, roadmapsCount, nodes, lessons, flashcards] = await Promise.all([
    getUserStats(),
    getStorageQuotaEstimate(),
    db.roadmaps.count(),
    db.nodes.toArray(),
    db.lessons.toArray(),
    db.flashcards.toArray()
  ]);

  const levelInfo = getLevelDetails(stats.totalXP);
  const completedNodesCount = nodes.filter(n => n.status === 'completed').length;
  const inProgressNodesCount = nodes.filter(n => n.status === 'in_progress').length;
  const completedQuizzesCount = lessons.filter(l => l.completed).length;
  const perfectQuizzesCount = lessons.filter(l => l.score === 100).length;

  const unlockedBadgeIds = new Map();
  if (Array.isArray(stats.badges)) {
    stats.badges.forEach(b => {
      const id = typeof b === 'string' ? b : b.id;
      const date = typeof b === 'object' && b.unlockedAt ? b.unlockedAt : null;
      unlockedBadgeIds.set(id, date);
    });
  }

  container.innerHTML = `
    <div class="field-container page-progress">
      <!-- Breadcrumb Bar -->
      <nav class="archival-breadcrumb">
        <a href="#/" class="breadcrumb-link">← Field Index</a>
        <span class="breadcrumb-separator">/</span>
        <span class="breadcrumb-current">[ARCHIVAL LOG & PROGRESS]</span>
      </nav>

      <!-- Folio Header -->
      <header class="folio-header">
        <div class="header-left">
          <div class="field-stamp">[SCHOLAR RECORD & METRICS]</div>
          <h1 class="display-title">Archival Ledger & Scholar Rank</h1>
          <p class="editorial-subtitle">A longitudinal record of knowledge acquisition, active study streaks, collectible seals, and local storage quota.</p>
        </div>
        <div class="header-right">
          <a href="#/progress/challenges" class="btn btn-primary">
            🗂️ Open Spaced Repetition Queue →
          </a>
        </div>
      </header>

      <!-- Bento Grid: Top Stats -->
      <section class="progress-bento-grid">
        <!-- Card 1: Streak -->
        <div class="bento-card bento-streak">
          <div class="bento-header font-mono">[DAILY FIELD STREAK]</div>
          <div class="streak-hero-display">
            <span class="streak-flame">🔥</span>
            <div class="streak-data">
              <span class="streak-large-number">${stats.streakCount || 0}</span>
              <span class="streak-unit-label">Consecutive Days</span>
            </div>
          </div>
          <div class="bento-footer font-mono">
            <span>LAST ACTIVITY: ${stats.lastActiveDate || 'None Recorded'}</span>
          </div>
        </div>

        <!-- Card 2: Level & XP -->
        <div class="bento-card bento-xp">
          <div class="bento-header font-mono">[SCHOLAR TITLE & RANK]</div>
          <div class="rank-hero-display">
            <div class="rank-badge-medal">🎖️</div>
            <div>
              <div class="rank-level-label font-mono">LEVEL 0${levelInfo.level}</div>
              <div class="rank-name-title">${levelInfo.title}</div>
            </div>
          </div>

          <div class="rank-xp-bar-container">
            <div class="progress-meta-row font-mono">
              <span>${stats.totalXP} Total XP</span>
              <span>${levelInfo.nextTier ? `${levelInfo.xpNeededForNext} XP to Lvl ${levelInfo.level + 1}` : 'Maximum Mastery Tier'}</span>
            </div>
            <div class="progress-track">
              <div class="progress-bar bar-xp" style="width: ${levelInfo.progressPercentage}%;"></div>
            </div>
          </div>
        </div>

        <!-- Card 3: Cartography Metrics -->
        <div class="bento-card bento-metrics">
          <div class="bento-header font-mono">[ARCHIVAL CENSUS]</div>
          <div class="metrics-grid">
            <div class="metric-cell">
              <span class="metric-val font-mono">${roadmapsCount}</span>
              <span class="metric-lbl">Active Roadmaps</span>
            </div>
            <div class="metric-cell">
              <span class="metric-val font-mono">${completedNodesCount}</span>
              <span class="metric-lbl">Mastered Topics</span>
            </div>
            <div class="metric-cell">
              <span class="metric-val font-mono">${lessons.length}</span>
              <span class="metric-lbl">Synthesized Lessons</span>
            </div>
            <div class="metric-cell">
              <span class="metric-val font-mono">${completedQuizzesCount}</span>
              <span class="metric-lbl">Quizzes Passed</span>
            </div>
            <div class="metric-cell">
              <span class="metric-val font-mono">${perfectQuizzesCount}</span>
              <span class="metric-lbl">100% Recitations</span>
            </div>
            <div class="metric-cell">
              <span class="metric-val font-mono">${flashcards.length}</span>
              <span class="metric-lbl">SRS Flashcards</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Collectible Badges Gallery -->
      <section class="badges-section">
        <div class="section-heading-row">
          <div>
            <div class="field-stamp">[HONORS & WAX SEALS]</div>
            <h2 class="editorial-title">Archival Seals & Milestones</h2>
          </div>
          <span class="monospace-tag">[UNLOCKED: ${unlockedBadgeIds.size} / ${BADGE_DEFINITIONS.length}]</span>
        </div>

        <div class="badges-grid">
          ${BADGE_DEFINITIONS.map(badge => {
            const isUnlocked = unlockedBadgeIds.has(badge.id);
            const dateStr = unlockedBadgeIds.get(badge.id);

            return `
              <div class="badge-card ${isUnlocked ? 'badge-unlocked' : 'badge-locked'}">
                <div class="badge-icon-box">
                  <span class="badge-emoji">${badge.icon}</span>
                  ${isUnlocked ? '<span class="seal-ring"></span>' : ''}
                </div>
                <div class="badge-content">
                  <div class="badge-cat-label font-mono">[${badge.category.toUpperCase()}]</div>
                  <h3 class="badge-title">${escapeHtml(badge.title)}</h3>
                  <p class="badge-desc">${escapeHtml(badge.desc)}</p>
                  <div class="badge-status-row font-mono">
                    ${isUnlocked
                      ? `<span class="badge-earned-tag">✓ UNLOCKED ${dateStr ? new Date(dateStr).toLocaleDateString() : ''}</span>`
                      : '<span class="badge-locked-tag">🔒 SEAL LOCKED</span>'}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>

      <!-- Storage Quota & Backup / Restore Section -->
      <section class="storage-backup-section">
        <div class="section-heading-row">
          <div>
            <div class="field-stamp">[STORAGE & DATA SOVEREIGNTY]</div>
            <h2 class="editorial-title">Local IndexedDB Quota & Archival Backups</h2>
          </div>
        </div>

        <div class="storage-grid">
          <!-- Quota Monitor -->
          <div class="storage-card quota-card">
            <h3 class="storage-card-title">IndexedDB Physical Quota</h3>
            <p class="modal-desc">All your roadmaps, topics, synthesized lessons, and flashcards reside solely inside this browser's local sandbox.</p>
            <div class="quota-meter-wrapper">
              <div class="progress-meta-row font-mono">
                <span>Usage: ${quota.usageFormatted}</span>
                <span>Quota: ${quota.quotaFormatted} (${quota.percentage}%)</span>
              </div>
              <div class="progress-track">
                <div class="progress-bar bar-quota" style="width: ${Math.max(1, quota.percentage)}%;"></div>
              </div>
            </div>
            <div class="storage-meta-hint font-mono">
              [ZERO SERVER STORAGE // COMPLETE LOCAL PRIVACY]
            </div>
          </div>

          <!-- Backup Export & Restore -->
          <div class="storage-card backup-card">
            <h3 class="storage-card-title">Archival Backup & Restoration</h3>
            <p class="modal-desc">Export your entire journal ledger to a standalone JSON archive or restore a previous volume.</p>
            
            <div class="backup-actions-row">
              <button id="btn-export-backup" class="btn btn-primary">
                📥 Export Ledger (JSON)
              </button>

              <label class="btn btn-secondary file-upload-btn">
                📤 Restore Archive
                <input type="file" id="input-restore-backup" accept=".json" style="display: none;" />
              </label>
            </div>

            <div id="restore-status-message" class="restore-feedback font-mono" style="display: none;"></div>
          </div>
        </div>
      </section>
    </div>
  `;

  setupProgressEventListeners(container, router);
}

function setupProgressEventListeners(container, router) {
  // Export JSON Backup
  container.querySelector('#btn-export-backup')?.addEventListener('click', async () => {
    try {
      const backupData = await exportDatabaseToJson();
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const d = new Date();
      const dateTag = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      const filename = `roadmap_journal_backup_${dateTag}.json`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    }
  });

  // Restore JSON Backup
  const restoreInput = container.querySelector('#input-restore-backup');
  const restoreFeedback = container.querySelector('#restore-status-message');

  restoreInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('Restoring will replace current journal contents with the backup file. Proceed?')) {
      restoreInput.value = '';
      return;
    }

    try {
      restoreFeedback.style.display = 'block';
      restoreFeedback.textContent = 'Parsing & restoring archive...';

      const fileText = await file.text();
      const backup = JSON.parse(fileText);

      await importDatabaseFromJson(backup);

      restoreFeedback.textContent = '✓ Restoration Successful! Reloading...';
      setTimeout(() => {
        renderProgressView(container, { router });
      }, 1000);
    } catch (err) {
      restoreFeedback.textContent = `✕ Restoration Error: ${err.message}`;
    } finally {
      restoreInput.value = '';
    }
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
