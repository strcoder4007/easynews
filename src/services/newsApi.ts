import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AnswerLength } from '../types/topic'
import { getStoredApiKey } from './apiKeyStore'

const DEFAULT_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.0-flash-exp'
const SERPER_API_KEY = import.meta.env.VITE_SERPER_API_KEY

let cachedClient: GoogleGenerativeAI | null = null
let cachedClientApiKey: string | null = null

type FetchNewsOptions = {
  onPromptReady?: (prompt: string) => void
}

interface SerperSearchResult {
  title: string
  link: string
  snippet: string
  date?: string
}

interface SerperResponse {
  organic?: SerperSearchResult[]
}

async function searchGoogle(query: string): Promise<SerperSearchResult[]> {
  if (!SERPER_API_KEY) {
    throw new Error('Missing Serper API key. Please configure VITE_SERPER_API_KEY in .env')
  }

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        num: 10,
      }),
    })

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.status}`)
    }

    const data: SerperResponse = await response.json()
    return data.organic || []
  } catch (error) {
    console.error('Search failed:', error)
    throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function fetchNewsForTopic(
  topicLabel: string,
  sources: readonly string[] = [],
  answerLength: AnswerLength = 'medium',
  timeframeDays = 7,
  options?: FetchNewsOptions,
): Promise<{ summary: string; prompt: string }> {
  const trimmedLabel = topicLabel.trim()
  if (!trimmedLabel) {
    throw new Error('Cannot query Gemini with an empty topic name.')
  }

  const apiKey = getStoredApiKey()
  if (!apiKey) {
    throw new Error('Missing Gemini API key. Please add one from the Add API KEY panel.')
  }

  const client = getGeminiClient(apiKey)

  // Build the search query
  const today = new Date().toISOString().split('T')[0]
  const sourceList = sources.length ? sources.join(', ') : 'general news sources'
  const searchQuery = `${topicLabel} news ${timeframeDays <= 7 ? 'this week' : 'recent'} ${sourceList}`

  options?.onPromptReady?.(`Search query: ${searchQuery}`)

  // Perform web search
  const searchResults = await searchGoogle(searchQuery)

  if (searchResults.length === 0) {
    throw new Error('No search results found for this topic.')
  }

  // Build context from search results
  const context = searchResults
    .map((r, i) => `${i + 1}. ${r.title}\n${r.snippet}\nSource: ${r.link}${r.date ? ` (${r.date})` : ''}`)
    .join('\n\n')

  // Determine answer length
  const lengthInstructions =
    answerLength === 'short'
      ? 'Keep your response under 30 words. Be extremely concise.'
      : answerLength === 'medium'
        ? 'Keep your response under 100 words. Be concise but informative.'
        : 'Keep your response under 400 words. Provide comprehensive coverage.'

  // Craft the summarization prompt
  const summarizationPrompt = `You are a news analyst. Based on the following search results about "${topicLabel}" (as of ${today}), provide a summary.

Search Results:
${context}

Requirements:
- ${lengthInstructions}
- Bold the lead insight (most important finding)
- Use tight bullet points for supporting facts
- Italicize any unverified information
- Cite sources inline with [source]
- Include 2-3 forward-looking statements or implications
- Reply in pure Markdown with no redundant blank lines
- Never wrap the full response in code fences`

  // Generate summary using Gemini
  const model = client.getGenerativeModel({ model: DEFAULT_MODEL })

  const result = await model.generateContent(summarizationPrompt)
  const response = result.response
  const summary = response.text()

  if (!summary || summary.trim().length === 0) {
    throw new Error('Gemini returned no content for this topic.')
  }

  console.log('Gemini response for topic:', trimmedLabel, summary)

  return { summary, prompt: searchQuery }
}

function getGeminiClient(apiKey: string) {
  if (cachedClient && cachedClientApiKey === apiKey) return cachedClient
  cachedClient = new GoogleGenerativeAI(apiKey)
  cachedClientApiKey = apiKey
  return cachedClient
}
