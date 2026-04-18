<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DeepReadonly } from 'vue'
import { useTopics } from './composables/useTopics'
import type { AnswerLength, Topic, TopicStatus } from './types/topic'
import { fetchNewsForTopic } from './services/newsApi'
import { getStoredApiKey, saveApiKey } from './services/apiKeyStore'
import { marked } from 'marked'
import DOMPurify from 'dompurify'


marked.setOptions({
  breaks: true,
})
const { topics, addTopic, removeTopic, updateTopic, mergeTopics, exportTopics } = useTopics()

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
const isApiKeyFormOpen = ref(false)
const API_KEY_FORM_ID = 'api-key-form-panel'
const IMPORT_EXPORT_FORM_ID = 'import-export-form-panel'
const isImportExportOpen = computed(() => topics.value.length === 0)
const importJsonInput = ref('')
const importError = ref<string | null>(null)
const importSuccess = ref<string | null>(null)
const storedApiKey = ref<string | null>(getStoredApiKey())
const apiKeyInput = ref('')
const apiKeyFormError = ref<string | null>(null)
const hasStoredApiKey = computed(() => Boolean(storedApiKey.value))

const answerLengthOptions: Array<{ label: string; value: AnswerLength; helper: string }> = [
  { label: 'Short', value: 'short', helper: '< 30 words' },
  { label: 'Medium', value: 'medium', helper: '< 100 words' },
  { label: 'Long', value: 'long', helper: '< 400 words' },
]

const editingTopicId = ref<string | null>(null)
const editingTopicName = ref('')
const editingSources = ref<string[]>([])
const editingSourceInput = ref('')
const editingSourceInputRef = ref<HTMLInputElement | null>(null)
const editingAnswerLength = ref<AnswerLength>('medium')
const editingTimeframeDays = ref(7)
const editingError = ref<string | null>(null)
type ThemeMode = 'light' | 'dark'
const THEME_STORAGE_KEY = 'easynews:theme'

const getStoredThemePreference = (): ThemeMode | null => {
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : null
}

const resolveInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'dark'
  const stored = getStoredThemePreference()
  if (stored) return stored
  return 'dark'
}

const applyThemeToDocument = (mode: ThemeMode) => {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = mode
}

const theme = ref<ThemeMode>(resolveInitialTheme())
const isDarkTheme = computed(() => theme.value === 'dark')
const themeToggleDescription = computed(() =>
  isDarkTheme.value ? 'Switch to light mode' : 'Switch to dark mode'
)

watch(
  theme,
  (next) => {
    applyThemeToDocument(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    }
  },
  { immediate: true }
)

const toggleTheme = () => {
  theme.value = isDarkTheme.value ? 'light' : 'dark'
}

const showZenModal = ref(false)

const renderMarkdown = (value?: string) => {
  if (!value) return ''
  const html = marked.parse(value) as string
  return DOMPurify.sanitize(html)
}

const openZenModal = () => {
  if (!zenTopics.value.length) return
  showZenModal.value = true
}

const closeZenModal = () => {
  showZenModal.value = false
}

const statusCopy: Record<TopicStatus, string> = {
  idle: 'Idle',
  analyzing: 'Analyzing…',
  searching: 'Searching…',
  synthesizing: 'Synthesizing…',
  success: 'Fetched',
  error: 'Error',
}

const sortedTopics = computed(() => {
  return [...topics.value].sort((a, b) => {
    if (a.timeframeDays === b.timeframeDays) {
      return a.label.localeCompare(b.label)
    }
    return a.timeframeDays - b.timeframeDays
  })
})

const zenTopics = computed(() => {
  return sortedTopics.value.filter((topic) => {
    if (!topic.digEnabled) return false
    const response = topic.response
    return typeof response === 'string' && response.trim().length > 0
  })
})

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

