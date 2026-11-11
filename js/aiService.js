/**
 * AI Service for Gemini (2.5 Flash, 2.5 Pro, 2.0 Flash, etc.)
 * STRICT ARCHITECTURAL RULE: ZERO CREDENTIAL PERSISTENCE
 * User Gemini API Keys MUST NOT be stored in LocalStorage, SessionStorage, Cookies, or IndexedDB.
 * API keys only exist transiently in JavaScript memory during active API requests.
 */

// Volatile in-memory key storage (never written to disk or browser storage)
let volatileInMemoryKey = '';

export function setEphemeralSessionKey(key) {
  volatileInMemoryKey = typeof key === 'string' ? key.trim() : '';
}

export function getEphemeralSessionKey() {
  return volatileInMemoryKey;
}

export function clearEphemeralKey() {
  volatileInMemoryKey = '';
}

export const GEMINI_MODELS = [
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Default — Fast & Structured)', isDefault: true },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash',},
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Deep Reasoning & Analysis)' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Next-Gen Multimodal)' },
  { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash-Lite (Low Latency)' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (High Context)' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Extensive Context Reasoning)' }
];

export const DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * SCHEMA 1: Curriculum Outline Mapping (Stage 1)
 * Analyzes an entire resource (video, course, documentation, book) and maps it
 * into discrete, granular lessons with exact citations (timestamps, pages, sections).
 */
export const OUTLINE_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    sourceTitle: {
      type: "STRING",
      description: "Authoritative title of the source material or course"
    },
    sourceOverview: {
      type: "STRING",
      description: "Brief executive synopsis of the resource scope"
    },
    totalLessonsCount: {
      type: "INTEGER",
      description: "Total number of granular lessons mapped from this resource"
    },
    lessons: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: {
            type: "STRING",
            description: "Concise title of this specific modular lesson"
          },
          shortDescription: {
            type: "STRING",
            description: "1-2 sentence description of what this specific section covers"
          },
          citation: {
            type: "STRING",
            description: "Exact locator: timestamps (e.g. 00:15:30 - 00:45:00), page numbers (e.g. pp. 45-68), or chapter/subtopic section"
          },
          keyObjectives: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "2-3 specific learning outcomes for this lesson"
          }
        },
        required: ["title", "shortDescription", "citation"]
      },
      description: "List of granular, progressive lessons extracted from the resource"
    }
  },
  required: ["sourceTitle", "sourceOverview", "lessons"]
};

/**
 * SCHEMA 2: Granular Lesson Folio (Stage 2)
 * Synthesizes deep curriculum, takeaways, multiple-choice quiz questions,
 * and spaced repetition flashcards for a specific lesson section.
 */
export const LESSON_DETAIL_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: {
      type: "STRING",
      description: "Concise title for this synthesized lesson folio"
    },
    citation: {
      type: "STRING",
      description: "Confirmed timestamp, page range, or section reference"
    },
    summary: {
      type: "STRING",
      description: "Concise executive summary written in an archival, thoughtful editorial tone. Not too wordy, relevant info only."
    },
    keyTakeaways: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "4 to 6 concise critical mental models, rules of thumb, or core takeaways"
    },
    lessons: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          sectionTitle: { type: "STRING" },
          content: { type: "STRING", description: "Intuitive explanatory lesson body with consise paragraphs, technical specifics, and conceptual depth. Not too wordy, relevant info only." },
          codeSnippet: { type: "STRING", description: "Code snippet, diagram, or ASCII architecture illustrating the concept, if relevant" }
        },
        required: ["sectionTitle", "content"]
      },
      description: "2 to 4 detailed subsections breaking down this specific lesson clearly and concise. relevant info only."
    },
    quiz: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          question: { type: "STRING" },
          options: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "Exactly 4 distinct, plausible multiple-choice options"
          },
          correctAnswerIndex: {
            type: "INTEGER",
            description: "0-based index (0, 1, 2, or 3) of the correct option"
          },
          explanation: {
            type: "STRING",
            description: "Clear pedagogical explanation of why this answer is correct and why the alternatives are incorrect"
          }
        },
        required: ["question", "options", "correctAnswerIndex", "explanation"]
      },
      description: "3 to 5 multiple-choice questions assessing conceptual understanding for this lesson"
    },
    flashcards: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          front: { type: "STRING", description: "Clear, concise flashcard question or prompt" },
          back: { type: "STRING", description: "Definitive, high-impact answer or definition" }
        },
        required: ["front", "back"]
      },
      description: "3 to 6 high-yield spaced repetition flashcards for long-term retention"
    }
  },
  required: ["title", "summary", "keyTakeaways", "lessons", "quiz", "flashcards"]
};

