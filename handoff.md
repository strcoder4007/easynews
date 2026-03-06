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
| **AI** | Google Gemini 2.0 Flash (via @google/generative-ai) |
| **Search** | Google Search via Serper API |
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
cp .env.example .env     # Optional (already has keys configured)
npm run dev
```

Access: http://localhost:5173 (default Vite port)

### Environment Variables
```
VITE_GEMINI_MODEL=gemini-2.0-flash-exp
VITE_SERPER_API_KEY=your_serper_api_key_here
```

---

## 5. Configuration

- User provides Gemini API key via UI ("Add API KEY" in header)
- Serper API key is configured via .env (for server-side search)
- All state persisted to browser localStorage
- No backend required - runs entirely client-side

---

## 6. Known Issues

- Requires Gemini API key
- Search uses Serper API (configured in .env)

---

## 7. What a New Agent Needs to Know

- Main logic in `src/` - check components for UI, services for AI calls
- Gemini integration uses @google/generative-ai SDK
- Search is performed via Serper API (Google search)
- State management via localStorage - no database needed

---

## 8. Migration Notes (March 2026)

- Migrated from OpenAI Responses API to Gemini 2.0 Flash
- Replaced OpenAI web_search tool with Serper API for Google search
- API key storage remains in localStorage (user-provided)
- Serper key is configured in .env file

---

*Generated: February 21, 2026*
*Updated: March 6, 2026*
