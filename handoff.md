# News Center — Architecture & Handoff

## Overview

News Center is a Vue 3 + TypeScript single-page app that researches news topics across the web using a 3-layer Gemini-powered pipeline, then renders structured briefs. Deployed to GitHub Pages at `/easynews/`.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         App.vue                             │
│  digSingleTopic() → fetchNewsForTopic()                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                    newsApi.ts                                │
│  fetchNewsForTopic() → runResearchPipeline()                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│               researchPipeline.ts                             │
│                                                             │
│  Layer 1 ──► Gemini Flash ──────────────────► classify +     │
│             (gemini-3-flash-preview)     suggestedQueries    │
│                                          ↓                  │
│  Layer 2 ──► Serper REST API ────────────► SourceArticle[]   │
│             (google.serper.dev/search)                      │
│                                          ↓                  │
│  Layer 3 ──► Gemini Pro ─────────────────► ResearchResult   │
│             (gemini-3.1-pro-preview)      → Markdown         │
└─────────────────────────────────────────────────────────────┘
```

### Layer 1 — Topic Intelligence (analyze)
- **Model**: `gemini-3-flash-preview` with `ThinkingLevel.MEDIUM`
- **Input**: topic label + preferred sources + timeframe
- **Output**: `Layer1Intelligence` — classification, angle, 3 `suggestedQueries`, responseStyle, priorityFactors
- **Prompt**: structured JSON only, no markdown fences

### Layer 2 — Source-Diversified Search (search)
- **No model tool calls** — Serper REST API called directly for reliable results
- `searchMultipleSerper(queries, timeframeDays)` fires all 3 queries in parallel
- Serper returns `tbs: qdr:w/m/y` based on timeframe
- Results deduplicated by URL, client-side date filtering via `parseRelativeDate` (handles "3 days ago" etc.)
- Returns `SourceArticle[]`

### Layer 3 — Structured Synthesis (synthesize)
- **Model**: `gemini-3.1-pro-preview` with `ThinkingLevel.HIGH`
- **Input**: topic + intelligence + up to 15 articles
- **Output**: `ResearchResult` — headline, coverage (primary/secondary/niche), keyFindings, implications, whatToWatch
- Rendered as Markdown via `renderResearchAsMarkdown()`

---

## Services

| File | Responsibility |
|------|---------------|
| `researchPipeline.ts` | 3-layer orchestration, pipeline entry point, markdown renderer |
| `searchService.ts` | Serper REST calls, URL dedup, relative date parsing |
| `newsApi.ts` | Thin wrapper around pipeline |
| `geminiClient.ts` | `GoogleGenAI` client factory |
| `apiKeyStore.ts` | Gemini API key localStorage CRUD |

---

## State Management

`useTopics.ts` composable:
- Module-level singleton `topics ref` — shared across entire app
- Persists to `localStorage` key `news-center-topics`
- Exports `topics`, `addTopic`, `removeTopic`, `updateTopic`, `mergeTopics`, `exportTopics`

**Topic lifecycle:**
```
idle → analyzing → searching → synthesizing → success
                                         → error
```

---

## Types

### Topic (`types/topic.ts`)
```typescript
interface Topic {
  id: string
  label: string
  status: TopicStatus          // 'idle'|'analyzing'|'searching'|'synthesizing'|'success'|'error'
  digEnabled: boolean
  sources: string[]
  answerLength: AnswerLength   // 'short'|'medium'|'long'
  timeframeDays: number
  lastRunAt?: string
  response?: string            // rendered markdown
  errorMessage?: string
  createdAt: string
  layerProgress?: 1|2|3
  tokenUsage?: TokenUsage
}
```

### ResearchResult (`types/research.ts`)
```typescript
interface ResearchResult {
  classification: TopicClassification
  angle: string
  headline: string
  coverage: { primary: SourceArticle[]; secondary: SourceArticle[]; niche: SourceArticle[] }
  keyFindings: KeyFinding[]
  implications: string[]
  whatToWatch: string
  sourceDiversityScore: number
  searchQueriesUsed: string[]
  rawSearchResults: SourceArticle[]
}

interface Layer1Intelligence {
  classification: TopicClassification
  angle: string
  suggestedQueries: string[]    // exactly 3
  responseStyle: 'breaking'|'summary'|'detailed'|'opinion'
  priorityFactors: string[]
}
```

---

## API Keys

### Gemini
- **Storage**: localStorage key `news-center-api-key`
- **Input**: via "Add API KEY" panel in UI → `saveApiKey()`
- **Access**: `getStoredApiKey()` from `apiKeyStore.ts`
- **Used by**: Layer 1 and Layer 3 Gemini calls

### Serper
- **Storage**: bundled at build time via `VITE_SERPER_API_KEY` in `.env`
- **Access**: `import.meta.env.VITE_SERPER_API_KEY` in `searchService.ts`
- **Value**: `29e9856df645a3ac5c5bcb6bdad3e582be0322fa`
- **Used by**: Layer 2 search (direct REST, no model)

---

## Build & Deploy

- **Framework**: Vite + Vue 3 + TypeScript (`vue-tsc -b`)
- **Output dir**: `docs/` (configured for GitHub Pages)
- **Base path**: `/easynews/`
- **Build**: `npm run build` → `docs/assets/index-*.js` + `docs/index.html`
- **Dev**: `npm run dev`

---

## Known Bugs Fixed

### "No search results found" (fixed 2026-04-18)
**Root cause**: Double date filtering in `layer2_search`.

`searchMultipleSerper` already filters via `parseRelativeDate` (correctly parses relative strings like "3 days ago"). But `layer2_search` applied a **second** `.filter()` using `new Date(r.date)`. Serper returns relative date strings, and `new Date("3 days ago")` returns `Invalid Date`, which always fails `>= cutoff` — silently dropping every article with a date.

**Fix**: Removed the broken second filter from `layer2_search`. It now just maps results to `SourceArticle` format and passes them up.

```typescript
// BEFORE (broken)
return results.map(...).filter((r) => {
  if (!r.date) return true
  const articleDate = new Date(r.date)  // ← Invalid Date for "3 days ago"
  return articleDate >= cutoff           // ← always false
})

// AFTER (fixed)
return results.map((r) => ({ ... }))    // ← no second filter
```

---

## File Structure

```
src/
├── main.ts                    # Vue app bootstrap
├── App.vue                    # Main UI, dig orchestration
├── style.css                  # Global styles (CSS variables, dark/light themes)
├── assets/
│   └── favicon.png
├── composables/
│   └── useTopics.ts           # Topic state + localStorage persistence
├── services/
│   ├── researchPipeline.ts   # 3-layer pipeline (analyze → search → synthesize)
│   ├── searchService.ts       # Serper REST API + date parsing
│   ├── newsApi.ts            # fetchNewsForTopic wrapper
│   ├── geminiClient.ts       # GoogleGenAI factory
│   └── apiKeyStore.ts        # localStorage API key CRUD
└── types/
    ├── topic.ts              # Topic, TopicStatus, AnswerLength
    └── research.ts           # ResearchResult, Layer1Intelligence, SourceArticle, TokenUsage

docs/                          # Built static output (GitHub Pages)
├── index.html
├── assets/
│   ├── index-*.js
│   └── index-*.css
└── vite.svg
```

---

## Environment Variables

```
VITE_GEMINI_API_KEY=your_gemini_api_key_here    # User enters via UI (not bundled)
SERPER_API_KEY=29e9856df645a3ac5c5bcb6bdad3e582be0322fa
VITE_SERPER_API_KEY=29e9856df645a3ac5c5bcb6bdad3e582be0322fa
```
