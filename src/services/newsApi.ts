import type { AnswerLength } from '../types/topic'
import type { TokenUsage } from '../types/research'
import { runResearchPipeline } from './researchPipeline'

type FetchNewsOptions = {
  onPromptReady?: (prompt: string) => void
  onLayerProgress?: (layer: 1 | 2 | 3, detail: string) => void
}

export async function fetchNewsForTopic(
  topicLabel: string,
  sources: readonly string[] = [],
  answerLength: AnswerLength = 'medium',
  timeframeDays = 7,
  options?: FetchNewsOptions,
): Promise<{ summary: string; prompt: string; tokenUsage: TokenUsage }> {
  const trimmedLabel = topicLabel.trim()
  if (!trimmedLabel) {
    throw new Error('Cannot run research with an empty topic name.')
  }

  const { markdown, searchQuery, tokenUsage } = await runResearchPipeline({
    topicLabel: trimmedLabel,
    sources,
    answerLength,
    timeframeDays,
    onLayerProgress: options?.onLayerProgress,
  })

  options?.onPromptReady?.(`Search query: ${searchQuery}`)

  return { summary: markdown, prompt: searchQuery, tokenUsage }
}
