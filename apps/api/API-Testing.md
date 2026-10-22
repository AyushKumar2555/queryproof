# API Testing Guide

Manual testing guide for the Express API (`http://localhost:3000`) using **Postman** or **curl**.

For endpoint reference and response schemas, see [API-Documentation.md](./API-Documentation.md).

---

## Prerequisites

Start these services before testing:


| Service     | Command                                                 | URL                     |
| ----------- | ------------------------------------------------------- | ----------------------- |
| MongoDB     | Atlas or local instance running                         | —                       |
| AI Service  | `cd apps/ai-service` → activate venv → `python main.py` | `http://localhost:8000` |
| Express API | `cd apps/api` → `npm run dev`                           | `http://localhost:3000` |


### Environment

Ensure `apps/api/.env` is configured:

```bash
PORT=3000
NODE_ENV=development
AI_SERVICE_URL=http://localhost:8000
MONGO_URI=mongodb+srv://USER:PASSWORD@cluster.mongodb.net/es_query_db?appName=Cluster0
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=7d
```

**Important:** Include the database name in `MONGO_URI` (e.g. `/es_query_db`). Without it, query history may be saved to the `test` database instead of the one you expect.

For AI service testing without API keys, set in `apps/ai-service/.env`:

```bash
LLM_PROVIDER=mock
```

With `mock`, every analyze request returns the same sample query for `drug_enforcement`: Class I insulin recalls in Texas.

### Where data is stored

Query history is saved to the MongoDB collection `**queryhistories**`, not `users`. The `indexName` field in requests is metadata only — it does not create a MongoDB collection with that name.

---

## Recommended test order

Run requests in this sequence:

```
1. GET  /health
2. POST /api/analyze          (creates history)
3. GET  /api/history
4. GET  /api/history/:id
5. GET  /api/stats
6. POST /api/analyze          (invalid body → 400)
7. DELETE /api/history/:id
8. GET  /api/history          (confirm delete)
```

---

## Postman setup

1. Open Postman → **New** → **Collection** → name it `ES Query Intelligence`.
2. Add a collection variable: `baseUrl` = `http://localhost:3000`.
3. Create each request below using `{{baseUrl}}` or the full URL.

For all POST requests:

- **Body** → **raw** → **JSON**
- Header: `Content-Type: application/json`

---

## Express API endpoints

### 1. Health check


| Field  | Value                          |
| ------ | ------------------------------ |
| Method | `GET`                          |
| URL    | `http://localhost:3000/health` |


**Expected response (200):**

```json
{
  "status": "ok",
  "timestamp": "2026-06-02T10:24:26.535Z",
  "env": "development",
  "services": {
    "mongodb": "connected",
    "aiService": "connected"
  }
}
```


| Status | Meaning                                     |
| ------ | ------------------------------------------- |
| `200`  | MongoDB connected                           |
| `503`  | MongoDB disconnected (`status: "degraded"`) |


If `aiService` is `"disconnected"`, start the AI service on port 8000 and retry.

---

### 2. Analyze query


| Field  | Value                               |
| ------ | ----------------------------------- |
| Method | `POST`                              |
| URL    | `http://localhost:3000/api/analyze` |


**Request body (minimal):**

```json
{
  "naturalLanguageQuery": "Class I insulin recalls in Texas during 2024",
  "indexName": "drug_enforcement"
}
```

**Request body (with index mapping):**

```json
{
  "naturalLanguageQuery": "Class I insulin recalls in Texas during 2024",
  "indexName": "drug_enforcement",
  "indexMapping": {
    "mappings": {
      "properties": {
        "classification": { "type": "keyword" },
        "state": { "type": "keyword" },
        "product_description": { "type": "text" }
      }
    }
  }
}
```


| Field                  | Required | Rules                      |
| ---------------------- | -------- | -------------------------- |
| `naturalLanguageQuery` | Yes      | String, 5–2000 characters  |
| `indexName`            | No       | Defaults to `drug_enforcement` |
| `indexMapping`         | No       | JSON object                |


