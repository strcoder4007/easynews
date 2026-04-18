export type TopicClassification =
  | 'breaking'
  | 'feature'
  | 'analysis'
  | 'regulatory'
  | 'earnings'
  | 'opinion'
  | 'general'

export interface SourceArticle {
  title: string
  source: string
  url: string
  date?: string
  snippet?: string
  relevance?: number
}

export interface KeyFinding {
  text: string
  confidence: 'high' | 'medium' | 'low'
  sources: string[]
}

export interface ResearchResult {
  classification: TopicClassification
  angle: string
  headline: string
  coverage: {
    primary: SourceArticle[]
    secondary: SourceArticle[]
    niche: SourceArticle[]
  }
  keyFindings: KeyFinding[]
  implications: string[]
  whatToWatch: string
  sourceDiversityScore: number
  searchQueriesUsed: string[]
  rawSearchResults: SourceArticle[]
}

export interface Layer1Intelligence {
  classification: TopicClassification
  angle: string
  suggestedQueries: string[]
  responseStyle: 'breaking' | 'summary' | 'detailed' | 'opinion'
  priorityFactors: string[]
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}
