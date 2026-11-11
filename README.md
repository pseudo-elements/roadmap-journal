# Roadmap Journal & Archival Learning Tracker

> **Field Notebook & Archival Stationery** — A tactile, client-side web application for personal roadmap journaling, learning tracking, and spaced repetition gamification. Strictly adhering to [DESIGN.md](file:///media/data/Documents/Personal/Projects/Computer-Programming/Websites/roadmap-tracker/DESIGN.md).

---

## 📜 Architectural Pillars

1. **Zero Backend / Complete Local Sovereignty:**
   - 100% client-side application built in standard HTML5, CSS3, and modern Vanilla JavaScript (ES6 Modules).
   - All state, roadmaps, topic notes, synthesized lessons, and spaced repetition flashcards reside strictly in IndexedDB powered by **Dexie.js**.
2. **Zero Credential Persistence Guarantee:**
   - User Google Gemini API Keys are **NEVER** stored in `LocalStorage`, `SessionStorage`, `Cookies`, or `IndexedDB`.
   - API keys exist transiently in volatile JavaScript memory strictly during active API requests.
3. **Progressive Two-Stage Resource Ingestion & Pagination:**
   - **Stage 1 (Curriculum Outline Mapping):** Ingests long videos, books, courses, or transcripts and breaks them down into discrete, bite-sized lessons with precise citations (e.g. timestamps `00:15:30 - 00:45:00` or page ranges `pp. 45-68`).
   - **Stage 2 (Granular Lesson Synthesis):** The user progressively compiles individual lessons on demand, generating deep explanatory sections, multiple-choice quizzes, and SRS flashcards without overwhelming the LLM or losing nuance.
4. **Universal AI Fallback (Copy Prompt & Paste Validation):**
   - For both Stage 1 and Stage 2, users can click **"Copy Prompt"** to query any external chatbot (ChatGPT, Claude, Gemini Web, DeepSeek, local LLMs) and paste the JSON response back into the app with automated verification.
5. **Gemini Model Selection:**
   - Supports selecting between `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.0-flash`, `gemini-2.0-flash-lite`, `gemini-1.5-flash`, and `gemini-1.5-pro`.
6. **Client-Side Hash Router (`window.location.hash`):**
   - Pure JS routing mapping clean paths to modular view controller functions without requiring server-side routing logic.

---

## 🗺️ Route Specifications

| Route Path | View Controller | Description |
| :--- | :--- | :--- |
| `/#/` | [`homeView.js`](file:///media/data/Documents/Personal/Projects/Computer-Programming/Websites/roadmap-tracker/js/views/homeView.js) | Active curriculum volumes, mastery %, custom roadmap creation, and roadmap.sh JSON/preset importer |
| `/#/roadmap/:id` | [`roadmapView.js`](file:///media/data/Documents/Personal/Projects/Computer-Programming/Websites/roadmap-tracker/js/views/roadmapView.js) | Topic nodes timeline spine, status toggles (`Pending` → `In Progress` → `Completed`), and live note editor |
| `/#/roadmap/:id/topic/:topicId` | [`topicView.js`](file:///media/data/Documents/Personal/Projects/Computer-Programming/Websites/roadmap-tracker/js/views/topicView.js) | Topic dossier, list of outlined and synthesized lessons, Stage 1 Outline Mapping, and Stage 2 Lesson Synthesis modals |
| `/#/roadmap/:id/topic/:topicId/lesson/:lessonId` | [`lessonView.js`](file:///media/data/Documents/Personal/Projects/Computer-Programming/Websites/roadmap-tracker/js/views/lessonView.js) | Lesson reading folio with executive brief, citation tag, core axioms, modular analysis, code blocks, and quick anchor jump to `#quiz` |
| `.../lesson/:lessonId#quiz` | [`lessonView.js`](file:///media/data/Documents/Personal/Projects/Computer-Programming/Websites/roadmap-tracker/js/views/lessonView.js) | Interactive multiple-choice examination with immediate feedback, pedagogical explanations, and XP awards |
| `/#/progress` | [`progressView.js`](file:///media/data/Documents/Personal/Projects/Computer-Programming/Websites/roadmap-tracker/js/views/progressView.js) | Daily streak counter, scholar level & rank title, collectible wax seals gallery, IndexedDB quota monitor, and JSON export/restore |
| `/#/progress/challenges` | [`challengesView.js`](file:///media/data/Documents/Personal/Projects/Computer-Programming/Websites/roadmap-tracker/js/views/challengesView.js) | Daily Spaced Repetition (SRS) 3D flashcard review queue with `Hard`, `Good`, and `Easy` interval calibration |

---

## 🗂️ Project Directory Structure

```text
roadmap-tracker/
├── index.html                   # SPA Application shell, Google Fonts, and CDNs
├── styles.css                   # Archival stationery design system & dark/light themes
├── DESIGN.md                    # Visual specification and design token documentation
├── README.md                    # Project documentation & operational guide
└── js/
    ├── app.js                   # Application bootstrap, navbar bindings, theme toggler, and demo seeder
    ├── db.js                    # Dexie.js database schema, versioning, migrations, and CRUD helpers
    ├── router.js                # Lightweight hash router with sub-anchor support (#quiz)
    ├── aiService.js             # Dual-stage schemas, prompt builders, JSON validators, and Gemini SDK
    ├── gamification.js          # XP engine, daily streak evaluator, badge verifier, and SM-2 SRS calculator
    ├── roadmapImporter.js       # roadmap.sh graph parser & curated curriculum presets
    └── views/
        ├── homeView.js          # Route: /#/
        ├── roadmapView.js       # Route: /#/roadmap/:id
        ├── topicView.js         # Route: /#/roadmap/:id/topic/:topicId
        ├── lessonView.js        # Route: /#/roadmap/:id/topic/:topicId/lesson/:lessonId (& #quiz)
        ├── progressView.js      # Route: /#/progress
        └── challengesView.js    # Route: /#/progress/challenges
```

---

## 🎨 Design System: Field Notebook & Archival Stationery

The interface replicates the tangible sensory experience of physical stationery, laboratory field notes, and archival manuscripts:
- **Paper Stocks:** Base Canvas (`#FAF8F5`), Sheet Stock (`#F4EFE6`), Kraft Sepia (`#E2D9CC` / `#D5C7B2`).
- **Inks:** Deep carbon charcoal (`#1E232A`), 2B graphite pencil (`#5A646E`), faint drafting grey (`#A8A29E`).
- **Stationery Accents:** Terracotta wax stamp (`#C86446`), Botanical sage (`#2E5C52`), Ochre highlighter (`#F4CE42`), Drafting cyan (`#3B82F6`).
- **Tactile Depth:** Hard block cast shadows (`box-shadow: 2px 2px 0 var(--surface-kraft-dark)`), pressed debossed insets, washi-tape tabs, citation locator chips, and rubber-stamped verification seals (`[VERIFIED // DONE]` at a -4° angle).
- **Dual Themes:** Light (Parchment Ledger) and Dark (Blueprint Slate) with zero credential storage (only theme preference is stored).

---

## 🧠 Spaced Repetition (SRS) Keyboard Shortcuts

When reviewing flashcards in `/#/progress/challenges`:
- `Space` or `Enter`: Flip card between Prompt (Side A) and Synthesis (Side B).
- `1`: Rate recall as **Hard** (interval resets to 1 day; +5 XP).
- `2`: Rate recall as **Good** (interval scales by ~1.8×; +5 XP).
- `3`: Rate recall as **Easy** (interval scales by ~2.5×; +5 XP).

---

## 🚀 Running the Application Locally

Because the application uses standard ES6 modules (`import`/`export`), it should be served via any local HTTP server:

```bash
# Using Python 3:
python3 -m http.server 8080

# Or using Node.js npx:
npx serve .

# Or using Vite / Live Server in VS Code
```

Then open your browser at `http://localhost:8080` (or the port specified).
On initial launch, a curated **Frontend Web Engineering** curriculum volume and introductory lesson are automatically inscribed into your local IndexedDB to provide immediate exploration.
