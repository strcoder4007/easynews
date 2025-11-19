import OpenAI from 'openai'
import type { AnswerLength } from '../types/topic'
import { getStoredApiKey } from './apiKeyStore'

const DEFAULT_MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-5-nano-2025-08-07'
const SMALL_MODEL =
  import.meta.env.VITE_OPENAI_MODEL_SMALL || 'gpt-5-nano'
const CUSTOM_API_URL = import.meta.env.VITE_OPENAI_API_URL?.trim()
const GPT51_PROMPTING_GUIDE = `
Core Upgrades: GPT-5.1 balances speed and intelligence for agentic and coding tasks, featuring a new "none" reasoning mode for low-latency interactions.
Tag System: XML-like tags (e.g., <final_answer_formatting>) serve as modular building blocks in prompts, isolating specific rules for outputs, user updates, and tool usage. This structure minimizes conflicts and prompt bloat, enabling GPT-5.1 to apply instructions with greater precision and reliability in production environments.
Best Practices: Leverage defined personas for fine-tuned steerability, progress updates for better supervision in multi-turn workflows, and metaprompting techniques for ongoing refinement. Additionally, incorporate new built-in tools like apply_patch to streamline coding and iterative file edits.

Overview: This condensed guide highlights how the new tags act as structural delimiters so GPT-5.1 can parse and enforce instructions independently—reducing complexity while boosting performance.

Tag Explanations at a Glance
<final_answer_formatting>: Enforces guidelines for the final response's structure, length, and content, such as promoting compactness and excluding unnecessary logs.
<output_verbosity_spec>: Manages the overall level of response detail and stylistic elements, like Markdown formatting or sentence limits.
<user_updates_spec>: Outlines rules for progress updates (preambles), including sub-tags for frequency and content to keep users informed during rollouts.
<user_update_immediacy>: Ensures immediate communication by requiring commentary before any internal reasoning or analysis.
<solution_persistence>: Encourages autonomous task completion, biasing the model toward full implementation without premature halts or excessive queries.
<reservation_tool_usage_rules>: Details conditions for tool invocation, parameter validation, and post-execution handling to guide precise function calls.
<reservation_tool_example>: Delivers few-shot examples to illustrate tool flows, from user query to call execution and response.
<plan_tool_usage>: Directs the integration and maintenance of planning tools for tracking milestones in complex tasks.
<design_system_enforcement>: Limits outputs to predefined design constraints, such as CSS token usage, for consistent UI generation.
`.trim()

let cachedClient: OpenAI | null = null
let cachedClientApiKey: string | null = null

type FetchNewsOptions = {
  onPromptReady?: (prompt: string) => void
}

export async function fetchNewsForTopic(
  topicLabel: string,
  sources: readonly string[] = [],
  answerLength: AnswerLength = 'medium',
  timeframeDays = 7,
  options?: FetchNewsOptions,
): Promise<{ summary: string; prompt: string }> {
  const trimmedLabel = topicLabel.trim()
  if (!trimmedLabel) {
    throw new Error('Cannot query OpenAI with an empty topic name.')
  }

  const apiKey = getStoredApiKey()
  if (!apiKey) {
    throw new Error('Missing OpenAI API key. Please add one from the Add API KEY panel.')
  }

  const client = getOpenAiClient(apiKey)
  const craftedPrompt = await craftTopicPrompt(
    client,
    trimmedLabel,
    sources,
    answerLength,
    timeframeDays,
  )
  if (!craftedPrompt) {
    throw new Error('Failed to generate a prompt for this topic.')
  }
  options?.onPromptReady?.(craftedPrompt)

  const response = await client.responses.create({
    model: DEFAULT_MODEL,
    tools: [{ type: 'web_search' }],
    instructions: buildSystemPrompt(),
    input: craftedPrompt,
    reasoning: { effort: 'low', summary: 'detailed' },
  })
  console.log('OpenAI response for topic:', trimmedLabel, response)

  const summary = extractText(response)
  if (!summary) {
    throw new Error('OpenAI returned no content for this topic.')
  }

  return { summary, prompt: craftedPrompt }
}

