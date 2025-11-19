import OpenAI from 'openai'
import type { AnswerLength } from '../types/topic'

const DEFAULT_MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-5-nano-2025-08-07'
const CUSTOM_API_URL = import.meta.env.VITE_OPENAI_API_URL?.trim()

let cachedClient: OpenAI | null = null

export async function fetchNewsForTopic(
  topicLabel: string,
  sources: readonly string[] = [],
  answerLength: AnswerLength = 'medium',
  timeframeDays = 7,
): Promise<string> {
  const trimmedLabel = topicLabel.trim()
  if (!trimmedLabel) {
    throw new Error('Cannot query OpenAI with an empty topic name.')
  }

  const apiKey = import.meta.env.VITE_OPENAI_API_KEY ?? import.meta.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error(
      'Missing VITE_OPENAI_API_KEY. Please add it to your .env file (Vite only exposes VITE_* variables).',
    )
  }

  const client = getOpenAiClient(apiKey)
  const response = await client.responses.create({
    model: DEFAULT_MODEL,
    tools: [{ type: 'web_search' }],
    instructions: buildSystemPrompt(timeframeDays),
    input: buildUserPrompt(trimmedLabel, sources, answerLength, timeframeDays),
    reasoning: { effort: 'low', summary: 'detailed' },
  })
  console.log('OpenAI response for topic:', trimmedLabel, response)

  const summary = extractText(response)
  if (!summary) {
    throw new Error('OpenAI returned no content for this topic.')
  }

  return summary
}

function getOpenAiClient(apiKey: string) {
  if (cachedClient) return cachedClient
  cachedClient = new OpenAI({
    apiKey,
    baseURL: CUSTOM_API_URL || undefined,
    dangerouslyAllowBrowser: true,
  })
  return cachedClient
}

function buildSystemPrompt(timeframeDays: number): string {
  return [
    '<persona>You are EASY NEWS, a lean, no-nonsense news analyst. Your core philosophy: deliver crisp, fact-grounded insights that cut through noise, prioritizing fresh primary reporting over speculation or spin. You speak with grounded directness—efficient, precise, and actionably skeptical—trusting users with unvarnished clarity rather than padded pleasantries. Default to 3–5 sentences per response, expanding only for multi-faceted queries. Use Markdown for structure: bold key developments, italicize unconfirmed elements, and inline citations via [source].</persona>',
    `<tool_usage_mandate>Before any response, you MUST invoke web_search with a targeted query (e.g., "latest [topic] developments site:reddit.com OR site:google.com OR site:x.com" to prioritize primaries). Aim for 5–10 diverse results from the last ${timeframeDays} days. Parallelize if scanning multiple angles (e.g., regulatory + market impact). Skim headlines, leads, and data sections—never rely on abstracts or single outlets. If results are stale (>${timeframeDays} days), note: "No developments within the past ${timeframeDays} days; last update [date] via [source]."</tool_usage_mandate>`,
    '<source_validation>- Acceptable: Primary reporting from Reddit, Google, Gemini, Qwen, HuggingFace, ollama models, x.com- Cross-check claims against ≥2 independent sources; flag singles as "sole report from [outlet]." - Low-confidence (leaks, unverified social claims, anonymous sourcing): Tag inline as *unconfirmed rumor* and deprioritize in summary. - Reject/flag: Paywalled stubs, content farms (e.g., no bylines/citations), partisan outlets (e.g., Breitbart, Daily Kos), newsletters without links, Reddit/Twitter threads sans verification, or aggregator echoes (e.g., Yahoo summarizing AP without adds).- Never fabricate data, quotes, or timelines; if unverifiable, omit and state: "Insufficient fresh sourcing to assess."</source_validation>',
    '<response_structure>- Lead with the headline fact in 1 bold sentence, sourced inline.- Follow with 2–3 bullets for context/impacts (e.g., • **Market reaction:** [data] [citation]; • **Regulatory angle:** [update] [citation]).- Conclude with neutral analysis: 1 sentence on implications, avoiding hype.- For no-news queries: "Quiet on [topic]—no major updates in 7 days. Suggest monitoring [key source]."- Do not narrate tools, instructions, or process; stay in character.</response_structure>'
  ].join('\n')
}

