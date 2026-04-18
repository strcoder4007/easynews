import type { TokenUsage } from './research'

export type TopicStatus = 'idle' | 'analyzing' | 'searching' | 'synthesizing' | 'success' | 'error'
export type AnswerLength = 'short' | 'medium' | 'long'

export interface Topic {
  id: string
  label: string
  status: TopicStatus
  digEnabled: boolean
  sources: string[]
  answerLength: AnswerLength
  timeframeDays: number
  promptUsed?: string
  lastRunAt?: string
  response?: string
  errorMessage?: string
  createdAt: string
  layerProgress?: 1 | 2 | 3
  tokenUsage?: TokenUsage
}

export type TopicUpdate = Partial<Omit<Topic, 'id' | 'createdAt'>>
