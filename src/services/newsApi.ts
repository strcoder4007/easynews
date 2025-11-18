import OpenAI from 'openai'

const DEFAULT_MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-5'
const CUSTOM_API_URL = import.meta.env.VITE_OPENAI_API_URL?.trim()

let cachedClient: OpenAI | null = null

export async function fetchNewsForTopic(
  topicLabel: string,
  sources: readonly string[] = [],
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
    instructions: buildPrompt(trimmedLabel, sources),
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

function buildPrompt(topic: string, sources: readonly string[]): string {
  const today = new Date().toISOString().split('T')[0]
  const searchDirective = createSourceDirective(sources)
  return [
    `Today is ${today}. You are my personal news researcher.`,
    `Use the web search tool to surface the most recent, reputable coverage about "${topic}".`,
    searchDirective,
    'Summarize the key developments from the past few days, highlight notable quotes or data points, and flag any emerging trends or risks.',
    'Make sure the news is not more than 7 days old.',
    'Return the answer with short paragraphs, prioritizing freshness and practical takeaways. Do not add additional text, just give ONLY the answer in less than 100 words',
  ]
    .filter(Boolean)
    .join(' ')
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
