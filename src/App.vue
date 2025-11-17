<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DeepReadonly } from 'vue'
import { useTopics } from './composables/useTopics'
import type { Topic, TopicStatus } from './types/topic'
import { fetchNewsByPrompt } from './services/newsApi'

const { topics, addTopic, removeTopic, updateTopic } = useTopics()

const topicName = ref('')
const topicPrompt = ref('')
const formError = ref<string | null>(null)
const isDigging = ref(false)

const statusCopy: Record<TopicStatus, string> = {
  idle: 'Idle',
  fetching: 'Fetching…',
  success: 'Fetched',
  error: 'Error',
}

const canAddTopic = computed(() => {
  return Boolean(topicName.value.trim()) && Boolean(topicPrompt.value.trim())
})

const isDigDisabled = computed(() => {
  return isDigging.value || topics.value.length === 0
})

const handleAddTopic = () => {
  formError.value = null
  const name = topicName.value.trim()
  const prompt = topicPrompt.value.trim()

  if (!name || !prompt) {
    formError.value = 'Please enter both a topic name and a prompt.'
    return
  }

  const duplicate = topics.value.some(
    (topic) => topic.label.toLowerCase() === name.toLowerCase()
  )
  if (duplicate) {
    formError.value = 'That topic already exists. Try a different name.'
    return
  }

  addTopic(name, prompt)
  topicName.value = ''
  topicPrompt.value = ''
}

const handleRemoveTopic = (id: string) => {
  if (isDigging.value) return
  removeTopic(id)
}

const digTopics = async () => {
  if (isDigging.value || topics.value.length === 0) return

  isDigging.value = true
  try {
    const topicsSnapshot = [...topics.value]
    for (const topic of topicsSnapshot) {
      await digSingleTopic(topic)
    }
  } finally {
    isDigging.value = false
  }
}

const digSingleTopic = async (topic: DeepReadonly<Topic>) => {
  updateTopic(topic.id, { status: 'fetching', errorMessage: undefined })
  try {
    const articles = await fetchNewsByPrompt(topic.prompt)
    updateTopic(topic.id, {
      status: 'success',
      articles,
      lastRunAt: new Date().toISOString(),
      errorMessage: undefined,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    updateTopic(topic.id, {
      status: 'error',
      errorMessage: message,
      articles: [],
      lastRunAt: new Date().toISOString(),
    })
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

const formatArticleDate = (value: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
    }).format(new Date(value))
  } catch {
    return value
  }
}
</script>

<template>
  <main class="page">
    <header class="page-header">
      <div>
        <p class="eyebrow">News digger</p>
        <h1>Track fresh news for your topics</h1>
        <p class="lede">
          Add every topic with its own NewsAPI prompt, store them in your browser, and dig
          for articles whenever you hit the DIG button.
        </p>
      </div>
      <button class="dig-button" :disabled="isDigDisabled" @click="digTopics">
        <span>{{ isDigging ? 'DIGGING…' : 'DIG' }}</span>
        <small v-if="topics.length">{{ topics.length }} topic(s)</small>
      </button>
    </header>

    <section class="card form-card">
      <form class="topic-form" @submit.prevent="handleAddTopic">
        <div class="field-group">
          <label for="topic-name">Topic name</label>
          <input
            id="topic-name"
            v-model="topicName"
            type="text"
            placeholder="e.g. Apple earnings"
            :disabled="isDigging"
          />
        </div>

        <div class="field-group">
          <label for="topic-prompt">Prompt / query</label>
          <input
            id="topic-prompt"
            v-model="topicPrompt"
            type="text"
            placeholder="Example: Apple AND earnings"
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

    <section class="topics-section">
      <p v-if="topics.length === 0" class="empty-state">
        No topics yet. Add one above and it will live in local storage.
      </p>

      <div v-else class="topic-grid">
        <article v-for="topic in topics" :key="topic.id" class="card topic-card">
          <header class="topic-card__header">
            <div>
              <p class="topic-label">{{ topic.label }}</p>
              <p class="topic-prompt">Prompt: {{ topic.prompt }}</p>
            </div>
            <div class="topic-card__status">
              <span class="status-pill" :class="topic.status">{{ statusCopy[topic.status] }}</span>
              <button class="ghost" type="button" :disabled="isDigging" @click="handleRemoveTopic(topic.id)">
                Remove
              </button>
            </div>
          </header>

          <dl class="topic-meta">
            <div>
              <dt>Last dig</dt>
              <dd>{{ formatDateTime(topic.lastRunAt) }}</dd>
            </div>
            <div>
              <dt>Articles</dt>
              <dd>{{ topic.articles.length }}</dd>
            </div>
          </dl>

          <div class="topic-results">
            <p v-if="topic.status === 'error'" class="error-message">
              {{ topic.errorMessage ?? 'Unable to fetch news for this topic.' }}
            </p>
            <p v-else-if="topic.articles.length === 0">
              No stories yet. Hit DIG to pull the most recent news.
            </p>
            <ol v-else>
              <li v-for="article in topic.articles" :key="article.id">
                <a :href="article.url" target="_blank" rel="noopener noreferrer">
                  {{ article.title }}
                </a>
                <div class="article-meta">
                  <span>{{ article.source }}</span>
                  <span>{{ formatArticleDate(article.publishedAt) }}</span>
                </div>
                <p v-if="article.description" class="article-description">
                  {{ article.description }}
                </p>
              </li>
            </ol>
          </div>
        </article>
      </div>
    </section>
  </main>
</template>
