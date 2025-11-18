export type TopicStatus = 'idle' | 'fetching' | 'success' | 'error'

export interface Topic {
  id: string
  label: string
  status: TopicStatus
  digEnabled: boolean
  sources: string[]
  lastRunAt?: string
  response?: string
  errorMessage?: string
  createdAt: string
}

export type TopicUpdate = Partial<Omit<Topic, 'id' | 'createdAt'>>
