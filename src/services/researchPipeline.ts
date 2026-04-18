import { GoogleGenAI, ThinkingLevel } from '@google/genai'
import { getStoredApiKey } from './apiKeyStore'
import { getGeminiClient } from './geminiClient'
import { searchMultipleSerper } from './searchService'
import type {
  ResearchResult,
  Layer1Intelligence,
  SourceArticle,
  TokenUsage,
} from '../types/research'
import type { AnswerLength } from '../types/topic'

const MODEL_CLASSIFY = 'gemini-3-flash-preview'
const MODEL_SYNTHESIS = 'gemini-3.1-pro-preview'

// ---------------------------------------------------------------------------
// Layer 1: Topic Intelligence — classify + plan search strategy
// ---------------------------------------------------------------------------
async function layer1_analyzeTopic(
  client: GoogleGenAI,
  topicLabel: string,
  sources: readonly string[],
  timeframeDays: number,
): Promise<{ intelligence: Layer1Intelligence; usage: TokenUsage }> {
  const sourceList = sources.length
    ? sources.join(', ')
    : 'all general news sources'

  const prompt = `Analyze this news topic and produce a structured intelligence brief.

Topic: "${topicLabel}"
Preferred sources: ${sourceList}
Time window: last ${timeframeDays} day${timeframeDays === 1 ? '' : 's'}

Respond ONLY with valid JSON matching this exact schema — no markdown fences:
{
  "classification": "breaking" | "feature" | "analysis" | "regulatory" | "earnings" | "opinion" | "general",
  "angle": "one sentence describing the specific angle being covered",
  "suggestedQueries": ["query 1 for primary coverage", "query 2 for expert analysis", "query 3 for regional/niche perspective"],
  "responseStyle": "breaking" | "summary" | "detailed" | "opinion",
  "priorityFactors": ["what matters most when assessing this topic", "second priority factor"]
}

Rules:
- classification: breaking if ongoing event with fast-moving developments, feature for deep dives, analysis for explanatory pieces, regulatory for policy/legal, earnings for financial results, opinion for commentary, general otherwise
- suggestedQueries: produce exactly 3 queries targeting different coverage angles
- responseStyle: breaking=short punchy summary, summary=balanced overview, detailed=comprehensive with forward look, opinion=analytical with perspective
- Never wrap the response in markdown fences or code blocks`

  const result = await client.models.generateContent({
    model: MODEL_CLASSIFY,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
    },
  })

  const raw = result as any
  const text = raw.text ?? '{}'
  const usage: TokenUsage = {
    promptTokens: raw.usageMetadata?.promptTokenCount ?? 0,
    completionTokens: raw.usageMetadata?.candidatesTokenCount ?? 0,
    totalTokens: raw.usageMetadata?.totalTokenCount ?? 0,
  }
  return { intelligence: JSON.parse(text) as Layer1Intelligence, usage }
}

// ---------------------------------------------------------------------------
// Layer 2: Source-Diversified Search — executes queries via Serper REST API
// Note: includeServerSideToolInvocations does NOT work for GOOGLE_SEARCH_WEB —
// it returns the tool call request instead of executed results. We bypass the
// model entirely and call Serper directly for reliable search results.
// ---------------------------------------------------------------------------
async function layer2_search(
  _client: GoogleGenAI,
  queries: string[],
  timeframeDays: number,
): Promise<SourceArticle[]> {
  // Execute all queries directly via Serper — no model tool execution needed
  const results = await searchMultipleSerper(queries, timeframeDays)

  // searchMultipleSerper already applies date filtering via parseRelativeDate.
  // Do NOT apply a second filter with new Date(r.date) — Serper returns relative
  // date strings like "3 days ago" which new Date() cannot parse (returns Invalid Date),
  // causing every dated article to be silently dropped.
  return results.map((r) => ({
    title: r.title,
    source: r.source,
    url: r.url,
    date: r.date,
    snippet: r.snippet,
    relevance: 0.8,
  }))
}

