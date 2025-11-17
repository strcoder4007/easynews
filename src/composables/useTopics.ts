import { readonly, ref, watch } from 'vue'
import type { NewsArticle, Topic, TopicStatus, TopicUpdate } from '../types/topic'

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
  const addTopic = (label: string, prompt: string) => {
    const topic: Topic = {
      id: createId('topic'),
      label: label.trim(),
      prompt: prompt.trim(),
      status: 'idle',
      lastRunAt: undefined,
      articles: [],
      errorMessage: undefined,
      createdAt: new Date().toISOString(),
    }

    topics.value = [topic, ...topics.value]
    return topic
  }

  const removeTopic = (id: string) => {
    topics.value = topics.value.filter((topic) => topic.id !== id)
  }

  const updateTopic = (id: string, patch: TopicUpdate) => {
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

  return {
    topics: readonly(topics),
    addTopic,
    removeTopic,
    updateTopic,
    replaceTopics,
    clearTopics,
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
  const prompt = typeof candidate.prompt === 'string' ? candidate.prompt.trim() : ''
  if (!label || !prompt) return null

  const status: TopicStatus = candidate.status ?? 'idle'
  const articles = Array.isArray(candidate.articles)
    ? candidate.articles
        .map((article) => normalizeArticle(article))
        .filter((article): article is NewsArticle => article !== null)
    : []

  return {
    id: typeof candidate.id === 'string' ? candidate.id : createId('topic'),
    label,
    prompt,
    status,
    lastRunAt: candidate.lastRunAt,
    articles,
    errorMessage: candidate.errorMessage,
    createdAt: candidate.createdAt ?? new Date().toISOString(),
  }
}

function normalizeArticle(candidate: Partial<NewsArticle> | null | undefined): NewsArticle | null {
  if (!candidate) return null

  const title = typeof candidate.title === 'string' ? candidate.title.trim() : ''
  const url = typeof candidate.url === 'string' ? candidate.url : ''
  if (!title || !url) return null

  return {
    id: typeof candidate.id === 'string' ? candidate.id : url,
    title,
    description: candidate.description ?? '',
    publishedAt: candidate.publishedAt ?? new Date().toISOString(),
    source: candidate.source ?? 'Unknown source',
    url,
    imageUrl: candidate.imageUrl,
  }
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 11)}`
}
