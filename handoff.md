# Easynews — Project Handoff

## What Exists

A browser-based news intelligence app with a topic deck, 3-layer research pipeline, and zen mode.

## Architecture (Implemented)

### 3-Layer Pipeline

**Layer 1 — Topic Intelligence** (`src/services/researchPipeline.ts → layer1_analyzeTopic`)
- Model: `gemini-3-flash-preview` with `ThinkingLevel.MEDIUM`
- Input: topic label + preferred sources + timeframe
- Output: `{ classification, angle, suggestedQueries[3], responseStyle, priorityFactors[2] }`
- JSON response via `responseMimeType: 'application/json'`

**Layer 2 — Source-Diversified Search** (`researchPipeline.ts → layer2_search`)
- Model: `gemini-3-flash-preview` with `ThinkingLevel.MINIMAL`, `googleSearch: {}` tool
- Runs 3 queries in parallel via `Promise.all`
- Extracts results from `part.googleSearchResult`
- Deduplicates by URL

**Layer 3 — Structured Synthesis** (`researchPipeline.ts → layer3_synthesize`)
- Model: `gemini-3.1-pro-preview` with `ThinkingLevel.HIGH`
- Input: all gathered articles (up to 15) + layer 1 intelligence
- Output: structured JSON `{ headline, classification, angle, coverage: {primary,secondary,niche}, keyFindings, implications, whatToWatch, sourceDiversityScore }`
- Rendered as Markdown via `renderResearchAsMarkdown()`

### Status States (3-layer pipeline)

`idle | analyzing | searching | synthesizing | success | error`

Card shows status pill + "Layer N/3" progress indicator when in flight.

### Entry Point

- `src/services/newsApi.ts` → `fetchNewsForTopic()` wraps `runResearchPipeline()`
- `src/App.vue` → `digSingleTopic()` calls `fetchNewsForTopic()` with `onLayerProgress` callback

### API Key

- Stored in localStorage via `src/services/apiKeyStore.ts`
- Key name: `'news-center-api-key'`
- Prompt asks user to enter via "Add API KEY" panel if missing

## File Map

- `src/types/research.ts` — ResearchResult, Layer1Intelligence, SourceArticle, KeyFinding interfaces
- `src/types/topic.ts` — Topic, TopicStatus (3-layer states), AnswerLength
- `src/services/geminiClient.ts` — `GoogleGenAI` client factory
- `src/services/researchPipeline.ts` — All 3 layers + `runResearchPipeline()`
- `src/services/newsApi.ts` — `fetchNewsForTopic()` wrapper
- `src/services/apiKeyStore.ts` — localStorage read/write
- `src/App.vue` — UI, topic management, dig orchestration
- `src/composables/useTopics.ts` — localStorage persistence for topics
- `src/style.css` — All styles

## API Key Note

- .env holds `VITE_GEMINI_API_KEY` (optional, for fallback)
- Primary key: user-entered via "Add API KEY" UI panel → localStorage
- Legacy key names cleaned up

## Build

```bash
cd /Users/str/Projects/news-center
npm run build  # clean build → docs/
```

## Next

- User needs to provide a valid Gemini API key in the UI
- Serper removed, no longer needed anywhere
- The `googleSearch` tool should return results inline (no manual function calling loop needed — model returns search results directly in response parts)