**Expected response (200):**

```json
{
  "success": true,
  "data": {
    "esQuery": { "query": { "bool": { "filter": [] } } },
    "explanation": "Human-readable explanation of the query",
    "performanceIssues": [
      {
        "severity": "warn",
        "title": "Issue title",
        "description": "Issue description"
      }
    ],
    "optimizations": [
      {
        "title": "Optimization title",
        "impact": "high",
        "description": "What this optimization does",
        "optimized_query": null
      }
    ],
    "mappingSuggestions": [
      {
        "field": "country",
        "current_type": null,
        "suggested_type": "keyword",
        "reason": "Why this mapping is better"
      }
    ]
  }
}
```


| Status | Meaning                      |
| ------ | ---------------------------- |
| `200`  | Analysis successful          |
| `400`  | Validation failed            |
| `502`  | AI service returned an error |
| `503`  | AI service not running       |
| `504`  | AI service timed out         |


---

### 3. Analyze query — validation error


| Field  | Value                               |
| ------ | ----------------------------------- |
| Method | `POST`                              |
| URL    | `http://localhost:3000/api/analyze` |


**Request body:**

```json
{
  "naturalLanguageQuery": "hi"
}
```

**Expected response (400):** Error message indicating the query must be at least 5 characters.

---

### 4. Query history (list)


| Field  | Value                               |
| ------ | ----------------------------------- |
| Method | `GET`                               |
| URL    | `http://localhost:3000/api/history` |


**Query parameters:**


| Parameter | Default | Max | Description           |
| --------- | ------- | --- | --------------------- |
| `limit`   | 20      | 100 | Records per page      |
| `page`    | 1       | —   | Page number (1-based) |


Example URL: `http://localhost:3000/api/history?limit=10&page=1`

**Expected response (200):**

```json
{
  "success": true,
  "data": [
    {
      "_id": "674a1b2c3d4e5f6789012345",
      "naturalLanguageQuery": "Find all users who signed up last month",
      "indexMapping": null,
      "result": {
        "esQuery": {},
        "explanation": "...",
        "performanceIssues": [],
        "optimizations": [],
        "mappingSuggestions": []
      },
      "durationMs": 42,
      "provider": "unknown",
      "userId": null,
      "createdAt": "2026-06-02T10:20:00.000Z",
      "updatedAt": "2026-06-02T10:20:00.000Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

Run **Analyze query** first, wait 1–2 seconds, then fetch history. History is saved asynchronously after the analyze response is sent.

---

### 5. Get history by ID


| Field  | Value                                   |
| ------ | --------------------------------------- |
| Method | `GET`                                   |
| URL    | `http://localhost:3000/api/history/:id` |


Replace `:id` with an `_id` from the history list response.

**Expected response (200):**

```json
{
  "success": true,
  "data": { ... }
}
```


| Status | Meaning                         |
| ------ | ------------------------------- |
| `200`  | Record found                    |
| `400`  | Invalid MongoDB ObjectId format |
| `404`  | Record not found                |


---

### 6. Usage stats


| Field  | Value                             |
| ------ | --------------------------------- |
| Method | `GET`                             |
| URL    | `http://localhost:3000/api/stats` |


**Expected response (200):**

```json
{
  "success": true,
  "data": {
    "totalQueries": 3,
    "avgDurationMs": 45.67,
    "providerBreakdown": {},
    "topQueries": [
      {
        "query": "Find all users who signed up last month",
        "createdAt": "2026-06-02T10:20:00.000Z"
      }
    ]
  }
}
```

---

### 7. Delete history record


| Field  | Value                                   |
| ------ | --------------------------------------- |
| Method | `DELETE`                                |
| URL    | `http://localhost:3000/api/history/:id` |


**Expected response (200):**

```json
{
  "success": true,
  "message": "Query history record deleted successfully"
}
```


| Status | Meaning           |
| ------ | ----------------- |
| `200`  | Deleted           |
| `400`  | Invalid ID format |
| `404`  | Record not found  |


---

## AI service endpoints (direct)