// ---------------------------------------------------------------------------
// Layer 3: Structured Synthesis — deep reasoning + structured output
// ---------------------------------------------------------------------------
async function layer3_synthesize(
  client: GoogleGenAI,
  topicLabel: string,
  intelligence: Layer1Intelligence,
  articles: SourceArticle[],
  answerLength: AnswerLength,
  timeframeDays: number,
): Promise<{ researchResult: ResearchResult; usage: TokenUsage }> {
  if (articles.length === 0) {
    throw new Error('No search results found for this topic.')
  }

  // Build article context
  const articleContext = articles
    .slice(0, 15)
    .map(
      (a, i) =>
        `${i + 1}. [${a.source}] ${a.title}\n   URL: ${a.url}${a.date ? ` | ${a.date}` : ''}\n   ${a.snippet ?? ''}`
    )
    .join('\n\n')

  const lengthInstructions =
    answerLength === 'short'
      ? 'Keep the overall response under 40 words. Be extremely concise — one sentence per key finding.'
      : answerLength === 'medium'
        ? 'Keep the overall response under 120 words. Be concise but informative.'
        : 'Keep the overall response under 500 words. Provide comprehensive, nuanced coverage.'

  const responseStyleInstructions =
    intelligence.responseStyle === 'breaking'
      ? 'Write in a newswire style — short, punchy, factual. Lead with the most recent development.'
      : intelligence.responseStyle === 'summary'
        ? 'Provide a balanced, neutral overview. Cover what happened, why it matters, and what comes next.'
        : intelligence.responseStyle === 'detailed'
          ? 'Provide comprehensive analysis. Include causality, context, stakeholders, and forward-looking implications.'
          : 'Provide analytical perspective with clear reasoning. Acknowledge different viewpoints and explain your reasoning.'

  const prompt = `You are a senior news analyst. Produce a structured, high-quality news brief.

TOPIC: "${topicLabel}"
ANGLE: ${intelligence.angle}
CLASSIFICATION: ${intelligence.classification}
TIME WINDOW: last ${timeframeDays} days

ARTICLES (${articles.length} found):
${articleContext}

${lengthInstructions}

${responseStyleInstructions}

Respond ONLY with valid JSON matching this exact schema — no markdown fences, no commentary:
{
  "headline": "one-line summary of the single most important development",
  "classification": "${intelligence.classification}",
  "angle": "${intelligence.angle}",
  "coverage": {
    "primary": [{ "title": "article title", "source": "source name", "url": "https://...", "date": "YYYY-MM-DD or approximate", "relevance": 0.95 }],
    "secondary": [{ "title": "...", "source": "...", "url": "...", "date": "...", "relevance": 0.7 }],
    "niche": [{ "title": "...", "source": "...", "url": "...", "date": "...", "relevance": 0.5 }]
  },
  "keyFindings": [
    { "text": "specific factual finding", "confidence": "high|medium|low", "sources": ["source 1", "source 2"] }
  ],
  "implications": ["what this means going forward", "second implication"],
  "whatToWatch": "what to monitor in the coming days/weeks",
  "sourceDiversityScore": 0.0,
  "searchQueriesUsed": ["query 1", "query 2", "query 3"]
}

Rules:
- Distribution: primary=3 best sources, secondary=3 good sources, niche=remaining sources
- keyFindings: 3-5 findings, factual not speculative, confidence reflects source quality
- implications: 2-3 forward-looking implications
- sourceDiversityScore: estimate 0.0-1.0 based on source variety (outlet types, perspectives)
- Always include at least 3 keyFindings
- Never invent facts not present in the articles
- If dates are missing from articles, use approximate language`

  const result = await client.models.generateContent({
    model: MODEL_SYNTHESIS,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
    },
  })

  const raw = result as any
  const text = raw.text ?? '{}'
  const parsed = JSON.parse(text) as ResearchResult

  // Add search queries used
  parsed.searchQueriesUsed = [...intelligence.suggestedQueries, 'additional coverage search']
  parsed.rawSearchResults = articles

  // Compute diversity score if not returned
  if (!parsed.sourceDiversityScore || parsed.sourceDiversityScore === 0) {
    const srcSet = new Set(articles.map((a) => a.source.toLowerCase()))
    parsed.sourceDiversityScore = Math.min(1, srcSet.size / 4)
  }

  const layer3Usage: TokenUsage = {
    promptTokens: raw.usageMetadata?.promptTokenCount ?? 0,
    completionTokens: raw.usageMetadata?.candidatesTokenCount ?? 0,
    totalTokens: raw.usageMetadata?.totalTokenCount ?? 0,
  }

  return { researchResult: parsed, usage: layer3Usage }
}

