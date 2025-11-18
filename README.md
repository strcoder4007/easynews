# News Center

Vue 3 app for saving custom news topics locally and digging up fresh OpenAI Responses summaries for each one. Every topic lives in `localStorage`, so reloading the page preserves your list.

## Features

- Add unlimited topics by name (the label becomes the OpenAI query we send to the Responses API).
- Persist topics + fetched summaries in `localStorage`; removing a topic clears its data.
- Single `DIG` action covers every saved topic sequentially, prompting OpenAI for a concise summary per topic.
- Live status badges (Idle, Fetching, Fetched, Error) plus last run timestamp and article counts per card.
- Article cards include a generated title, publish date, and description with an outbound link for further reading.

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create an environment file**

   ```bash
   cp .env.example .env
   ```

   - Set `VITE_OPENAI_API_KEY` (and optionally `OPENAI_API_KEY`) with your OpenAI key (https://platform.openai.com/api-keys). Vite only exposes variables that start with `VITE_`.
   - Optionally override `VITE_OPENAI_MODEL` or `VITE_OPENAI_API_URL` if you want to use a different model or gateway.

3. **Run the dev server**

   ```bash
   npm run dev
   ```

   Visit the printed URL to start adding topics and dig for news.

## Usage Tips

- Enter a topic name, hit **Add topic** (or press Enter) to store it.
- The **DIG** button iterates over every saved topic and refreshes the summary (one OpenAI-generated response per topic). Results are kept locally for reference, but every DIG run calls the OpenAI API.
- Remove a topic via its card’s **Remove** action. This also deletes its saved summaries from `localStorage`.

## Tech Stack

- [Vue 3](https://vuejs.org/) with `<script setup>` + TypeScript
- [Vite](https://vitejs.dev/) for tooling/bundling
- Native `localStorage` for persistence
- [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses) for topic summaries