/**
 * PROMPT BUILDER: Outline Mapping (Stage 1)
 * Used both for direct API calls and for the "Copy Prompt" fallback.
 */
export function buildOutlinePrompt({ topicTitle, url = '', rawText = '' }) {
  const hasUrl = Boolean(url && url.trim().length > 0);
  const hasRawText = Boolean(rawText && rawText.trim().length > 0);

  let sourceMaterial = '';
  if (hasUrl && hasRawText) {
    sourceMaterial = `Source URL: ${url.trim()}\n\nSource Content / Transcript / Syllabus:\n"""\n${rawText.trim()}\n"""`;
  } else if (hasUrl) {
    sourceMaterial = `Source URL: ${url.trim()}`;
  } else {
    sourceMaterial = `Source Content / Transcript / Syllabus:\n"""\n${rawText.trim()}\n"""`;
  }

  return `You are an archival curriculum architect and pedagogical cartographer.
Your mission is to analyze the provided learning resource for the topic "${topicTitle}" and map it out into a series of distinct, granular, bite-sized lessons.

CRITICAL INSTRUCTIONS:
1. Do NOT compress this entire resource into a single lesson. Instead, break it down logically by chapters, sections, modules, or timestamps so that a learner can study each part with high depth.
2. For each lesson, provide an exact citation:
   - For videos: provide the start and end timestamp range (e.g. "00:15:30 - 00:45:00")
   - For books/PDFs: provide the page range or chapter (e.g. "pp. 45-68" or "Chapter 3.2")
   - For articles/docs: provide the section name or header (e.g. "Section 2: Memory Models")
3. Include a concise title and a 1-2 sentence description for each lesson.
4. Remove ALL backticks and markdown charts or any other markdown formating. ALL text must be plain without markdown formating.
5. You MUST respond ONLY with a valid JSON object matching the JSON schema below. Do not wrap with conversational filler.

${sourceMaterial}

JSON SCHEMA SPECIFICATION:
{
  "sourceTitle": "string",
  "sourceOverview": "string",
  "totalLessonsCount": number,
  "lessons": [
    {
      "title": "string",
      "shortDescription": "string",
      "citation": "string (timestamps e.g. 00:10:00 - 00:35:00 or pages or section)",
      "keyObjectives": ["string"]
    }
  ]
}`;
}

/**
 * PROMPT BUILDER: Single Lesson Detailed Synthesis (Stage 2)
 * Targets ONLY the specified lesson section, ensuring deep granular analysis.
 */
