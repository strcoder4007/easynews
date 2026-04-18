export interface SearchResult {
  title: string
  url: string
  snippet: string
  source: string
  date?: string
}

/**
 * Convert a number of days to a Serper-compatible `tbs` date filter string.
 * Serper supports Google Search date ranges via the `tbs` parameter:
 *   qdr:d  = past 24 hours
 *   qdr:w  = past week
 *   qdr:m  = past month
 *   qdr:y  = past year
 * For odd values (e.g. 2, 3, 5, 7, 14) we fall back to the next bucket.
 */
function buildTbs(timeframeDays: number): string {
  if (timeframeDays <= 1) return 'qdr:d'
  if (timeframeDays <= 7) return 'qdr:w'
  if (timeframeDays <= 30) return 'qdr:m'
  return 'qdr:y'
}

/**
 * Execute a single search query via Serper REST API.
 * VITE_SERPER_API_KEY is injected at build time — safe for demo use.
 */
export async function searchSerper(
  query: string,
  num = 10,
  timeframeDays = 7,
): Promise<SearchResult[]> {
  const apiKey = import.meta.env.VITE_SERPER_API_KEY as string | undefined
  if (!apiKey) {
    console.error('Missing VITE_SERPER_API_KEY — add it to .env to enable search')
    return []
  }

  const tbs = buildTbs(timeframeDays)

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num, tbs }),
    })

    if (!res.ok) {
      console.error(`Serper error ${res.status} for query: ${query}`)
      return []
    }

    const data = await res.json() as {
      organic?: Array<{
        title?: string
        link?: string
        snippet?: string
        source?: string
        date?: string
        searchSuggestions?: string[]
      }>
    }

    const results: SearchResult[] = []
    for (const item of data.organic ?? []) {
      // Skip suggestion chips — no real article URL
      if (
        !item.link ||
        item.link.startsWith('http://127.0.0.1') ||
        item.link.includes('search.serper')
      ) {
        continue
      }
      results.push({
        title: item.title ?? '',
        url: item.link,
        snippet: item.snippet ?? item.searchSuggestions?.[0] ?? '',
        source: item.source ?? (() => { try { return new URL(item.link).hostname } catch { return '' } })(),
        date: item.date,
      })
    }

    return results
  } catch (err) {
    console.error(`Serper fetch error for "${query}":`, err)
    return []
  }
}

/**
 * Execute multiple queries in parallel via Serper
 */
export async function searchMultipleSerper(
  queries: string[],
  timeframeDays = 7,
): Promise<SearchResult[]> {
  const results = await Promise.all(
    queries.map((q) => searchSerper(q, 10, timeframeDays)),
  )

  // Flatten and deduplicate by URL
  const seen = new Set<string>()
  const deduped: SearchResult[] = []
  for (const batch of results) {
    for (const item of batch) {
      if (!seen.has(item.url)) {
        seen.add(item.url)
        deduped.push(item)
      }
    }
  }

  return deduped
}
