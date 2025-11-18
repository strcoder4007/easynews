import OpenAI from 'openai'
import type { AnswerLength } from '../types/topic'

const DEFAULT_MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-5-nano-2025-08-07'
const CUSTOM_API_URL = import.meta.env.VITE_OPENAI_API_URL?.trim()

let cachedClient: OpenAI | null = null

export async function fetchNewsForTopic(
  topicLabel: string,
  sources: readonly string[] = [],
  answerLength: AnswerLength = 'medium',
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
    instructions: buildPrompt(trimmedLabel, sources, answerLength),
    input: "Give only the answer",
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

function buildPrompt(topic: string, sources: readonly string[], answerLength: AnswerLength): string {
  const today = new Date().toISOString().split('T')[0]
  const searchDirective = createSourceDirective(sources)
  const lengthDirective = createLengthDirective(answerLength)

  return [
    `Role: You are EASY NEWS, my lean news scout working on ${today}.`,
    `Goal: Find the latest (≤7 days old) and most actionable intel on "${topic}".`,
    'Process:',
    '1. Use the web_search tool immediately. Prioritize primary sources, filings, reputable press, and firsthand data.',
    `2. ${searchDirective || 'Prefer variety in sources; avoid echoing the same outlet.'}`,
    '3. Extract only verifiable facts, quotes, market moves, or risk flags. Ignore rumors and speculation.',
    '4. Organize mentally into: headline takeaway, supporting detail, forward-looking signal.',
    'Output rules:',
    '- Start directly with the summary; no greetings, no meta commentary.',
    '- Use short sentences and human tone. Blend narrative + bullets only if it improves clarity.',
    '- Highlight: key catalyst, numbers, protagonists, and the next likely development.',
    '- Note any source bias or uncertainty in-line (e.g., “Reuters – unconfirmed”).',
    lengthDirective,
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
