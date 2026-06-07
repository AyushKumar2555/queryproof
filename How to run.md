# How to Run

> **Stage:** AI Service ✅ | Express API ✅ | MongoDB History ✅  
> **Overall:** Backend MVP is done — safe to demo on LinkedIn. Frontend, auth, and production tooling are next.

---

## Project Status (what's built)

| Layer | Status | Notes |
|-------|--------|-------|
| AI Service (FastAPI) | ✅ Done | NL → ES DSL, mock/Gemini/OpenAI/Anthropic, 12 unit tests |
| Express API | ✅ Done | Analyze proxy, validation, logging, error handling |
| MongoDB | ✅ Done | Query history saved to `es_query_db` (local or Atlas) |
| Query history API | ✅ Done | List, get by ID, delete, usage stats |
| Frontend / UI | ❌ Not started | API-only for now — test with Postman, curl, or NoSQL Booster |
| JWT auth | ❌ Not started | `JWT_SECRET` in config only — no login or middleware yet |
| Ollama provider | ❌ Not started | Listed in docs, not in code |
| Docker Compose | ❌ Not started | Manual startup for now |
| API automated tests | ❌ Not started | AI service has tests; Express has none |

**LinkedIn:** You can post now as a **backend MVP** — natural language → Elasticsearch query analysis, multi-LLM support, and persisted query history. Frame remaining work as "building next" (UI, auth, deployment), not as blockers.

---

## AI Service (Python FastAPI)

```bash
cd apps/ai-service
python -m venv venv

# activate
venv\Scripts\activate     # Windows
source venv/bin/activate  # Mac/Linux

pip install -r requirements.txt
cp .env.example .env      # then fill in your values
python main.py
```

Server runs at `http://localhost:8000`

---

## API Service (Express)

```bash
cd apps/api
npm install
cp .env.example .env
npm run dev
```

Server runs at `http://localhost:3000`

---

## Environment Variables

### AI Service (`apps/ai-service/.env`)
```bash
APP_ENV=development
DEBUG=true
LLM_PROVIDER=mock        # mock | gemini | ollama | openai | anthropic
GEMINI_API_KEY=          # get free key at aistudio.google.com
LLM_MODEL=gemini-2.0-flash
LLM_TEMPERATURE=0.1
API_SECRET_KEY=dev-secret-123
```

### API Service (`apps/api/.env`)
```bash
PORT=3000
NODE_ENV=development
AI_SERVICE_URL=http://localhost:8000
MONGO_URI=mongodb://localhost:27017/es_query_db   # or Atlas: mongodb+srv://USER:PASS@cluster.mongodb.net/es_query_db
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=7d
```

---

## Test It

```bash
# AI service tests
cd apps/ai-service
pytest tests/test_query_analyzer.py -v
# expected: 12 passed

# hit the AI service directly
curl -X POST http://localhost:8000/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{"natural_language_query": "Find companies in India with revenue over 1 million"}'

# hit the Express API (requires AI service + MongoDB running)
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"naturalLanguageQuery": "Find companies in India with revenue over 1 million"}'

curl http://localhost:3000/api/history
curl http://localhost:3000/health
```

Full API examples: `apps/api/API-Testing.md`

---

## LLM Providers

| Provider | Cost | Setup |
|----------|------|-------|
| `mock` | free | nothing — works out of the box |
| `gemini` | free tier | key from `aistudio.google.com` |
| `ollama` | free | **planned** — not implemented yet |
| `openai` | paid | key from `platform.openai.com` |
| `anthropic` | paid | key from `console.anthropic.com` |

---

## Common Errors

| Error | Fix |
|-------|-----|
| `activate` fails on PowerShell | run `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` |
| `ModuleNotFoundError` | make sure you're inside `apps/ai-service/` |
| `404 on /api/v1/analyze` | check `app.include_router(...)` exists in `main.py` |
| `gemini-1.5-flash not found` | change model to `gemini-2.0-flash` in `.env` |
| `LLM_PROVIDER=mock` not working | remove trailing spaces after `mock` in `.env` |

---

## What's Next (roadmap — do in this order)

### Phase 1 — Ship a usable product
- [ ] **Frontend UI** — query input, ES DSL output, explanation, history list (`apps/web` or similar)
- [ ] **JWT auth** — login/register, protect routes, tie history to `userId` in `query.model.js`
- [ ] **Root README** — project overview, architecture diagram, screenshots once UI exists

### Phase 2 — Quality & data
- [ ] **Express API tests** — integration tests for analyze, history, stats (replace `npm test` stub)
- [ ] **Re-enable AI response validation** — fix Zod v4 compatibility in `query.service.js`
- [ ] **Persist `provider` and `indexName`** — save LLM provider and index name to MongoDB (stats depend on this)
- [ ] **Sync API docs** — update `API-Documentation.md` (missing endpoints, correct field names)

### Phase 3 — DevOps & extras
- [ ] **Docker Compose** — one command to run MongoDB + AI service + API
- [ ] **CI pipeline** — run AI pytest + API tests on push
- [ ] **Ollama local LLM** — add provider in `query_analyzer.py`
- [ ] **API secret enforcement** — use `API_SECRET_KEY` between Express ↔ FastAPI if exposing publicly

### Already done
- [x] Express API Gateway (`apps/api/`)
- [x] MongoDB + Mongoose (Atlas or local)
- [x] Query history storage — analyze saves to DB; list, get, delete, stats endpoints
- [x] AI Service with mock, Gemini, OpenAI, Anthropic
- [x] AI unit tests (12 passed)