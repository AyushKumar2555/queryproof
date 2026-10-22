# Queryproof

Queryproof turns a plain-English question into an Elasticsearch query for one index, `drug_enforcement`, explains it, and saves the run so the result can be checked later.

The index holds public FDA drug-enforcement records. Queryproof does not generate queries for any other index.

## What it does

- Converts a natural-language question into Elasticsearch DSL
- Explains the query in plain English
- Flags performance issues and suggests optimizations
- Saves each run to MongoDB with the index name, LLM provider, and duration

## Architecture

```text
Client
  → Express API (apps/api, port 3000)
    → FastAPI AI service (apps/ai-service, port 8000)
      → LLM (mock, Gemini, OpenAI, or Anthropic)
    → MongoDB database `queryproof`
```

Recall records will live in Elasticsearch, not MongoDB. MongoDB stores application data only.

| Store | Database / index | What it holds |
| --- | --- | --- |
| MongoDB | `queryproof` | `QueryHistory` runs, `EvalCase` labeled questions |
| Elasticsearch | `drug_enforcement` | FDA drug-enforcement records |

## Layout

- `apps/ai-service/` — FastAPI service that calls the LLM and returns the query analysis
- `apps/api/` — Express API that validates input, proxies the AI service, and writes MongoDB
- `infra/docker/docker-compose.yml` — local Elasticsearch and Kibana. MongoDB on this machine is already running, so do not start the mongo service from this file.
- `infra/elasticsearch/recalls.index.json` — mapping body for the `drug_enforcement` index

## Quick start

MongoDB:

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

AI service:

```bash
cd apps/ai-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Set `LLM_PROVIDER=mock` in `apps/ai-service/.env` to run without an API key. Then:

```bash
python main.py
```

The AI service listens on `http://localhost:8000`.

API:

```bash
cd apps/api
npm install
copy .env.example .env
npm run dev
```

`apps/api/.env` should contain:

```bash
MONGO_URI=mongodb://localhost:27017/queryproof
AI_SERVICE_URL=http://localhost:8000
```

The API listens on `http://localhost:3000`.

## Try it

```bash
curl -X POST http://localhost:8000/api/v1/analyze ^
  -H "Content-Type: application/json" ^
  -d "{\"natural_language_query\": \"Class I insulin recalls in Texas during 2024\"}"
```

```bash
curl -X POST http://localhost:3000/api/analyze ^
  -H "Content-Type: application/json" ^
  -d "{\"naturalLanguageQuery\": \"Class I insulin recalls in Texas during 2024\", \"indexName\": \"drug_enforcement\"}"
```

```bash
curl http://localhost:3000/api/history
curl http://localhost:3000/api/stats
curl http://localhost:3000/health
```

AI service tests, from `apps/ai-service`:

```bash
pytest tests/test_query_analyzer.py -v
```

## Stack

- Python 3.11+, FastAPI, Pydantic v2
- Node.js, Express, Mongoose, MongoDB 7
- Elasticsearch 8.15 and Kibana 8.15, local Docker
- Gemini, OpenAI, Anthropic, or the built-in mock provider

## Not built yet

- Running the generated query against `drug_enforcement` and returning hits
- Scoring `EvalCase` questions against generated queries
- A demo page
- Auth
