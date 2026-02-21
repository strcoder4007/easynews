# news-center (EasyNews) - Project Handoff

## 1. Project Overview

**EasyNews** is a browser-based AI news research tool. It creates topic decks, performs deep research with web access, and keeps all data in localStorage.

### Key Features
- **Topic deck**: Create unlimited topics, toggle on/off, reorder by timeframe
- **Guided digging**: AI crafts prompts from topic + guardrails, fetches web-sourced updates
- **Web-aware output**: Responses include links, timestamps, markdown
- **Stateful cards**: Idle/Fetching/Fetched/Error status indicators
- **Zen Mode**: Distraction-free reading modal

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Vite + React |
| **Build** | TypeScript |
| **AI** | OpenAI Responses API |
| **Storage** | localStorage (browser) |
| **Styling** | (check src/) |

---

## 3. File Structure

```
news-center/
├── src/                  # React source code
├── public/               # Static assets
├── docs/                 # Documentation
├── node_modules/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
└── README.md
```

---

## 4. Setup & Running

```bash
cd ~/Projects/news-center
npm install
cp .env.example .env     # Optional
npm run dev
```

Access: http://localhost:5173 (default Vite port)

### Environment Variables
```
VITE_OPENAI_MODEL=gpt-5.1-2025-11-13
VITE_OPENAI_MODEL_SMALL=gpt-5-mini-2025-08-07
```

---

## 5. Configuration

- User provides OpenAI API key via UI ("Add API KEY" in header)
- All state persisted to browser localStorage
- No backend required - runs entirely client-side

---

## 6. Known Issues

- Requires OpenAI API key with Responses API access
- Live preview at strcoder4007.github.io/easynews/ may have rate limits

---

## 7. What a New Agent Needs to Know

- Main logic in `src/` - check components for UI, services for AI calls
- OpenAI integration uses the Responses API (not standard Chat Completions)
- State management via localStorage - no database needed

---

*Generated: February 21, 2026*