function getOpenAiClient(apiKey: string) {
  if (cachedClient && cachedClientApiKey === apiKey) return cachedClient
  cachedClient = new OpenAI({
    apiKey,
    baseURL: CUSTOM_API_URL || undefined,
    dangerouslyAllowBrowser: true,
  })
  cachedClientApiKey = apiKey
  return cachedClient
}

function buildSystemPrompt(): string {
  return [
    'Follow the prompt closely.',
    '<markdown>Reply in pure Markdown with no redundant blank lines. Bold the lead insight, use tight bullets for supporting facts, italicize unverified intel, and cite sources inline with [source]. Never wrap the full response in code fences or add meta commentary.</markdown>',
  ].join('\n')
}

async function craftTopicPrompt(
  client: OpenAI,
  topic: string,
  sources: readonly string[],
  answerLength: AnswerLength,
  timeframeDays: number
): Promise<string | null> {
  const today = new Date().toISOString().split('T')[0]
  const sourceList = sources.length
    ? sources.map((source) => `- ${source}`).join('\n')
    : '- (no preference provided)'
  const sourceDirective = sources.length
    ? `Embed and prioritize these sources in the prompt: ${sources.join(', ')}.`
    : 'Identify 3–4 authoritative mainstream and niche outlets that fit the topic and mention them explicitly inside the prompt so the downstream assistant knows where to search.'
  const answerLengthCopy =
    answerLength === 'short'
      ? 'short (<30 words)'
      : answerLength === 'medium'
        ? 'medium (<100 words)'
        : 'long (<400 words)'
  // Lets call the below API "Prompt API"
  try {
    const response = await client.responses.create({
      model: SMALL_MODEL,
      instructions: [
        'You are a senior prompt engineer crafting instructions for a GPT-5.1 news analyst assistant.',
        'Use the GPT-5.1 prompting guide in the input: isolate each requirement with the tag system (<final_answer_formatting>, <output_verbosity_spec>, <solution_persistence>, etc.) so downstream execution is reliable.',
        'Return only the finished prompt—no analysis, labels, or fences.',
        'The prompt must: demand the freshest coverage, call out explicit sources, describe the Markdown format (bold lead, tight bullets, forward-looking closer), and enforce the requested answer length.',
        'When the user provides no preferred sources, propose credible outlets yourself and include them in the prompt.',
      ].join('\n'),
      input: [
        `Today's Date: ${today}`,
        `Topic: ${topic}`,
        `Timeframe: last ${timeframeDays} day(s)`,
        `Preferred sources (if any):\n${sourceList}`,
        sourceDirective,
        `Desired answer length: ${answerLengthCopy}`,
        `GPT-5.1 Prompting Guide:\n${GPT51_PROMPTING_GUIDE}`,
        'Write a single, well-structured prompt the downstream assistant can run as-is.',
      ].join('\n'),
      reasoning: { effort: 'low', summary: 'detailed' },
    })
    const crafted = extractText(response)?.trim()
    return crafted && crafted.length > 0 ? crafted : null
  } catch (error) {
    console.warn('Prompt crafting failed; no prompt generated.', error)
    return null
  }
}

function extractText(payload: OpenAI.Responses.Response): string | null {
  if (Array.isArray(payload.output_text) && payload.output_text.length > 0) {
    return payload.output_text.join('\n').trim()
  }

  const segments: string[] = []
  for (const block of payload.output ?? []) {
    const contentItems = (block as { content?: Array<{ text?: string }> }).content ?? []
    for (const content of contentItems) {
      if (content?.text) {
        segments.push(content.text)
      }
    }
  }
  const combined = segments.join('\n').trim()
  return combined.length > 0 ? combined : null
}