const handleApiKeySubmit = () => {
  apiKeyFormError.value = null
  const candidate = apiKeyInput.value.trim()
  if (!candidate) {
    apiKeyFormError.value = 'Please enter a valid API key.'
    return
  }
  saveApiKey(candidate)
  storedApiKey.value = candidate
  apiKeyInput.value = ''
  isApiKeyFormOpen.value = false
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
  isTopicFormOpen.value = false
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
  updateTopic(topic.id, { status: 'analyzing', errorMessage: undefined })
  try {
    const { summary, tokenUsage } = await fetchNewsForTopic(
      topic.label,
      topic.sources,
      topic.answerLength,
      topic.timeframeDays,
      {
        onLayerProgress: (layer, _detail) => {
          const statusMap: Record<1 | 2 | 3, TopicStatus> = {
            1: 'analyzing',
            2: 'searching',
            3: 'synthesizing',
          }
          updateTopic(topic.id, { status: statusMap[layer], layerProgress: layer })
        },
      }
    )
    updateTopic(topic.id, {
      status: 'success',
      response: summary,
      tokenUsage,
      lastRunAt: new Date().toISOString(),
      errorMessage: undefined,
      layerProgress: undefined,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    updateTopic(topic.id, {
      status: 'error',
      errorMessage: message,
      response: undefined,
      lastRunAt: new Date().toISOString(),
      layerProgress: undefined,
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
  const nextState = !isTopicFormOpen.value
  isTopicFormOpen.value = nextState
  if (nextState) {
    isApiKeyFormOpen.value = false
  }
}

const toggleApiKeyForm = () => {
  apiKeyFormError.value = null
  const nextState = !isApiKeyFormOpen.value
  isApiKeyFormOpen.value = nextState
  if (nextState) {
    isTopicFormOpen.value = false
  }
}

const handleImportSubmit = () => {
  importError.value = null
  importSuccess.value = null
  const raw = importJsonInput.value.trim()
  if (!raw) {
    importError.value = 'Please paste some JSON first.'
    return
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    importError.value = 'Invalid JSON. Check the format and try again.'
    return
  }
  if (!Array.isArray(parsed)) {
    importError.value = 'Expected a JSON array of topics.'
    return
  }
  mergeTopics(parsed as Partial<Topic>[])
  const count = (parsed as unknown[]).length
  importSuccess.value = `${count} topics imported.`
  importJsonInput.value = ''
  setTimeout(() => {
    importSuccess.value = null
  }, 1500)
}

const handleExportClick = () => {
  const json = exportTopics()
  const date = new Date().toISOString().slice(0, 10)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `easynews-topics-${date}.json`
  a.click()
  URL.revokeObjectURL(url)
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

watch(zenTopics, (next) => {
  if (!next.length) {
    showZenModal.value = false
  }
})

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

</script>

<template>
  <main class="page">
    <header class="page-header">
      <div class="page-header__brand" aria-label="EASYNEWS">
        <p class="page-logo-text">EASYNEWS</p>
      </div>
      <div class="page-header__actions">
        <button
          class="theme-toggle"
          type="button"
          role="switch"
          :aria-checked="isDarkTheme"
          :aria-label="themeToggleDescription"
          :title="themeToggleDescription"
          @click="toggleTheme"
        >
          <span class="theme-toggle__icon" aria-hidden="true">
            <!-- Sun icon (shown in dark mode → switch to light) -->
            <svg v-if="isDarkTheme" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="4"/>
              <line x1="12" y1="2" x2="12" y2="6"/>
              <line x1="12" y1="18" x2="12" y2="22"/>
              <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
              <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
              <line x1="2" y1="12" x2="6" y2="12"/>
              <line x1="18" y1="12" x2="22" y2="12"/>
              <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
              <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
            </svg>
            <!-- Moon icon (shown in light mode → switch to dark) -->
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </span>
        </button>
        <button
          class="add-topic-toggle"
          type="button"
          :aria-controls="API_KEY_FORM_ID"
          :aria-expanded="isApiKeyFormOpen"
          title="Toggle the panel to add or update your API key"
          @click="toggleApiKeyForm"
        >
          <span class="header-accent-text">Add API Key</span>
        </button>
        <button
          class="add-topic-toggle"
          type="button"
          :aria-controls="TOPIC_FORM_ID"
          :aria-expanded="isTopicFormOpen"
          :disabled="isDigging"
          title="Toggle the panel to add a new topic"
          @click="toggleTopicForm"
        >
          <span class="header-accent-text">Add Topic</span>
        </button>
        <button
          class="zen-button"
          type="button"
          :disabled="!zenTopics.length"
          title="Open Zen reading mode to review every summary"
          @click="openZenModal"
        >
          <span class="header-accent-text">Zen Mode</span>
        </button>
        <button
          class="dig-button"
          :disabled="isDigDisabled"
          title="Fetch fresh updates for all enabled topics"
          @click="digTopics"
        >
          <span>{{ isDigging ? 'DIGGING…' : 'FIND NEWS' }}</span>
        </button>
      </div>
    </header>

    <Transition name="form-collapse">
      <section v-if="isApiKeyFormOpen" class="card form-card" :id="API_KEY_FORM_ID">
        <form class="topic-form api-key-form" @submit.prevent="handleApiKeySubmit">
          <div class="field-group">
            <label for="api-key-input">Gemini API key</label>
            <input
              id="api-key-input"
              v-model="apiKeyInput"
              type="password"
              placeholder="sk-..."
              autocomplete="off"
              spellcheck="false"
            />
          </div>

          <div class="form-footer">
            <p v-if="apiKeyFormError" class="form-error">{{ apiKeyFormError }}</p>
            <p v-else-if="hasStoredApiKey" class="form-hint">Key saved to this browser.</p>
            <button class="primary" type="submit">Add API KEY</button>
          </div>
        </form>
      </section>
    </Transition>

    <Transition name="form-collapse">
      <section v-if="isTopicFormOpen" class="card form-card" :id="TOPIC_FORM_ID">
        <form class="topic-form" @submit.prevent="handleAddTopic">
          <div class="field-group">
            <label for="topic-name">Add Topic</label>
            <input
              id="topic-name"
              v-model="topicName"
              type="text"
              placeholder="e.g. PC FPS/RPG games that got cracked"
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
                title="Remove this source"
                @click.stop="removeSourceAtIndex(index)"
                aria-label="Remove source"
              >
                  <svg viewBox="0 0 20 20" aria-hidden="true" fill="currentColor" width="12" height="12">
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/>
                  </svg>
                </button>
              </span>
              <input
                id="topic-sources-input"
                ref="sourceInputRef"
                v-model="sourceInput"
                type="text"
                placeholder="e.g. Reddit, r/crackwatch, TCB scans, TechCrunch"
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
            <button
              class="primary"
              type="submit"
              :disabled="!canAddTopic || isDigging"
              title="Save this topic"
            >
              Add topic
            </button>
          </div>
        </form>
      </section>
    </Transition>

    <Transition name="form-collapse">
      <section v-if="isImportExportOpen" class="card form-card" :id="IMPORT_EXPORT_FORM_ID">
        <form class="topic-form" @submit.prevent="handleImportSubmit">
          <div class="field-group">
            <h3>Import / Export Topics</h3>
          </div>

          <div class="field-group">
            <details class="sample-json-details">
              <summary>Sample JSON</summary>
              <pre class="sample-json-body">[
  {
    "label": "Technical AI Agent News",
    "sources": [],
    "answerLength": "medium",
    "timeframeDays": 2,
    "digEnabled": true
  },
  {
    "label": "Toyota cars releasing in India",
    "sources": [],
    "answerLength": "short",
    "timeframeDays": 7,
    "digEnabled": true
  },
  {
    "label": "Reddit Crackwatch 5 best Posts",
    "sources": ["r/CrackWatch"],
    "answerLength": "short",
    "timeframeDays": 14,
    "digEnabled": true
  },
  {
    "label": "Fitgirl repack latest games",
    "sources": [],
    "answerLength": "short",
    "timeframeDays": 7,
    "digEnabled": true
  }
]</pre>
            </details>
          </div>

          <div class="field-group">
            <label for="import-json-input">Paste JSON to import</label>
            <textarea
              id="import-json-input"
              v-model="importJsonInput"
              rows="6"
              placeholder='[{"label": "...", "sources": [...], ...}]'
            ></textarea>
          </div>

          <p v-if="importError" class="form-error">{{ importError }}</p>
          <p v-if="importSuccess" class="form-success">{{ importSuccess }}</p>

          <div class="form-footer">
            <button class="primary" type="submit">Import Topics</button>
            <button class="secondary" type="button" @click="handleExportClick">Export Topics</button>
          </div>
        </form>
      </section>
    </Transition>

    <div v-if="!hasStoredApiKey" class="api-key-warning" role="alert">
      No API key found. Click "Add API KEY" to enter one before digging.
    </div>

    <section class="topics-section">
      <div v-if="topics.length > 0" class="topic-grid">
        <article
          v-for="topic in sortedTopics"
          :key="topic.id"
          :class="[
            'card topic-card',
            {
              'topic-card--collapsed': !isTopicExpanded(topic.id),
              'topic-card--expanded': isTopicExpanded(topic.id),
              'topic-card--fetching': ['analyzing', 'searching', 'synthesizing'].includes(topic.status),
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
                <span v-if="topic.status !== 'idle' && topic.status !== 'success' && topic.status !== 'error'" class="layer-progress">
                  Layer {{ topic.layerProgress }}/3
                </span>
                <p class="topic-last-run">
                  Last dig <strong>{{ formatDateTime(topic.lastRunAt) }}</strong>
                </p>
                <p class="topic-timeframe">
                  Window: last {{ topic.timeframeDays }} day{{ topic.timeframeDays === 1 ? '' : 's' }}
                </p>
                <p v-if="topic.tokenUsage" class="topic-token-count">
                  Tokens: {{ topic.tokenUsage.totalTokens.toLocaleString() }}
                  <span class="token-detail">
                    ({{ topic.tokenUsage.promptTokens.toLocaleString() }} in
                    / {{ topic.tokenUsage.completionTokens.toLocaleString() }} out)
                  </span>
                </p>
              </div>
            </div>
            <div class="topic-card__header-actions">
              <button
                :class="[
                  'topic-card__single-dig',
                  { 'topic-card__single-dig--spinning': ['analyzing', 'searching', 'synthesizing'].includes(topic.status) },
                ]"
                type="button"
                :disabled="isDigging"
                title="Fetch only this topic right now"
                @click="handleDigTopicNow(topic.id)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M16.023 9.348h4.992V4.356m-1.743 2.449A9.295 9.295 0 009.184 3.067 9.28 9.28 0 003 9.75m4.977 4.545H3v4.992m1.743-2.449a9.295 9.295 0 009.088 3.738 9.28 9.28 0 006.44-4.786"
                    fill="none"
                    stroke="currentColor"
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
                  :title="topic.digEnabled ? 'Disable automatic digging' : 'Enable automatic digging'"
                  @change="handleDigToggle(topic.id, ($event.target as HTMLInputElement).checked)"
                />
                <span class="dig-switch__track" aria-hidden="true"></span>
              </label>
              <button
                class="topic-card__expander"
                type="button"
                :aria-expanded="isTopicExpanded(topic.id)"
                title="Expand topic details"
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
                      placeholder="e.g. PC FPS/RPG games that got cracked"
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
                          title="Remove this source"
                          @click.stop="removeEditingSourceAtIndex(index)"
                          aria-label="Remove source"
                        >
                          <svg viewBox="0 0 20 20" aria-hidden="true" fill="currentColor" width="12" height="12">
                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/>
                          </svg>
                        </button>
                      </span>
                      <input
                        :id="`edit-topic-sources-${topic.id}`"
                        ref="editingSourceInputRef"
                        v-model="editingSourceInput"
                        type="text"
                        placeholder="e.g. Reddit, r/crackwatch, TCB scans, TechCrunch"
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
                    <button class="primary" type="submit" title="Save these changes">Save changes</button>
                    <button
                      class="pill-button pill-button--muted"
                      type="button"
                      title="Cancel editing"
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
                  <button
                    class="pill-button"
                    type="button"
                    title="Edit topic details"
                    @click="startEditingTopic(topic)"
                  >
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
                    title="Clear saved response"
                    @click="handleClearResponse(topic.id)"
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
                    title="Delete topic"
                    @click="handleRemoveTopic(topic.id)"
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
                  <div v-else class="topic-response" v-html="renderMarkdown(topic.response)"></div>
                </div>

              </template>
            </div>
          </Transition>
        </article>
      </div>
    </section>
  </main>

  <Transition name="zen-fade">
    <div v-if="showZenModal" class="zen-modal-overlay" @click.self="closeZenModal">
      <div class="zen-modal">
        <header class="zen-modal__header">
          <div>
            <h2>Zen Mode</h2>
          </div>
          <button
            class="zen-modal__close"
            type="button"
            title="Close Zen mode"
            aria-label="Close Zen mode"
            @click="closeZenModal"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6l-12 12"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </header>
        <div class="zen-modal__content">
          <article v-for="topic in zenTopics" :key="`zen-${topic.id}`" class="zen-entry">
            <header class="zen-entry__header">
              <p class="zen-entry__label">{{ topic.label }}</p>
              <span class="zen-entry__window">Window: {{ topic.timeframeDays }} day{{ topic.timeframeDays === 1 ? '' : 's' }}</span>
            </header>
            <div v-if="topic.status === 'error'" class="zen-entry__message">
              {{ topic.errorMessage ?? 'Unable to fetch news for this topic.' }}
            </div>
            <div v-else-if="!topic.response" class="zen-entry__message">
              No summary yet. Hit DIG to pull the most recent news.
            </div>
            <div v-else class="zen-entry__body" v-html="renderMarkdown(topic.response)"></div>
          </article>
        </div>
      </div>
    </div>
  </Transition>
</template>
