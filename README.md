# EASYNEWS

EASYNEWS is a lightweight personal news desk that keeps your recurring topics on deck, pings OpenAI for ultra-fresh briefings, and caches everything locally so your dashboard is ready the moment you open it.

![EASYNEWS preview desktop](src/assets/easynews1.png)
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

   Outputs land in `dist/` via `vue-tsc -b && vite build`.

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
