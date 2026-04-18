# EASYNEWS

Live preview (use your own Gemini API key): https://strcoder4007.github.io/easynews/

- Deep research agent with native web access via Google's built-in search tool that keeps every topic on a swappable deck, digs for breaking coverage, and lets you steer the prompt with explicit constraints.
- Works entirely in the browser — topics, prompts, and responses live in `localStorage`, so your desk opens instantly.

![EASYNEWS preview desktop](src/assets/easynews1.png)

Keep all your news updated and in one place

![EASYNEWS preview mobile](src/assets/easynews2.png)

## Core Capabilities

- **Topic deck:** create unlimited topics, toggle them on/off, and reorder the list by editing timeframe windows.
- **Guided digging:** the DIG action crafts a prompt from your topic name + optional guardrails, then asks for recent web-sourced updates.
- **Web-aware output:** responses include links, timestamps, and markdown copied straight into Zen Mode for distraction-free reading.
- **Stateful cards:** each topic shows Idle/Analyzing/Searching/Synthesizing/Fetched/Error status, last run time, and quick actions for clearing, deleting, or editing.
- **Zen Mode:** opens a minimal modal that strings all fetched summaries together for fast scan reading.
- **3-Layer Pipeline:** Topic Intelligence → Source-Diversified Search → Structured Synthesis.

## Requirements & Inputs

- Node.js 18+ and npm.
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) (paste it via **Add API KEY** in the header).

## Setup

- Install dependencies:

  ```bash
  npm install
  ```

- Seed the config file and add your Gemini API key:

  ```bash
  cp .env.example .env
  # Edit .env and add: VITE_GEMINI_API_KEY=your_key_here
  ```

- Run the dev server:

  ```bash
  npm run dev
  ```

- Build the static site (outputs to `docs/` for GitHub Pages):

  ```bash
  npm run build
  ```

- Publish to GitHub Pages:

  ```bash
  npm run deploy
  ```

## Architecture

The 3-Layer Pipeline:

1. **Topic Intelligence (Layer 1):** Gemini 3 Flash analyzes the topic, classifies it (breaking/feature/analysis/regulatory/earnings/opinion), determines the angle, and generates 3 diverse search queries targeting primary coverage, expert analysis, and regional/niche perspectives.

2. **Source-Diversified Search (Layer 2):** All 3 queries fire in parallel via Gemini's native `google_search` tool. Results are deduplicated and sorted by relevance.

3. **Structured Synthesis (Layer 3):** Gemini 3.1 Pro receives all gathered articles and produces a structured brief: classification, headline, key findings with confidence scores, implications, and a "what to watch" forward look.

## Stack

- **Vue 3** + TypeScript + Vite (static build, no backend)
- **@google/genai** for Gemini 3 API (native search + thinking + JSON mode)
- **Serper** removed — using Gemini's built-in `google_search` tool
- **localStorage** for persistence
