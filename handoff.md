# Easynews — Project Handoff

## What Exists

A browser-based news intelligence app with a topic deck, 3-layer research pipeline, token tracking, and zen mode.

## Architecture (Implemented)

### 3-Layer Pipeline

**Layer 1 — Topic Intelligence** (`src/services/researchPipeline.ts → layer1_analyzeTopic`)
- Model: `gemini-3-flash-preview` with `ThinkingLevel.MEDIUM`
- Input: topic label + preferred sources + timeframe days
- Output: `{ classification, angle, suggestedQueries[3], responseStyle, priorityFactors[2] }`
- JSON response via `responseMimeType: 'application/json'`
- Returns token usage metadata

**Layer 2 — Source-Diversified Search** (`researchPipeline.ts → layer2_search`)
- Calls `searchService.ts` which uses **Serper REST API** directly (not model tool execution)
- Runs 3 queries in parallel via `Promise.all`
- Serper `tbs` date filter maps timeframeDays to Google date ranges (`qdr:d/w/m/y`)
- Client-side date guard also filters results older than the time window
- Deduplicates by URL

**Layer 3 — Structured Synthesis** (`researchPipeline.ts → layer3_synthesize`)
- Model: `gemini-3.1-pro-preview` with `ThinkingLevel.HIGH`
- Input: all gathered articles (up to 15) + layer 1 intelligence
- Output: structured JSON `{ headline, classification, angle, coverage: {primary,secondary,niche}, keyFindings, implications, whatToWatch, sourceDiversityScore }`
- Rendered as Markdown via `renderResearchAsMarkdown()`
- Returns token usage metadata

**Token Usage**: Layers 1 and 3 both return `usageMetadata { promptTokenCount, candidatesTokenCount, totalTokenCount }`. Aggregated in `runResearchPipeline()` and displayed in the UI card as `Tokens: X (Y in / Z out)`.

### Status States

`idle | analyzing | searching | synthesizing | success | error`

Card shows status pill + "Layer N/3" progress indicator when in flight.

## File Map

| File | Purpose |
|------|---------|
| `src/types/research.ts` | `ResearchResult`, `Layer1Intelligence`, `SourceArticle`, `KeyFinding`, `TokenUsage` |
| `src/types/topic.ts` | `Topic`, `TopicStatus`, `AnswerLength` |
| `src/services/geminiClient.ts` | `GoogleGenAI` client factory |
| `src/services/researchPipeline.ts` | Layers 1-3 + `runResearchPipeline()` |
| `src/services/searchService.ts` | Serper REST client, date filtering via `tbs` |
| `src/services/newsApi.ts` | `fetchNewsForTopic()` — wraps pipeline, returns summary + tokenUsage |
| `src/services/apiKeyStore.ts` | localStorage read/write for Gemini API key |
| `src/composables/useTopics.ts` | Topics CRUD + localStorage persistence |
| `src/App.vue` | UI, topic management, dig orchestration |
| `src/style.css` | All styles, CSS custom properties for light/dark themes |

## API Keys

- **Serper**: `VITE_SERPER_API_KEY` in `.env` — for Layer 2 search
- **Gemini**: User-entered via "Add API KEY" panel → stored in localStorage as `'news-center-api-key'`
- Both `.env` vars are build-time injected (Vite)

## Build

```bash
cd /Users/str/Projects/news-center
pnpm build  # clean build → docs/
```

## Design

- Light/dark theme via `data-theme` on `<html>`, CSS custom properties
- Dot-grid background pattern (same SVG dot, different opacity per theme)
- Unified button system: `.pill-button` base + `--muted` / `--danger` semantic variants
- Tokens tracked per-topic, displayed in card header
- `promptUsed` removed from UI (no longer surfaced)
