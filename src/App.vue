<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DeepReadonly } from 'vue'
import { useTopics } from './composables/useTopics'
import type { Topic, TopicStatus } from './types/topic'
import { fetchNewsForTopic } from './services/newsApi'
import logoUrl from './assets/logo.png'

const { topics, addTopic, removeTopic, updateTopic } = useTopics()

const topicName = ref('')
const sourceInput = ref('')
const newSources = ref<string[]>([])
const sourceInputRef = ref<HTMLInputElement | null>(null)
const formError = ref<string | null>(null)
const isDigging = ref(false)

const statusCopy: Record<TopicStatus, string> = {
  idle: 'Idle',
  fetching: 'Fetching…',
  success: 'Fetched',
  error: 'Error',
}

const canAddTopic = computed(() => {
  return Boolean(topicName.value.trim())
})

const enabledTopicCount = computed(() => {
  return topics.value.filter((topic) => topic.digEnabled).length
})

const isDigDisabled = computed(() => {
  return isDigging.value || enabledTopicCount.value === 0
})

const addSourceFromInput = () => {
  const candidate = sourceInput.value.trim()
  if (!candidate) return

  const duplicate = newSources.value.some(
    (source) => source.toLowerCase() === candidate.toLowerCase()
  )
  if (duplicate) {
    sourceInput.value = ''
    return
  }

  newSources.value = [...newSources.value, candidate]
  sourceInput.value = ''
}

const removeSourceAtIndex = (index: number) => {
  newSources.value = newSources.value.filter((_, idx) => idx !== index)
}

const handleSourceKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault()
    addSourceFromInput()
    return
  }

  if (event.key === 'Backspace' && !sourceInput.value && newSources.value.length) {
    event.preventDefault()
    newSources.value = newSources.value.slice(0, -1)
  }
}

const handleAddTopic = () => {
  formError.value = null
  const name = topicName.value.trim()

  if (!name) {
    formError.value = 'Please enter a topic name.'
    return
  }

  const duplicate = topics.value.some(
    (topic) => topic.label.toLowerCase() === name.toLowerCase()
  )
  if (duplicate) {
    formError.value = 'That topic already exists. Try a different name.'
    return
  }

  const sourcesToSave: string[] = [...newSources.value]
  addTopic(name, sourcesToSave)
  topicName.value = ''
  sourceInput.value = ''
  newSources.value = []
}

const handleRemoveTopic = (id: string) => {
  if (isDigging.value) return
  removeTopic(id)
}

const handleClearResponse = (id: string) => {
  updateTopic(id, { response: undefined, status: 'idle' })
}

const handleDigToggle = (id: string, value: boolean) => {
  updateTopic(id, { digEnabled: value })
}

const focusSourceInput = () => {
  sourceInputRef.value?.focus()
}

const digTopics = async () => {
  if (isDigging.value) return
  const topicsSnapshot = topics.value.filter((topic) => topic.digEnabled)
  if (topicsSnapshot.length === 0) return

  isDigging.value = true
  try {
    await Promise.all(topicsSnapshot.map((topic) => digSingleTopic(topic)))
  } finally {
    isDigging.value = false
  }
}

const digSingleTopic = async (topic: DeepReadonly<Topic>, options?: { force?: boolean }) => {
  if (!options?.force && !topic.digEnabled) return
  updateTopic(topic.id, { status: 'fetching', errorMessage: undefined })
  try {
    const responseText = await fetchNewsForTopic(topic.label, topic.sources)
    updateTopic(topic.id, {
      status: 'success',
      response: responseText,
      lastRunAt: new Date().toISOString(),
      errorMessage: undefined,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    updateTopic(topic.id, {
      status: 'error',
      errorMessage: message,
      response: undefined,
      lastRunAt: new Date().toISOString(),
    })
  }
}

const handleDigTopicNow = async (topicId: string) => {
  if (isDigging.value) return
  const topic = topics.value.find((candidate) => candidate.id === topicId)
  if (!topic) return

  isDigging.value = true
  try {
    await digSingleTopic(topic as DeepReadonly<Topic>, { force: true })
  } finally {
    isDigging.value = false
  }
}

const formatDateTime = (value?: string) => {
  if (!value) return 'Never'
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return value
  }
}

const formatResponse = (value: string) => {
  const escapeHtml = (input: string) =>
    input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')

  const linkified = escapeHtml(value).replace(
    /(https?:\/\/[^\s)]+)(?=[\s)])/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
  )
  return linkified.replace(/\n/g, '<br />')
}
</script>

