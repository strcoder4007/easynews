# EASYNEWS

You can try the app by using your own OpenAI API key: https://strcoder4007.github.io/easynews/

EASYNEWS is a deep research agent that keeps every recurring topic on a swappable deck, digs for the freshest news on demand, and routes your prompts through a robust UI so you can steer the briefings with precise constraints while everything stays locally cached for instant recall.

![EASYNEWS preview desktop](src/assets/easynews1.png)

Keep all your news in one place, launch a DIG sweep for the latest findings, and let the app craft OpenAI prompts directly from your query plus any guardrails you set.

![EASYNEWS preview mobile](src/assets/easynews2.png)

## Highlights

- Track unlimited topics—the label you type becomes the prompt sent to the OpenAI Responses API.
- Persist topics *and* fetched summaries in the browser’s `localStorage`; removing a topic clears every trace.
- A single **DIG** sweep fetches concise summaries for each enabled topic.
- Cards show live state (Idle, Fetching, Fetched, Error), last run timestamp, and article counts.
- Generated entries bundle a title, publish date, description, and outbound link for deeper reading.

## Quick Start

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **(Optional) Copy the env template** — only needed if you want to override defaults like the model or API URL.

   ```bash
   cp .env.example .env
   ```

3. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open the printed URL to start adding topics and digging for news.

4. **Build for production**

   ```bash
   npm run build
   ```

   Outputs land in `docs/` via `vue-tsc -b && vite build`.

## Environment Variables

Add these lines to your `.env` file so the client knows which OpenAI models to request:

```bash
VITE_OPENAI_MODEL=gpt-5.1-2025-11-13
VITE_OPENAI_MODEL_SMALL=gpt-5-mini-2025-08-07
```

## Configure OpenAI Access

- Click **Add API KEY** in the app header, paste your OpenAI key (`sk-...`), and hit **Add API KEY**.
- The key lives only in this browser’s `localStorage`; clearing storage or switching browsers requires re-entering it.
- Environment variables are still supported for power users:
  - `VITE_OPENAI_MODEL`, `VITE_OPENAI_MODEL_SMALL`, and `VITE_OPENAI_API_URL` let you point to alternate models/gateways.
  - Note: the `.env` key values are no longer read inside the app—frontend input is the source of truth.

## Workflow Tips

- Enter a topic and press **Add Topic** (or hit Enter) to save it instantly.
- **DIG** iterates over every enabled topic, calling OpenAI once per topic; cached responses remain visible until you clear them or remove the topic.
- Use the card actions to remove a topic, toggle whether it participates in DIG runs, or clear the last response.
- The Zen reading mode offers a distraction-free summary feed—open it via the **ZEN** button once you have summaries.

## Tech Stack

- [Vue 3](https://vuejs.org/) with `<script setup>` + TypeScript
- [Vite](https://vitejs.dev/) for tooling/bundling
- Native `localStorage` for persistence
- [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses) for topic summaries
