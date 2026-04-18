import { readonly, ref, watch } from 'vue'
import type { AnswerLength, Topic, TopicStatus } from '../types/topic'

type TopicPatch = Partial<Omit<Topic, 'id' | 'createdAt'>>

const STORAGE_KEY = 'news-center-topics'
const hasWindow = typeof window !== 'undefined'

const topics = ref<Topic[]>(loadTopics())

if (hasWindow) {
  watch(
    topics,
    (next) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    },
    { deep: true }
  )
}

export function useTopics() {
  const addTopic = (
    label: string,
    sources: string[] = [],
    answerLength: AnswerLength = 'medium',
    timeframeDays = 7
  ) => {
    const normalizedSources = Array.from(
      new Set(
        sources
          .map((source) => source.trim())
          .filter((source): source is string => Boolean(source))
      )
    )

    const topic: Topic = {
      id: createId('topic'),
      label: label.trim(),
      status: 'idle',
      digEnabled: true,
      sources: normalizedSources,
      answerLength,
      timeframeDays,
      lastRunAt: undefined,
      response: undefined,
      errorMessage: undefined,
      createdAt: new Date().toISOString(),
    }

    topics.value = [topic, ...topics.value]
    return topic
  }

  const removeTopic = (id: string) => {
    topics.value = topics.value.filter((topic) => topic.id !== id)
  }

  const updateTopic = (id: string, patch: TopicPatch) => {
    topics.value = topics.value.map((topic) => {
      if (topic.id !== id) return topic
      return {
        ...topic,
        ...patch,
      }
    })
  }

  const replaceTopics = (nextTopics: Topic[]) => {
    topics.value = nextTopics
  }

  const clearTopics = () => {
    topics.value = []
  }

  const mergeTopics = (incoming: Partial<Topic>[]) => {
    const toAdd: Topic[] = []
    for (const candidate of incoming) {
      const normalized = normalizeTopic(candidate)
      if (!normalized) continue
      const exists = topics.value.find((t) => t.label === normalized.label)
      if (exists) {
        topics.value = topics.value.map((t) =>
          t.id === exists.id ? { ...t, ...normalized, id: t.id } : t
        )
      } else {
        toAdd.push(normalized)
      }
    }
    if (toAdd.length) {
      topics.value = [...toAdd, ...topics.value]
    }
  }

  const exportTopics = (): string => {
    return JSON.stringify(topics.value, null, 2)
  }

  return {
    topics: readonly(topics),
    addTopic,
    removeTopic,
    updateTopic,
    replaceTopics,
    clearTopics,
    mergeTopics,
    exportTopics,
  }
}

function loadTopics(): Topic[] {
  if (!hasWindow) {
    return []
  }

  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as Topic[]
    return parsed
      .map((candidate) => normalizeTopic(candidate))
      .filter((topic): topic is Topic => topic !== null)
  } catch (err) {
    console.warn('Failed to parse stored topics, resetting cache.', err)
    localStorage.removeItem(STORAGE_KEY)
    return []
  }
}

function normalizeTopic(candidate: Partial<Topic>): Topic | null {
  if (!candidate) return null

  const label = typeof candidate.label === 'string' ? candidate.label.trim() : ''
  if (!label) return null

  const status: TopicStatus = candidate.status ?? 'idle'
  const digEnabled =
    typeof candidate.digEnabled === 'boolean' ? candidate.digEnabled : true
  const sources = Array.isArray(candidate.sources)
    ? candidate.sources
        .map((source) => (typeof source === 'string' ? source.trim() : ''))
        .filter((source): source is string => Boolean(source))
    : []
  const answerLength: AnswerLength =
    candidate.answerLength === 'short' || candidate.answerLength === 'long'
      ? candidate.answerLength
      : 'medium'
  const timeframeDays =
    typeof candidate.timeframeDays === 'number' && Number.isFinite(candidate.timeframeDays)
      ? candidate.timeframeDays
      : 7
  return {
    id: typeof candidate.id === 'string' ? candidate.id : createId('topic'),
    label,
    status,
    digEnabled,
    sources,
    answerLength,
    timeframeDays,
    lastRunAt: candidate.lastRunAt,
    response: typeof candidate.response === 'string' ? candidate.response : undefined,
    errorMessage: candidate.errorMessage,
    createdAt: candidate.createdAt ?? new Date().toISOString(),
  }
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 11)}`
}