export function buildSingleLessonPrompt({ topicTitle, lessonOutline, url = '', rawText = '' }) {
  const title = lessonOutline.title || 'Modular Lesson';
  const citation = lessonOutline.citation || 'Section';
  const shortDesc = lessonOutline.shortDescription || '';

  let sourceContext = '';
  if (url && url.trim()) {
    sourceContext += `Source URL: ${url.trim()}\n`;
  }
  if (rawText && rawText.trim()) {
    sourceContext += `Source Material / Transcript / Notes:\n"""\n${rawText.trim()}\n"""\n`;
  }

  return `You are an archival tutor, master researcher, and technical curriculum synthesizer.
Topic Volume: "${topicTitle}"
TARGET LESSON TO SYNTHESIZE: "${title}"
TARGET SECTION / CITATION: "${citation}"
BRIEF SCOPE: "${shortDesc}"

${sourceContext}

CRITICAL INSTRUCTIONS:
1. FOCUS EXCLUSIVELY ON THIS SPECIFIC SECTION/LESSON ("${title}", Citation: "${citation}").
   Do NOT give a generic high-level summary of the whole course/resource. Drill deeply into this specific concept with high technical depth, concrete mental models, and detailed explanations.
2. Structure the lesson with:
   - "title": authoritatively named lesson title
   - "citation": "${citation}"
   - "summary": thoughtful, editorial executive summary
   - "keyTakeaways": 4 to 6 critical axioms, mental models, or rules of thumb
   - "lessons": 2 to 4 detailed subsections with full explanatory paragraphs and code/diagram snippets where relevant
   - "quiz": 3 to 5 challenging multiple-choice questions assessing conceptual understanding (with 4 options, 0-based correctAnswerIndex, and detailed explanations)
   - "flashcards": 3 to 6 high-yield spaced repetition flashcards (front prompt & back answer)
3. Remove ALL backticks and markdown charts or any other markdown formating. ALL text must be without markdown formating.
4. You MUST respond ONLY with a valid JSON object strictly matching the schema below.

JSON SCHEMA SPECIFICATION:
{
  "title": "string",
  "citation": "${citation}",
  "summary": "string",
  "keyTakeaways": ["string"],
  "lessons": [
    {
      "sectionTitle": "string",
      "content": "string",
      "codeSnippet": "string (optional)"
    }
  ],
  "quiz": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctAnswerIndex": number (0 to 3),
      "explanation": "string"
    }
  ],
  "flashcards": [
    {
      "front": "string",
      "back": "string"
    }
  ]
}`;
}

/**
 * Robust JSON extraction and parsing utility.
 * Cleans markdown code fences, leading text, and handles edge cases.
 */
export function cleanAndParseJson(rawText) {
  if (typeof rawText !== 'string') {
    throw new Error('Expected string input for JSON parsing.');
  }

  let text = rawText.trim();

  // Strip Markdown code blocks if present (e.g. ```json ... ```)
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    text = codeBlockMatch[1].trim();
  } else {
    //strip all `
    // If no markdown fences, find first '{' and last '}'
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      text = text.substring(firstBrace, lastBrace + 1).trim();
    }
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    // Attempt minor recovery: remove trailing commas before } or ]
    const cleaned = text.replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(cleaned);
    } catch (secondErr) {
      throw new Error(`Invalid JSON format: ${err.message}. Please verify the response structure.`);
    }
  }
}

/**
 * Validates Outline JSON (Stage 1)
 */
export function parseAndValidateOutlineJson(rawText) {
  const data = cleanAndParseJson(rawText);

  if (!data || typeof data !== 'object') {
    throw new Error('Output must be a valid JSON object.');
  }

  if (!Array.isArray(data.lessons) || data.lessons.length === 0) {
    throw new Error('Output is missing a non-empty "lessons" array.');
  }

  data.lessons.forEach((item, idx) => {
    if (!item.title) {
      item.title = `Lesson ${idx + 1}`;
    }
    if (!item.citation) {
      item.citation = `Section ${idx + 1}`;
    }
    if (!item.shortDescription) {
      item.shortDescription = 'Curriculum study module.';
    }
  });

  return {
    sourceTitle: data.sourceTitle || 'Curriculum Resource',
    sourceOverview: data.sourceOverview || 'Curriculum breakdown.',
    totalLessonsCount: data.lessons.length,
    lessons: data.lessons
  };
}

/**
 * Validates Single Lesson Detailed JSON (Stage 2)
 */
