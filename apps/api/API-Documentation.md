# Express API Documentation

Base URL: `http://localhost:3000`

---

## Overview

The Express API service provides endpoints for analyzing natural language queries and retrieving query history. It connects to MongoDB for data persistence and communicates with the AI Service (FastAPI) for query analysis.

---

## Endpoints

### 1. Health Check

**GET** `/health`

Checks the health of the API and its dependent services (MongoDB, AI Service).

#### Response

```json
{
  "status": "ok" | "degraded",
  "timestamp": "2026-05-05T08:00:54.183Z",
  "env": "development",
  "services": {
    "mongodb": "connected" | "disconnected",
    "aiService": "connected" | "disconnected"
  }
}
```

#### Status Codes

- `200` - All services healthy
- `503` - One or more services are down

#### Auth

None required

---

### 2. Analyze Query

**POST** `/api/analyze`

Analyzes a natural language query and returns an Elasticsearch DSL query with explanations, identified issues, and optimization suggestions.

#### Request Body

```json
{
  "naturalLanguageQuery": "string (required)",
  "indexMapping": "object (optional)",
  "indexName": "string (optional)"
}
```

**Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `naturalLanguageQuery` | string | Yes | The user's query in plain English |
| `indexMapping` | object | No | ES index mapping for deeper analysis |
| `indexName` | string | No | Name of the ES index being queried |

**Validation:** Request body is validated using Zod schema (`analyzeSchema`)

#### Response

```json
{
  "success": true,
  "data": {
    "esQuery": "object (Elasticsearch DSL query)",
    "explanation": "string (human-readable explanation)",
    "issues": ["array of identified issues"],
    "optimizations": ["array of optimization suggestions"]
  }
}
```

#### Status Codes

- `200` - Analysis successful
- `400` - Validation error (invalid request body)
- `500` - Server error or AI service unavailable

#### Example

**Request:**
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "naturalLanguageQuery": "Find all users who signed up last month",
    "indexName": "users"
  }'
```

---

### 3. Query History

**GET** `/api/history`

Returns recent query history from MongoDB with pagination support.

#### Query Parameters

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `limit` | number | 20 | 100 | Number of records to return |
| `page` | number | 1 | - | Page number for pagination |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "_id": "string",
      "naturalLanguageQuery": "string",
      "indexName": "string",
      "result": "object",
      "createdAt": "2026-05-05T08:00:54.183Z",
      "updatedAt": "2026-05-05T08:00:54.183Z"
    }
  ],
  "pagination": {
    "total": "number",
    "page": "number",
    "limit": "number",
    "totalPages": "number"
  }
}
```

#### Status Codes

- `200` - Successfully retrieved history
- `500` - Server error

#### Example

**Request:**
```bash
curl "http://localhost:3000/api/history?limit=10&page=1"
```

---

## Middleware

### CORS Configuration

- **Development:** Allows origins `http://localhost:3000` and `http://localhost:8000`
- **Production:** Uses `ALLOWED_ORIGINS` environment variable (comma-separated list)

### Request Logging

All incoming requests are logged using the custom `requestLogger` middleware.

### Error Handling

- **Global Error Handler:** Catches all errors and returns standardized error responses
- **404 Handler:** Returns a standardized "Not Found" response for unmatched routes

### Validation

Request validation is performed using Zod schemas via the `validate` middleware.

---

## Environment Variables

The API service uses the following environment variables (configured in `.env`):

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Port the server runs on | 3000 |
| `NODE_ENV` | Environment (development/production) | development |
| `AI_SERVICE_URL` | URL of the AI Service | http://localhost:8000 |
| `MONGO_URI` | MongoDB connection string | - |
| `ALLOWED_ORIGINS` | CORS allowed origins (production) | - |

---

## Dependencies

- **Express** - Web framework
- **Mongoose** - MongoDB ODM
- **CORS** - Cross-Origin Resource Sharing middleware
- **Zod** - Schema validation
- **Axios** - HTTP client for AI service communication
- **Nodemon** - Development auto-restart tool

---

## Running the Service

```bash
cd apps/api
npm install
npm run dev
```

Server runs at `http://localhost:3000`

---

## Project Structure

```
apps/api/
├── src/
│   ├── app.js                    # Express app setup
│   ├── server.js                 # Server startup
│   ├── config/
│   │   └── index.js              # Configuration
│   ├── middleware/
│   │   ├── error.middleware.js   # Global error handler
│   │   ├── logger.middleware.js  # Request logging
│   │   └── validate.middleware.js # Request validation
│   ├── models/
│   │   └── query.model.js        # MongoDB schema
│   ├── routes/
│   │   └── query.route.js        # API routes
│   ├── services/
│   │   └── query.service.js      # Business logic
│   └── types/
│       └── analysis.schema.js    # Zod schemas
├── package.json
└── .env
```

---

## Notes

- The API communicates with the AI Service (FastAPI) running on `http://localhost:8000`
- Query history is stored in MongoDB
- All timestamps are in ISO 8601 format
- The API uses Mongoose's `.lean()` for faster query history retrieval
- Pagination is zero-based internally but presented as one-based to the user
