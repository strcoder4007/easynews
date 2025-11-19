<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DeepReadonly } from 'vue'
import { useTopics } from './composables/useTopics'
import type { AnswerLength, Topic, TopicStatus } from './types/topic'
import { fetchNewsForTopic } from './services/newsApi'
const { topics, addTopic, removeTopic, updateTopic } = useTopics()

const topicName = ref('')
const sourceInput = ref('')
const newSources = ref<string[]>([])
const sourceInputRef = ref<HTMLInputElement | null>(null)
const formError = ref<string | null>(null)
const isDigging = ref(false)
const answerLength = ref<AnswerLength>('medium')
const timeframeDays = ref(7)
const expandedTopicIds = ref<Set<string>>(new Set())
const isTopicFormOpen = ref(false)
const TOPIC_FORM_ID = 'topic-form-panel'

const answerLengthOptions: Array<{ label: string; value: AnswerLength; helper: string }> = [
  { label: 'Short', value: 'short', helper: '< 30 words' },
  { label: 'Medium', value: 'medium', helper: '< 100 words' },
  { label: 'Long', value: 'long', helper: '< 300 words' },
]

const editingTopicId = ref<string | null>(null)
const editingTopicName = ref('')
const editingSources = ref<string[]>([])
const editingSourceInput = ref('')
const editingSourceInputRef = ref<HTMLInputElement | null>(null)
const editingAnswerLength = ref<AnswerLength>('medium')
const editingTimeframeDays = ref(7)
const editingError = ref<string | null>(null)

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
  addTopic(name, sourcesToSave, answerLength.value, sanitizeTimeframe(timeframeDays.value))
  topicName.value = ''
  sourceInput.value = ''
  newSources.value = []
  answerLength.value = 'medium'
  timeframeDays.value = 7
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

const addEditingSourceFromInput = () => {
  const candidate = editingSourceInput.value.trim()
  if (!candidate) return

  const duplicate = editingSources.value.some(
    (source) => source.toLowerCase() === candidate.toLowerCase(),
  )
  if (duplicate) {
    editingSourceInput.value = ''
    return
  }

  editingSources.value = [...editingSources.value, candidate]
  editingSourceInput.value = ''
}

const removeEditingSourceAtIndex = (index: number) => {
  editingSources.value = editingSources.value.filter((_, idx) => idx !== index)
}

const handleEditingSourceKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault()
    addEditingSourceFromInput()
    return
  }

  if (
    event.key === 'Backspace' &&
    !editingSourceInput.value &&
    editingSources.value.length
  ) {
    event.preventDefault()
    editingSources.value = editingSources.value.slice(0, -1)
  }
}

