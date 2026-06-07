# FastAPI & Technologies Learning Guide

> A comprehensive guide to understanding the tech stack used in the AI-Service microservice.

---

## 📚 Table of Contents
1. [FastAPI Fundamentals](#1-fastapi-fundamentals)
2. [Pydantic & Data Validation](#2-pydantic--data-validation)
3. [Pydantic Settings & Configuration](#3-pydantic-settings--configuration)
4. [Uvicorn ASGI Server](#4-uvicorn-asgi-server)
5. [Async/Await in Python](#5-asyncawait-in-python)
6. [Structured Logging with Structlog](#6-structured-logging-with-structlog)
7. [CORS Middleware](#7-cors-middleware)
8. [Lifespan Events](#8-lifespan-events)
9. [LLM SDKs (Anthropic, OpenAI, Gemini)](#9-llm-sdks)
10. [Testing with Pytest](#10-testing-with-pytest)
11. [Additional Libraries](#11-additional-libraries)
12. [Learning Roadmap](#12-learning-roadmap)

---

## 1. FastAPI Fundamentals

### What is FastAPI?
FastAPI is a modern, fast (high-performance) web framework for building APIs with Python 3.8+ based on standard Python type hints.

### Key Features Used in This Project

#### **FastAPI App Creation**
```python
app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    docs_url="/docs" if settings.debug else None,  # Swagger UI
    lifespan=lifespan,  # Startup/shutdown events
)
```

#### **Path Parameters & Routing**
```python
from fastapi import APIRouter

router = APIRouter(tags=["Query Analysis"])
app.include_router(router, prefix="/api/v1")

@router.post("/analyze", response_model=AnalysisResult)
async def analyze_query(request: AnalyzeRequest) -> AnalysisResult:
    # Your logic here
```

#### **Automatic Validation**
FastAPI automatically validates requests against Pydantic models and returns 422 errors for invalid data.

### 📖 Learn More
- **Official Docs**: https://fastapi.tiangolo.com/
- **Key Concepts**: Path operations, dependency injection, request validation
- **Try It**: Run `uvicorn main:app --reload` and visit `http://localhost:8000/docs`

---

## 2. Pydantic & Data Validation

### What is Pydantic?
Pydantic is a data validation library that uses Python type hints to validate data and automatically convert types.

### Usage in This Project

#### **Request/Response Models**
```python
from pydantic import BaseModel, Field
from typing import Any
from enum import Enum

class IssueSeverity(str, Enum):
    ERROR = "error"
    WARN = "warn"
    INFO = "info"

class PerformanceIssue(BaseModel):
    severity: IssueSeverity
    title: str
    description: str

class AnalyzeRequest(BaseModel):
    natural_language_query: str = Field(..., min_length=5, max_length=2000)
    index_mapping: dict[str, Any] | None = Field(default=None)
```

#### **Why It's Powerful**
- **Automatic validation**: If `natural_language_query` is too short, FastAPI returns 422
- **Type conversion**: Strings are converted to the right types automatically
- **IDE support**: Full autocomplete and type checking
- **Serialization**: `.model_dump()` converts to dict, `.model_dump_json()` to JSON

### 📖 Learn More
- **Official Docs**: https://docs.pydantic.dev/
- **Key Concepts**: BaseModel, Field validators, ConfigDict, TypeAdapter

---

## 3. Pydantic Settings & Configuration

### What is Pydantic Settings?
An extension of Pydantic that reads configuration from environment variables and `.env` files.

### Usage in This Project

```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    app_name: str = "ES Query Intelligence - AI Service"
    llm_provider: str = "gemini"
    llm_temperature: float = 0.1
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,  # LLM_PROVIDER = llm_provider
    )

@lru_cache()  # Cache the settings object - only reads from disk once
def get_settings() -> Settings:
    return Settings()
```

### Why `@lru_cache()`?
- Without it: Every `get_settings()` call reads from disk
- With it: Settings are loaded once and cached in memory
- Result: Faster, consistent config across the app

### 📖 Learn More
- **Official Docs**: https://docs.pydantic.dev/latest/concepts/pydantic_settings/

---

## 4. Uvicorn ASGI Server

### What is Uvicorn?
Uvicorn is a lightning-fast ASGI (Asynchronous Server Gateway Interface) server for Python.

### Usage in This Project

```python
if __name__ == "__main__":
    uvicorn.run(
        "main:app",           # module:app_object
        host=settings.host,   # "0.0.0.0" (accessible from outside)
        port=settings.port,   # 8000
        reload=settings.debug,  # Auto-reload on code changes (dev only)
    )
```

### ASGI vs WSGI
- **WSGI** (e.g., Gunicorn, mod_wsgi): Synchronous, one request per thread
- **ASGI** (e.g., Uvicorn, Daphne): Asynchronous, handles multiple requests concurrently

### 📖 Learn More
- **Official Docs**: https://www.uvicorn.org/
- **Run in Terminal**: `uvicorn main:app --reload --host 0.0.0.0 --port 8000`

---

## 5. Async/Await in Python

### What is Async/Await?
Python's way of handling concurrent operations without blocking the event loop.

### Usage in This Project

```python
async def analyze(self, request: AnalyzeRequest) -> AnalysisResult:
    prompt = self._build_prompt(request)          # Sync - builds quickly
    raw_response = await self._call_llm(prompt)   # Async - waits for LLM API
    return self._parse_response(raw_response)      # Sync - parses quickly

async def _call_anthropic(self, prompt: str) -> str:
    response = await self._client.messages.create(...)  # Non-blocking API call
    return response.content[0].text
```

### Why Async Matters Here
- **Without async**: One slow LLM call (2-3 seconds) blocks ALL other requests
- **With async**: While waiting for LLM, the server can handle other requests
- **Event loop**: Manages multiple coroutines concurrently (like Node.js)

### Gemini Special Case
```python
# Gemini SDK is not fully async, so we run it in a thread pool
loop = asyncio.get_event_loop()
response = await loop.run_in_executor(
    None,  # Use default executor (thread pool)
    lambda: self._client.generate_content(prompt)
)
```

### 📖 Learn More
- **RealPython Guide**: https://realpython.com/async-io-python/
- **Key Concepts**: Event loop, coroutines, await, run_in_executor

---

## 6. Structured Logging with Structlog

### What is Structlog?
A library for structured logging (key-value pairs) instead of plain text logs.

### Usage in This Project

```python
import structlog
log = structlog.get_logger()

# Bad: log.info("User query: " + query)
# Good: Structured key-value logging
log.info(
    "analyze.request.received",
    query=request.natural_language_query[:80],  # Truncate sensitive data
    has_mapping=request.index_mapping is not None,
)
```

### Why Structured Logging?
- **Searchable**: `grep "analyze.request.received"` in logs
- **Machine-readable**: Can be parsed by log aggregation tools (ELK, Splunk)
- **Contextual**: Each log has relevant metadata

### 📖 Learn More
- **Official Docs**: https://www.structlog.org/
- **Output Example**: `{"event": "analyze.request.received", "query": "Find companies...", "has_mapping": true}`

---

## 7. CORS Middleware

### What is CORS?
Cross-Origin Resource Sharing - a security feature that controls which domains can call your API.

### Usage in This Project

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Only allow NestJS frontend
    allow_methods=["POST", "GET"],             # Only allow these HTTP methods
    allow_headers=["*"],                       # Allow all headers
)
```

### Why It's Needed
- **Browser Security**: Browsers block requests from different origins (domains)
- **Development**: Your frontend (localhost:3000) calls backend (localhost:8000)
- **Production**: Replace with your actual domain, never use `["*"]` in prod

### 📖 Learn More
- **MDN Docs**: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
- **FastAPI Guide**: https://fastapi.tiangolo.com/tutorial/cors/

---

## 8. Lifespan Events

### What are Lifespan Events?
Code that runs on startup (before app accepts requests) and shutdown (when app stops).

### Usage in This Project

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP CODE - runs once when app starts
    log.info("service.startup", env=settings.app_env, provider=settings.llm_provider)
    # Could initialize DB connections, warm up LLM client, etc.
    
    yield  # App runs here
    
    # SHUTDOWN CODE - runs once when app stops
    log.info("service.shutdown")
    # Could close DB connections, cleanup resources

app = FastAPI(lifespan=lifespan)
```

### Why Not `@app.on_event("startup")`?
- **Deprecated**: The old `@app.on_event` is deprecated in FastAPI
- **Better**: Lifespan uses modern Python context managers
- **Cleaner**: Startup and shutdown in one function

### 📖 Learn More
- **FastAPI Docs**: https://fastapi.tiangolo.com/advanced/events/

---

## 9. LLM SDKs (Anthropic, OpenAI, Gemini)

### Overview
The project supports three LLM providers, selected via `llm_provider` config.

### Common Pattern
```python
# Anthropic
from anthropic import AsyncAnthropic
client = AsyncAnthropic(api_key="...")
response = await client.messages.create(
    model="claude-3-5-sonnet-20241022",
    messages=[{"role": "user", "content": prompt}]
)

# OpenAI
from openai import AsyncOpenAI
client = AsyncOpenAI(api_key="...")
response = await client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": prompt}]
)

# Gemini
import google.generativeai as genai
genai.configure(api_key="...")
model = genai.GenerativeModel("gemini-1.5-flash")
response = model.generate_content(prompt)
```

### 📖 Learn More
- **Anthropic**: https://docs.anthropic.com/en/docs/
- **OpenAI**: https://platform.openai.com/docs/
- **Gemini**: https://ai.google.dev/docs/

---

## 10. Testing with Pytest

### What is Pytest?
A mature testing framework for Python, simpler than unittest.

### Usage in This Project

```python
import pytest
from services.query_analyzer import QueryAnalyzerService

@pytest.fixture
def service():
    return QueryAnalyzerService()

def test_prompt_contains_user_query(service, basic_request):
    prompt = service._build_prompt(basic_request)
    assert basic_request.natural_language_query in prompt
```

### Key Features Used
- **Fixtures**: Reusable test setup (`@pytest.fixture`)
- **Auto asyncio**: `pytest.ini` has `asyncio_mode = auto` for async tests
- **Assertions**: Simple `assert` statements (no `self.assertEqual()`)

### 📖 Learn More
- **Official Docs**: https://docs.pytest.org/
- **Run Tests**: `pytest apps/ai-service/tests/ -v`

---

## 11. Additional Libraries

### Tenacity (Retry Logic)
```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
async def call_llm_with_retry(prompt):
    # Automatically retries on failure with exponential backoff
    return await call_llm(prompt)
```
- **Use Case**: LLM API calls can fail (rate limits, timeouts)
- **Learn**: https://tenacity.readthedocs.io/

### HTTPX (HTTP Client)
- Modern replacement for `requests` with async support
- Used if this service needs to call other APIs
- **Learn**: https://www.python-httpx.org/

### Python-dotenv
- Loads `.env` files into environment variables
- Pydantic Settings uses it automatically via `env_file=".env"`
- **Learn**: https://github.com/theskumar/python-dotenv

---

## 12. Learning Roadmap

### 🎯 Beginner Path (Start Here)
1. **Python Type Hints**: Learn `str`, `int`, `dict[str, Any]`, `Optional`
2. **FastAPI Basics**: Path operations, request/response models
3. **Pydantic**: BaseModel, Field, validation
4. **Run the App**: `uvicorn main:app --reload`

### 🚀 Intermediate Path
5. **Async/Await**: Understand event loops, `await`, non-blocking code
6. **Dependency Injection**: FastAPI's `Depends()`
7. **Testing**: Write pytest tests, use fixtures
8. **Error Handling**: HTTPException, custom error handlers

### 🏆 Advanced Path
9. **Middleware**: CORS, custom middleware, request lifecycle
10. **Lifespan Events**: Startup/shutdown, resource management
11. **LLM Integration**: API clients, prompt engineering, response parsing
12. **Production**: Docker, environment variables, logging, monitoring

### 📚 Recommended Resources
| Topic | Resource | Time |
|-------|----------|------|
| FastAPI | Official Tutorial | 2-3 hours |
| Pydantic | Official Docs | 1 hour |
| Async Python | RealPython Guide | 2 hours |
| pytest | Official Docs | 1 hour |
| Structlog | Official Docs | 30 mins |

### 💡 Hands-On Exercises
1. **Modify the prompt**: Change `_build_prompt()` to add more instructions
2. **Add a new endpoint**: Create `GET /api/v1/models` that returns the LLM model name
3. **Add a new field**: Add `confidence_score: float` to `AnalysisResult`
4. **Write a test**: Test that the mock response parses correctly
5. **Switch providers**: Change `llm_provider` to "mock" and test without API keys

---

## 🔗 Quick Reference Links

| Technology | Documentation | Cheat Sheet |
|------------|--------------|-------------|
| FastAPI | https://fastapi.tiangolo.com/ | https://fastapi.tiangolo.com/cheatsheet/ |
| Pydantic | https://docs.pydantic.dev/ | https://docs.pydantic.dev/latest/concepts/validators/ |
| Pytest | https://docs.pytest.org/ | https://docs.pytest.org/en/stable/how-to/cheatsheet.html |
| Python Async | https://docs.python.org/3/library/asyncio.html | https://realpython.com/async-io-python/ |
| Structlog | https://www.structlog.org/ | - |

---

**Happy Learning! 🚀**

*Tip: Start by running the app (`uvicorn main:app --reload`) and exploring the Swagger docs at `http://localhost:8000/docs`*