<template>
  <main class="page">
    <header class="page-header">
      <div class="page-header__brand">
        <img class="page-logo" :src="logoUrl" alt="News Center logo" />
      </div>
      <button class="dig-button" :disabled="isDigDisabled" @click="digTopics">
        <span>{{ isDigging ? 'DIGGING…' : 'DIG' }}</span>
      </button>
    </header>

    <section class="card form-card">
      <form class="topic-form" @submit.prevent="handleAddTopic">
        <div class="field-group">
          <label for="topic-name">Add Topic</label>
          <input
            id="topic-name"
            v-model="topicName"
            type="text"
            placeholder="e.g. BMW Z4 new generation"
            :disabled="isDigging"
          />
        </div>

        <div class="field-group">
          <label for="topic-sources-input">Preferred Sources</label>
          <div class="tag-input" @click="focusSourceInput">
            <span
              v-for="(source, index) in newSources"
              :key="`${source}-${index}`"
              class="tag-chip"
            >
              {{ source }}
              <button
                type="button"
                class="tag-chip__remove"
                @click.stop="removeSourceAtIndex(index)"
                aria-label="Remove source"
              >
                &times;
              </button>
            </span>
            <input
              id="topic-sources-input"
              ref="sourceInputRef"
              v-model="sourceInput"
              type="text"
              placeholder="e.g. Reddit, TCB scans, TechCrunch"
              :disabled="isDigging"
              @keydown="handleSourceKeydown"
              @blur="addSourceFromInput"
            />
          </div>
        </div>

        <div class="form-footer">
          <p v-if="formError" class="form-error">{{ formError }}</p>
          <button class="primary" type="submit" :disabled="!canAddTopic || isDigging">
            Add topic
          </button>
        </div>
      </form>
    </section>

    <section class="topics-section">
      <p v-if="topics.length === 0" class="empty-state">
        No topics yet. Add one above and it will live in local storage.
      </p>

      <div v-else class="topic-grid">
        <article v-for="topic in topics" :key="topic.id" class="card topic-card">
          <header class="topic-card__header">
            <div class="topic-card__title">
              <p class="topic-label">{{ topic.label }}</p>
              <div v-if="topic.sources.length" class="topic-sources">
                <div class="topic-sources__chips">
                  <span
                    v-for="(source, index) in topic.sources"
                    :key="`${topic.id}-${source}-${index}`"
                    class="source-chip"
                  >
                    {{ source }}
                  </span>
                </div>
              </div>
            </div>
            <div class="topic-card__header-actions">
              <button
                class="topic-card__single-dig"
                type="button"
                :disabled="isDigging"
                @click="handleDigTopicNow(topic.id)"
                aria-label="Dig only this topic"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M16.023 9.348h4.992V4.356m-1.743 2.449A9.295 9.295 0 009.184 3.067 9.28 9.28 0 003 9.75m4.977 4.545H3v4.992m1.743-2.449a9.295 9.295 0 009.088 3.738 9.28 9.28 0 006.44-4.786"
                    fill="none"
                    stroke="white"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
              <label class="dig-switch" :class="{ 'dig-switch--off': !topic.digEnabled }">
                <span class="sr-only">Toggle dig for {{ topic.label }}</span>
                <input
                  class="dig-switch__input"
                  type="checkbox"
                  :checked="topic.digEnabled"
                  @change="handleDigToggle(topic.id, ($event.target as HTMLInputElement).checked)"
                />
                <span class="dig-switch__track" aria-hidden="true"></span>
              </label>

            </div>
          </header>

          <div class="topic-card__meta-row">
            <span class="status-pill" :class="topic.status">{{ statusCopy[topic.status] }}</span>
            <p class="topic-last-run">
              Last dig <strong>{{ formatDateTime(topic.lastRunAt) }}</strong>
            </p>
          </div>

          <div class="topic-card__actions">
            <button
              class="pill-button pill-button--muted"
              type="button"
              :disabled="!topic.response"
              @click="handleClearResponse(topic.id)"
              aria-label="Clear response"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M4.5 4.5a1 1 0 011.41 0L10 8.59l4.09-4.09a1 1 0 011.41 1.41L11.41 10l4.09 4.09a1 1 0 01-1.41 1.41L10 11.41l-4.09 4.09a1 1 0 01-1.41-1.41L8.59 10 4.5 5.91a1 1 0 010-1.41z"
                />
              </svg>
              <span>Clear</span>
            </button>
            <button
              class="pill-button pill-button--danger"
              type="button"
              :disabled="isDigging"
              @click="handleRemoveTopic(topic.id)"
              aria-label="Remove topic"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M7 2.5a1 1 0 00-.94.66L5.6 4.5H3a1 1 0 100 2h1v8A2.5 2.5 0 006.5 17h7a2.5 2.5 0 002.5-2.5v-8h1a1 1 0 100-2h-2.6l-.46-1.34a1 1 0 00-.94-.66H7zm1.24 2h3.52l.17.5H8.07l.17-.5zM8 8a1 1 0 012 0v5a1 1 0 01-2 0V8zm4 0a1 1 0 012 0v5a1 1 0 01-2 0V8z"
                />
              </svg>
              <span>Delete</span>
            </button>
          </div>

          <div class="topic-results">
            <p v-if="topic.status === 'error'" class="error-message">
              {{ topic.errorMessage ?? 'Unable to fetch news for this topic.' }}
            </p>
            <p v-else-if="!topic.response">
              No summary yet. Hit DIG to pull the most recent news.
            </p>
            <div v-else class="topic-response" v-html="formatResponse(topic.response)"></div>
          </div>
        </article>
      </div>
    </section>
  </main>
</template>