const focusEditingSourceInput = () => {
  editingSourceInputRef.value?.focus()
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
    const responseText = await fetchNewsForTopic(
      topic.label,
      topic.sources,
      topic.answerLength,
      topic.timeframeDays
    )
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

const toggleTopicCard = (topicId: string) => {
  const next = new Set(expandedTopicIds.value)
  if (next.has(topicId)) {
    next.delete(topicId)
  } else {
    next.add(topicId)
  }
  expandedTopicIds.value = next
}

const isTopicExpanded = (topicId: string) => expandedTopicIds.value.has(topicId)

const toggleTopicForm = () => {
  isTopicFormOpen.value = !isTopicFormOpen.value
}

const handleCardClick = (topicId: string, event: MouseEvent) => {
  const target = event.target as HTMLElement | null
  if (target?.closest('button, a, input, textarea, label')) {
    return
  }
  ensureTopicExpanded(topicId)
}

const ensureTopicExpanded = (topicId: string) => {
  if (!isTopicExpanded(topicId)) {
    const next = new Set(expandedTopicIds.value)
    next.add(topicId)
    expandedTopicIds.value = next
  }
}

const startEditingTopic = (topic: Topic | DeepReadonly<Topic>) => {
  ensureTopicExpanded(topic.id)
  editingTopicId.value = topic.id
  editingTopicName.value = topic.label
  editingSources.value = [...topic.sources]
  editingAnswerLength.value = topic.answerLength
  editingTimeframeDays.value = topic.timeframeDays
  editingSourceInput.value = ''
  editingError.value = null
}

const cancelEditingTopic = () => {
  editingTopicId.value = null
  editingTopicName.value = ''
  editingSources.value = []
  editingSourceInput.value = ''
  editingAnswerLength.value = 'medium'
  editingTimeframeDays.value = 7
  editingError.value = null
}

const isEditingTopic = (topicId: string) => editingTopicId.value === topicId

const saveEditingTopic = (topicId: string) => {
  editingError.value = null
  const name = editingTopicName.value.trim()

  if (!name) {
    editingError.value = 'Topic name is required.'
    return
  }

  const duplicate = topics.value.some(
    (topic) => topic.id !== topicId && topic.label.toLowerCase() === name.toLowerCase(),
  )
  if (duplicate) {
    editingError.value = 'Another topic already uses that name.'
    return
  }

  const normalizedSources = Array.from(
    new Set(
      editingSources.value
        .map((source) => source.trim())
        .filter((source): source is string => Boolean(source)),
    ),
  )

  updateTopic(topicId, {
    label: name,
    sources: normalizedSources,
    answerLength: editingAnswerLength.value,
    timeframeDays: sanitizeTimeframe(editingTimeframeDays.value),
  })
  cancelEditingTopic()
}

const sanitizeTimeframe = (value: number) => {
  if (!Number.isFinite(value)) return 7
  return Math.min(90, Math.max(1, Math.round(value)))
}

watch(
  topics,
  (next) => {
    const validIds = new Set(next.map((topic) => topic.id))
    expandedTopicIds.value = new Set(
      Array.from(expandedTopicIds.value).filter((id) => validIds.has(id))
    )
    if (editingTopicId.value && !validIds.has(editingTopicId.value)) {
      cancelEditingTopic()
    }
  },
  { deep: false }
)

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
      <div class="page-header__brand" aria-label="EASYNEWS">
        <p class="page-logo-text">EASYNEWS</p>
      </div>
      <div class="page-header__actions">
        <button
          class="add-topic-toggle"
          type="button"
          :aria-controls="TOPIC_FORM_ID"
          :aria-expanded="isTopicFormOpen"
          :disabled="isDigging"
          @click="toggleTopicForm"
        >
          <span>Add Topic</span>
        </button>
        <button class="dig-button" :disabled="isDigDisabled" @click="digTopics">
          <span>{{ isDigging ? 'DIGGING…' : 'DIG' }}</span>
        </button>
      </div>
    </header>

    <Transition name="form-collapse">
      <section v-if="isTopicFormOpen" class="card form-card" :id="TOPIC_FORM_ID">
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

          <fieldset class="field-group answer-length-group">
            <legend>Answer length</legend>
            <div class="answer-length-options">
              <label
                v-for="option in answerLengthOptions"
                :key="option.value"
                :class="[
                  'answer-length-option',
                  { 'answer-length-option--active': answerLength === option.value },
                ]"
              >
                <input
                  type="radio"
                  name="answer-length"
                  :value="option.value"
                  v-model="answerLength"
                />
                <span class="answer-length-option__label">{{ option.label }}</span>
                <span class="answer-length-option__helper">{{ option.helper }}</span>
              </label>
            </div>
          </fieldset>

          <div class="field-group">
            <label for="topic-timeframe">Look-back window (days)</label>
            <input
              id="topic-timeframe"
              v-model.number="timeframeDays"
              type="number"
              min="1"
              max="90"
              step="1"
              :disabled="isDigging"
            />
          </div>

          <div class="form-footer">
            <p v-if="formError" class="form-error">{{ formError }}</p>
            <button class="primary" type="submit" :disabled="!canAddTopic || isDigging">
              Add topic
            </button>
          </div>
        </form>
      </section>
    </Transition>

    <section class="topics-section">
      <p v-if="topics.length === 0" class="empty-state">
        No topics yet. Add one above and it will live in local storage.
      </p>

      <div v-else class="topic-grid">
        <article
          v-for="topic in topics"
          :key="topic.id"
          :class="[
            'card topic-card',
            {
              'topic-card--collapsed': !isTopicExpanded(topic.id),
              'topic-card--expanded': isTopicExpanded(topic.id),
            },
          ]"
          @click="handleCardClick(topic.id, $event)"
        >
          <header class="topic-card__header">
            <div class="topic-card__header-main">
              <p class="topic-label">{{ topic.label }}</p>
              <div class="topic-card__summary-meta">
                <span class="status-pill" :class="topic.status">
                  {{ statusCopy[topic.status] }}
                </span>
                <p class="topic-last-run">
                  Last dig <strong>{{ formatDateTime(topic.lastRunAt) }}</strong>
                </p>
                <p class="topic-timeframe">
                  Window: last {{ topic.timeframeDays }} day{{ topic.timeframeDays === 1 ? '' : 's' }}
                </p>
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
              <button
                class="topic-card__expander"
                type="button"
                :aria-expanded="isTopicExpanded(topic.id)"
                @click="toggleTopicCard(topic.id)"
              >
                <span class="sr-only">
                  {{ isTopicExpanded(topic.id) ? 'Collapse' : 'Expand' }} {{ topic.label }}
                </span>
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
          </header>

          <Transition name="topic-expand">
            <div v-if="isTopicExpanded(topic.id)" class="topic-card__details">
              <template v-if="isEditingTopic(topic.id)">
                <form class="topic-edit-form" @submit.prevent="saveEditingTopic(topic.id)">
                  <div class="field-group">
                    <label :for="`edit-topic-${topic.id}`">Topic name</label>
                    <input
                      :id="`edit-topic-${topic.id}`"
                      v-model="editingTopicName"
                      type="text"
                      placeholder="e.g. BMW Z4 new generation"
                      :disabled="isDigging"
                    />
                  </div>

                  <div class="field-group">
                    <label :for="`edit-topic-sources-${topic.id}`">Preferred Sources</label>
                    <div class="tag-input" @click="focusEditingSourceInput">
                      <span
                        v-for="(source, index) in editingSources"
                        :key="`${topic.id}-editing-${source}-${index}`"
                        class="tag-chip"
                      >
                        {{ source }}
                        <button
                          type="button"
                          class="tag-chip__remove"
                          @click.stop="removeEditingSourceAtIndex(index)"
                          aria-label="Remove source"
                        >
                          &times;
                        </button>
                      </span>
                      <input
                        :id="`edit-topic-sources-${topic.id}`"
                        ref="editingSourceInputRef"
                        v-model="editingSourceInput"
                        type="text"
                        placeholder="e.g. Reddit, TCB scans, TechCrunch"
                        :disabled="isDigging"
                        @keydown="handleEditingSourceKeydown"
                        @blur="addEditingSourceFromInput"
                      />
                    </div>
                  </div>

                  <fieldset class="field-group answer-length-group">
                    <legend>Answer length</legend>
                    <div class="answer-length-options">
                      <label
                        v-for="option in answerLengthOptions"
                        :key="`edit-${option.value}`"
                        :class="[
                          'answer-length-option',
                          { 'answer-length-option--active': editingAnswerLength === option.value },
                        ]"
                      >
                        <input
                          type="radio"
                          :name="`edit-answer-length-${topic.id}`"
                          :value="option.value"
                          v-model="editingAnswerLength"
                        />
                        <span class="answer-length-option__label">{{ option.label }}</span>
                        <span class="answer-length-option__helper">{{ option.helper }}</span>
                      </label>
                    </div>
                  </fieldset>

                  <div class="field-group">
                    <label :for="`edit-topic-timeframe-${topic.id}`">Look-back window (days)</label>
                    <input
                      :id="`edit-topic-timeframe-${topic.id}`"
                      v-model.number="editingTimeframeDays"
                      type="number"
                      min="1"
                      max="90"
                      step="1"
                      :disabled="isDigging"
                    />
                  </div>

                  <p v-if="editingError" class="form-error">{{ editingError }}</p>

                  <div class="topic-edit-actions">
                    <button class="primary" type="submit">Save changes</button>
                    <button
                      class="pill-button pill-button--muted"
                      type="button"
                      @click="cancelEditingTopic"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </template>
              <template v-else>
                <div v-if="topic.sources.length" class="topic-sources">
                  <p class="topic-sources__label">Sources</p>
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

                <div class="topic-card__actions">
                  <button class="pill-button" type="button" @click="startEditingTopic(topic)">
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M14.74 3.29a1 1 0 011.42 0l0.55 0.55a1 1 0 010 1.42l-7.63 7.64-2.83.4.4-2.83 7.63-7.64zM4.5 15.5h11a1 1 0 110 2h-11a1 1 0 110-2z"
                      />
                    </svg>
                    <span>Edit</span>
                  </button>
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
              </template>
            </div>
          </Transition>
        </article>
      </div>
    </section>
  </main>
</template>
