import type { NewsArticle } from '../types/topic'

const API_URL = 'https://newsapi.org/v2/everything'
const LOOKBACK_WINDOW_DAYS = 7 // grab articles from the last 7 calendar days
const DEFAULT_PAGE_SIZE = 20

interface NewsApiArticle {
  title?: string
  description?: string
  url?: string
  urlToImage?: string
  publishedAt?: string
  source?: {
    id?: string | null
    name?: string
  }
}

interface NewsApiResponse {
  status: 'ok' | 'error'
  totalResults?: number
  articles?: NewsApiArticle[]
  code?: string
  message?: string
}

export async function fetchNewsByPrompt(prompt: string): Promise<NewsArticle[]> {
  const trimmedPrompt = prompt.trim()
  if (!trimmedPrompt) {
    throw new Error('Cannot query the News API with an empty prompt.')
  }

  const apiKey = import.meta.env.VITE_NEWS_API_KEY ?? import.meta.env.NEWS_API_KEY
  if (!apiKey) {
    throw new Error(
      'Missing VITE_NEWS_API_KEY. Please add it to your .env file (Vite only exposes VITE_* variables).',
    )
  }

  const now = new Date()
  const fromDate = new Date(now.getTime() - LOOKBACK_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const params = new URLSearchParams()
  params.set('q', trimmedPrompt)
  params.set('from', formatDate(fromDate))
  params.set('to', formatDate(now))
  params.set('sortBy', 'publishedAt')
  params.set('language', 'en')
  params.set('pageSize', DEFAULT_PAGE_SIZE.toString())
  params.set('apiKey', apiKey)

  const response = await fetch(`${API_URL}?${params.toString()}`)
  const payload = (await response.json()) as NewsApiResponse

  if (!response.ok || payload.status !== 'ok') {
    throw new Error(payload.message ?? response.statusText ?? 'News API request failed.')
  }

  const sanitized: NewsArticle[] = []
  for (const article of payload.articles ?? []) {
    if (!article.url) continue
    sanitized.push({
      id: article.url,
      title: article.title ?? 'Untitled',
      description: article.description ?? '',
      publishedAt: article.publishedAt ?? now.toISOString(),
      source: article.source?.name ?? 'Unknown source',
      url: article.url,
      imageUrl: article.urlToImage ?? undefined,
    })
  }
  return sanitized
}

function formatDate(date: Date): string {
  const isoString = date.toISOString()
  const datePart = isoString.split('T')[0]
  return datePart ?? isoString
}