Test the FastAPI service directly at `http://localhost:8000` to isolate issues from the Express layer.

### AI health check


| Field  | Value                          |
| ------ | ------------------------------ |
| Method | `GET`                          |
| URL    | `http://localhost:8000/health` |


**Expected response (200):**

```json
{
  "status": "ok",
  "env": "development",
  "provider": "mock"
}
```

### AI analyze


| Field  | Value                                  |
| ------ | -------------------------------------- |
| Method | `POST`                                 |
| URL    | `http://localhost:8000/api/v1/analyze` |


**Request body (snake_case — FastAPI convention):**

```json
{
  "natural_language_query": "Class I insulin recalls in Texas during 2024",
  "index_name": "drug_enforcement"
}
```

**Expected response (200):** Same shape as the AI response, with snake_case field names (`es_query`, `performance_issues`, etc.).

---

## curl commands (Windows CMD)

On Windows CMD, use **single-line** commands. Do not use `\` for line breaks (that is bash syntax).

**Health:**

```cmd
curl http://localhost:3000/health
```

**Analyze:**

```cmd
curl -X POST http://localhost:3000/api/analyze -H "Content-Type: application/json" -d "{\"naturalLanguageQuery\": \"Class I insulin recalls in Texas during 2024\", \"indexName\": \"drug_enforcement\"}"
```

**History:**

```cmd
curl "http://localhost:3000/api/history?limit=10&page=1"
```

**Stats:**

```cmd
curl http://localhost:3000/api/stats
```

**Get by ID** (replace `YOUR_ID`):

```cmd
curl http://localhost:3000/api/history/YOUR_ID
```

**Delete** (replace `YOUR_ID`):

```cmd
curl -X DELETE http://localhost:3000/api/history/YOUR_ID
```

**Validation error:**

```cmd
curl -X POST http://localhost:3000/api/analyze -H "Content-Type: application/json" -d "{\"naturalLanguageQuery\": \"hi\"}"
```

---

## Verification checklist


| #   | Test                              | Expected                                     | Pass |
| --- | --------------------------------- | -------------------------------------------- | ---- |
| 1   | `GET /health`                     | `mongodb` and `aiService` both `"connected"` | ☐    |
| 2   | `POST /api/analyze`               | `200`, `success: true`, ES query in `data`   | ☐    |
| 3   | `GET /api/history`                | At least one record after analyze            | ☐    |
| 4   | `GET /api/history/:id`            | Single matching record                       | ☐    |
| 5   | `GET /api/stats`                  | `totalQueries` ≥ 1                           | ☐    |
| 6   | `POST /api/analyze` (short query) | `400` validation error                       | ☐    |
| 7   | `DELETE /api/history/:id`         | `200`, record removed                        | ☐    |
| 8   | AI service stopped → analyze      | `503` or `502`, API does not crash           | ☐    |


---

## Troubleshooting


| Symptom                             | Likely cause                   | Fix                                                                  |
| ----------------------------------- | ------------------------------ | -------------------------------------------------------------------- |
| `aiService: "disconnected"`         | AI service not running         | Start `python main.py` in `apps/ai-service`                          |
| `mongodb: "disconnected"`           | Wrong URI or Atlas IP blocked  | Check `MONGO_URI`, allow your IP in Atlas Network Access             |
| History empty after analyze         | Wrong DB/collection in Compass | Look at `queryhistories`, not `users`; check `test` vs `es_query_db` |
| History empty, API also empty       | Save failed silently           | Check Express terminal for `history.save.failed`                     |
| Always same mock response           | `LLM_PROVIDER=mock`            | Expected; switch to `gemini` etc. for real LLM output                |
| `curl: (3) Bad hostname` on Windows | Used `\` line breaks in CMD    | Use single-line curl commands                                        |
| Port already in use                 | Another process on 3000/8000   | Change `PORT` in `.env` or stop the other process                    |


---

## Related docs

- [API-Documentation.md](./API-Documentation.md) — endpoint reference
- [../../How to run.md](../../How to run.md) — service startup instructions