// ---------------------------------------------------------------------------
// Render ResearchResult as Markdown for display
// ---------------------------------------------------------------------------
export function renderResearchAsMarkdown(r: ResearchResult): string {
  const lines: string[] = []

  lines.push(`**${r.headline}**`)
  lines.push('')
  lines.push(`_${r.angle}_`)
  lines.push('')

  if (r.keyFindings.length) {
    lines.push('### Key Findings')
    for (const f of r.keyFindings) {
      const conf = f.confidence === 'high' ? '🟢' : f.confidence === 'medium' ? '🟡' : '🔴'
      lines.push(`- ${conf} ${f.text}`)
      if (f.sources.length) {
        lines.push(`  _Sources: ${f.sources.join(', ')}_`)
      }
    }
    lines.push('')
  }

  if (r.implications.length) {
    lines.push('### Implications')
    for (const imp of r.implications) {
      lines.push(`- ${imp}`)
    }
    lines.push('')
  }

  if (r.whatToWatch) {
    lines.push('### What to Watch')
    lines.push(`> ${r.whatToWatch}`)
    lines.push('')
  }

  if (r.coverage.primary.length) {
    lines.push('### Sources')
    const allSources = [
      ...r.coverage.primary,
      ...r.coverage.secondary,
      ...r.coverage.niche,
    ]
    for (const src of allSources.slice(0, 8)) {
      const date = src.date ? ` (${src.date})` : ''
      lines.push(`- [${src.title}](${src.url}) — ${src.source}${date}`)
    }
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Main Pipeline Entry Point
// ---------------------------------------------------------------------------
export async function runResearchPipeline(params: {
  topicLabel: string
  sources: readonly string[]
  answerLength: AnswerLength
  timeframeDays: number
  onLayerProgress?: (layer: 1 | 2 | 3, detail: string) => void
}): Promise<{ result: ResearchResult; markdown: string; searchQuery: string; tokenUsage: TokenUsage }> {
  const { topicLabel, sources, answerLength, timeframeDays, onLayerProgress } = params

  const apiKey = getStoredApiKey()
  if (!apiKey) {
    throw new Error('Missing API key. Please add one from the Add API KEY panel.')
  }

  const client = getGeminiClient(apiKey)

  // Layer 1: Analyze
  onLayerProgress?.(1, 'Analyzing topic…')
  const { intelligence, usage: layer1Usage } = await layer1_analyzeTopic(client, topicLabel, sources, timeframeDays)

  // Layer 2: Search
  onLayerProgress?.(2, 'Searching sources…')
  const articles = await layer2_search(client, intelligence.suggestedQueries, timeframeDays)

  if (articles.length === 0) {
    throw new Error('No search results found. Please try a different topic.')
  }

  // Layer 3: Synthesize
  onLayerProgress?.(3, 'Synthesizing…')
  const { researchResult, usage: layer3Usage } = await layer3_synthesize(client, topicLabel, intelligence, articles, answerLength, timeframeDays)

  const markdown = renderResearchAsMarkdown(researchResult)

  // Aggregate token usage from all Gemini calls (layers 1 and 3)
  const tokenUsage: TokenUsage = {
    promptTokens: layer1Usage.promptTokens + layer3Usage.promptTokens,
    completionTokens: layer1Usage.completionTokens + layer3Usage.completionTokens,
    totalTokens: layer1Usage.totalTokens + layer3Usage.totalTokens,
  }

  return {
    result: researchResult,
    markdown,
    searchQuery: intelligence.suggestedQueries[0] ?? topicLabel,
    tokenUsage,
  }
}
