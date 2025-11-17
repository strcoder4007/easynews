# News Center

Vue 3 app for saving custom news topics (and their prompts) locally and digging up the latest headlines via NewsAPI. Every topic lives in `localStorage`, so reloading the page preserves your list.

## Features

- Add unlimited topics with both a display name and dedicated prompt/query.
- Persist topics + fetched articles in `localStorage`; removing a topic clears its data.
- Single `DIG` action covers every saved topic sequentially, always requesting < 1-week-old articles (`sortBy=publishedAt`, English language, 20 stories max).
- Live status badges (Idle, Fetching, Fetched, Error) plus last run timestamp and article counts per card.
- Article lists include source, publish date, and descriptions with outbound links.

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create an environment file**

   ```bash
   cp .env.example .env
   ```

   Update `VITE_NEWS_API_KEY` with your NewsAPI key (https://newsapi.org/). Vite only exposes variables that start with `VITE_` to the client bundle.

3. **Run the dev server**

   ```bash
   npm run dev
   ```

   Visit the printed URL to start adding topics and dig for news.

## Usage Tips

- Enter a topic name + prompt, hit **Add topic** (or press Enter) to store it.
- The **DIG** button iterates over every saved topic and refreshes the article list. Results are kept locally for reference, but every DIG run hits the live API.
- Remove a topic via its card’s **Remove** action. This also deletes its saved articles/prompt from `localStorage`.

## Tech Stack

- [Vue 3](https://vuejs.org/) with `<script setup>` + TypeScript
- [Vite](https://vitejs.dev/) for tooling/bundling
- Native `localStorage` for persistence
- [NewsAPI](https://newsapi.org/) `everything` endpoint for headlines