function buildUserPrompt(
  topic: string,
  sources: readonly string[],
  answerLength: AnswerLength,
  timeframeDays: number
): string {
  const today = new Date().toISOString().split('T')[0]
  const searchDirective = createSourceDirective(sources)
  const lengthDirective = createLengthDirective(answerLength)

  return [
    `<context>Date: ${today}</context>`,
    `<assignment>Capture the most recent (≤${timeframeDays} days) material developments on "${topic}". Prioritize primary reporting from reputable outlets; cross-verify claims across ≥2 sources. If coverage is thin, note gaps explicitly (e.g., "Sole report from [outlet]; awaiting confirmation").</assignment>`,
    searchDirective ? `<source_mandate>Mandatory focus: ${searchDirective}—branch to alternatives (e.g., Reuters, AP, Bloomberg) only if no fresh updates.</source_mandate>` : `<source_mandate>Diversify across ≥2 independent outlets (e.g., FT, WSJ, Nikkei); flag identical wire rewrites and deprioritize.</source_mandate>`,
    `<deliverable_structure>- **Lead:** One bold sentence with the single most actionable takeaway, inline-sourced (e.g., **[Takeaway].** [Outlet, date]).- **Body:** 2–4 concise bullets on supporting facts (data, quotes, filings); use • for sub-bullets if multi-angle; italicize *unconfirmed* elements.- **Close:** One sentence on the next catalyst, risk, or open question (e.g., "Monitor [event] for [implication]").- Inline sources sparingly for precision (e.g., "per SEC filing"); avoid narration.</deliverable_structure>`,
    lengthDirective || '<verbosity>Keep total response to 150–250 words: crisp and skimmable, no fluff or recaps.</verbosity>',
    `<output_rules>Start response immediately with the lead takeaway—no intros, headers, or "Summary:" labels. Stay in EASY NEWS voice: direct, skeptical, momentum-driven.</output_rules>`
  ]
    .filter(Boolean)
    .join('\n')
}

function createSourceDirective(sources: readonly string[]): string {
  const cleanedSources = Array.from(sources)
    .map((source) => source.trim())
    .filter(Boolean)
  if (!cleanedSources.length) return ''

  return `Search on ${formatSourcesList(cleanedSources)}.`
}

function formatSourcesList(entries: string[]): string {
  const list = entries.filter(Boolean)
  if (list.length === 0) {
    return ''
  }

  if (list.length === 1) {
    return list[0]!
  }

  if (list.length === 2) {
    return `${list[0]!} and ${list[1]!}`
  }

  const tail = list[list.length - 1]!
  const head = list.slice(0, -1).join(', ')
  return `${head} and ${tail}`
}

function extractText(payload: OpenAI.Responses.Response): string | null {
  if (Array.isArray(payload.output_text) && payload.output_text.length > 0) {
    return payload.output_text.join('\n').trim()
  }

  const segments: string[] = []
  for (const block of payload.output ?? []) {
    const contentItems = (block as { content?: Array<{ text?: string }> }).content ?? []
    for (const content of contentItems) {
      if (content?.text) {
        segments.push(content.text)
      }
    }
  }
  const combined = segments.join('\n').trim()
  return combined.length > 0 ? combined : null
}

function createLengthDirective(answerLength: AnswerLength): string {
  const rules: Record<AnswerLength, { maxWords: number; tone: string }> = {
    short: { maxWords: 30, tone: 'Deliver a headline-style answer' },
    medium: { maxWords: 100, tone: 'Provide a balanced, two-paragraph answer' },
    long: { maxWords: 300, tone: 'Deliver a richer answer with multiple focused paragraphs' },
  }
  const selected = rules[answerLength] ?? rules.medium
  return `${selected.tone} and strictly stay under ${selected.maxWords} words.`
}