export function parseAndValidateLessonJson(rawText) {
  const data = cleanAndParseJson(rawText);

  if (!data || typeof data !== 'object') {
    throw new Error('Output must be a valid JSON object.');
  }

  if (!data.title || !data.summary) {
    throw new Error('Lesson JSON must include "title" and "summary" strings.');
  }

  if (!Array.isArray(data.lessons) || data.lessons.length === 0) {
    throw new Error('Lesson JSON must include a "lessons" array with subsections.');
  }

  if (!Array.isArray(data.quiz) || data.quiz.length === 0) {
    throw new Error('Lesson JSON must include a "quiz" array with examination questions.');
  }

  if (!Array.isArray(data.flashcards)) {
    data.flashcards = [];
  }

  return data;
}

/**
 * STAGE 1: Generate Curriculum Outline via Gemini API
 */
export async function generateCurriculumOutline({
  apiKey,
  model = DEFAULT_MODEL,
  topicTitle,
  url = '',
  rawText = ''
}) {
  const key = apiKey || volatileInMemoryKey;
  if (!key) {
    throw new Error('Gemini API key is required. Keys are held transiently in memory only.');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const prompt = buildOutlinePrompt({ topicTitle, url, rawText });

  const hasUrl = Boolean(url && url.trim().length > 0);
  const hasRawText = Boolean(rawText && rawText.trim().length > 0);

  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: OUTLINE_RESPONSE_SCHEMA,
      temperature: 0.2
    }
  };

  // If URL only, try urlContext tool
  if (hasUrl && !hasRawText) {
    requestBody.tools = [{ urlContext: {} }];
  }

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
  } catch (netErr) {
    throw new Error(`Network failure connecting to Google Gemini API: ${netErr.message}`);
  }

  // Handle fallback if urlContext tool failed
  if (!response.ok && hasUrl && !hasRawText) {
    delete requestBody.tools;
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
  }

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(`Gemini API Error (${response.status}): ${errorJson.error?.message || response.statusText}`);
  }

  const result = await response.json();
  const rawTextOutput = result.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawTextOutput) {
    throw new Error('Gemini returned no content parts for the curriculum outline.');
  }

  return parseAndValidateOutlineJson(rawTextOutput);
}

/**
 * STAGE 2: Synthesize Individual Lesson via Gemini API
 */
export async function synthesizeSingleLesson({
  apiKey,
  model = DEFAULT_MODEL,
  topicTitle,
  lessonOutline,
  url = '',
  rawText = ''
}) {
  const key = apiKey || volatileInMemoryKey;
  if (!key) {
    throw new Error('Gemini API key is required. Keys are held transiently in memory only.');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const prompt = buildSingleLessonPrompt({ topicTitle, lessonOutline, url, rawText });

  const hasUrl = Boolean(url && url.trim().length > 0);
  const hasRawText = Boolean(rawText && rawText.trim().length > 0);

  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: LESSON_DETAIL_RESPONSE_SCHEMA,
      temperature: 0.3
    }
  };

  if (hasUrl && !hasRawText) {
    requestBody.tools = [{ urlContext: {} }];
  }

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
  } catch (netErr) {
    throw new Error(`Network failure connecting to Google Gemini API: ${netErr.message}`);
  }

  if (!response.ok && hasUrl && !hasRawText) {
    delete requestBody.tools;
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
  }

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(`Gemini API Error (${response.status}): ${errorJson.error?.message || response.statusText}`);
  }

  const result = await response.json();
  const rawTextOutput = result.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawTextOutput) {
    throw new Error('Gemini returned no content parts for this lesson synthesis.');
  }

  return parseAndValidateLessonJson(rawTextOutput);
}

/**
 * Backward compatibility wrapper
 */
export async function generateLessonWithTransientKey(options) {
  return await synthesizeSingleLesson({
    ...options,
    lessonOutline: {
      title: options.topicTitle,
      citation: 'Full Overview',
      shortDescription: 'Comprehensive synthesis'
    }
  });
}
