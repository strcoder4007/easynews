export type TopicStatus = 'idle' | 'fetching' | 'success' | 'error'

export interface NewsArticle {
  id: string
  title: string
  description: string
  publishedAt: string
  source: string
  url: string
  imageUrl?: string
}

export interface Topic {
  id: string
  label: string
  prompt: string
  status: TopicStatus
  lastRunAt?: string
  articles: NewsArticle[]
  errorMessage?: string
  createdAt: string
}

export type TopicUpdate = Partial<Omit<Topic, 'id' | 'createdAt'>>
