import asyncio
import json
import time

import structlog
from anthropic import AsyncAnthropic
from google import genai as google_genai
from google.genai import types as google_genai_types
from openai import AsyncOpenAI

from core.config import get_settings
from schemas.analysis import AnalyzeRequest, AnalysisResult

log = structlog.get_logger()
settings = get_settings()
JSON_ONLY = (
    "You are an Elasticsearch query expert. You respond only with valid JSON. "
    "Never use markdown code fences. Never add explanation outside the JSON."
)

DRUG_FIELDS = (
    "Index name: drug_enforcement. Use only these fields: "
    "recall_number, event_id, status, classification, product_type, "
    "voluntary_mandated, recalling_firm, city, state, country, "
    "report_date, recall_initiation_date, product_description, "
    "reason_for_recall, code_info, distribution_pattern, product_quantity. "
    "Do not invent fields. "
    "classification is exactly Class I, Class II, or Class III. "
    "state is a two-letter code, never the full name: Texas is TX, Pennsylvania is PA, Illinois is IL. "
    "A place outside the United States, such as Mexico or Canada, goes in country, not state."
)

async def analyze(request: AnalyzeRequest) -> AnalysisResult:
    prompt = build_prompt(request)
    raw_response = await call_llm(prompt)
    return parse_response(raw_response)


def build_prompt(request: AnalyzeRequest) -> str:
    mapping = mapping_section(request)
    return f"""You are an Elasticsearch expert. Analyze the following natural language query.

{mapping}

Natural language query: "{request.natural_language_query}"

You MUST respond with a single valid JSON object. No markdown. No backticks. No explanation outside the JSON.

The JSON must follow this exact schema.
es_query is the body of an Elasticsearch _search request. It must contain a query key.
Use filter for classification, state, and dates. Dates are yyyy-MM-dd.
{{
  "es_query": {{
    "size": 20,
    "query": {{
      "bool": {{
        "filter": []
      }}
    }}
  }},
  "explanation": "plain English explanation of how the query works",
  "performance_issues": [
    {{
      "severity": "error" | "warn" | "info",
      "title": "short title",
      "description": "detailed explanation"
    }}
  ],
  "optimizations": [
    {{
      "title": "short title",
      "impact": "high" | "medium" | "low",
      "description": "what this optimization does",
      "optimized_query": {{...}} or null
    }}
  ],
  "mapping_suggestions": [
    {{
      "field": "field_name",
      "current_type": "text" or null,
      "suggested_type": "keyword",
      "reason": "why this change improves performance"
    }}
  ]
}}"""


def mapping_section(request: AnalyzeRequest) -> str:
    if request.index_mapping:
        return f"Index Mapping provided:\n{json.dumps(request.index_mapping, indent=2)}"
    return DRUG_FIELDS


async def call_llm(prompt: str) -> str:
    provider = settings.llm_provider
    if provider == "anthropic":
        return await call_anthropic(prompt)
    if provider == "openai":
        return await call_openai(prompt)
    if provider == "gemini":
        return await call_gemini(prompt)
    if provider == "mock":
        return mock_response()
    raise ValueError(f"Unknown LLM provider: {provider}")


def create_client():
    if settings.llm_provider == "anthropic":
        return AsyncAnthropic(api_key=settings.anthropic_api_key)
    if settings.llm_provider == "openai":
        return AsyncOpenAI(api_key=settings.openai_api_key)
    if settings.llm_provider == "gemini":
        return google_genai.Client(
            api_key=settings.gemini_api_key,
            http_options=google_genai_types.HttpOptions(timeout=90_000),
        )
    return None


client = create_client()


async def call_anthropic(prompt: str) -> str:
    response = await client.messages.create(
        model=settings.llm_model,
        max_tokens=settings.llm_max_tokens,
        system=JSON_ONLY,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text


async def call_openai(prompt: str) -> str:
    response = await client.chat.completions.create(
        model=settings.llm_model,
        max_tokens=settings.llm_max_tokens,
        temperature=settings.llm_temperature,
        messages=[
            {"role": "system", "content": JSON_ONLY},
            {"role": "user", "content": prompt},
        ],
    )
    return response.choices[0].message.content


async def call_gemini(prompt: str) -> str:
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(None, lambda: ask_gemini(prompt))
    return response.text or ""


def ask_gemini(prompt: str):
    last_error = None
    for attempt in range(3):
        try:
            return client.models.generate_content(
                model=settings.llm_model,
                contents=prompt,
                config={
                    "system_instruction": JSON_ONLY,
                    "temperature": settings.llm_temperature,
                    "max_output_tokens": settings.llm_max_tokens,
                    "response_mime_type": "application/json",
                },
            )
        except Exception as error:
            last_error = error
            if not is_busy(error) or attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))
    raise last_error


def is_busy(error):
    text = str(error)
    return "503" in text or "UNAVAILABLE" in text or "high demand" in text


def mock_response() -> str:
    return json.dumps({
        "es_query": {
            "query": {
                "bool": {
                    "filter": [
                        {"term": {"classification": "Class I"}},
                        {"term": {"state": "TX"}},
                    ],
                    "must": [
                        {"match": {"product_description": "insulin"}},
                    ],
                }
            }
        },
        "explanation": "Class I insulin recalls in Texas, using only drug_enforcement fields.",
        "performance_issues": [
            {
                "severity": "info",
                "title": "Filter on keyword fields",
                "description": "classification and state are keywords, so term filters are the right match.",
            }
        ],
        "optimizations": [
            {
                "title": "Use filter context",
                "impact": "high",
                "description": "Queries in filter context skip scoring — faster and cacheable.",
                "optimized_query": None,
            }
        ],
        "mapping_suggestions": [
            {
                "field": "classification",
                "current_type": "keyword",
                "suggested_type": "keyword",
                "reason": "classification is already a keyword, so a term filter does not need a mapping change.",
            }
        ],
    })


def parse_response(raw: str) -> AnalysisResult:
    try:
        data = json.loads(strip_markdown(raw))
        return AnalysisResult(**data)
    except json.JSONDecodeError as error:
        log.error("parse.json_failed", error=str(error), raw=raw[:200])
        raise ValueError(f"LLM response was not valid JSON: {error}")
    except Exception as error:
        log.error("parse.validation_failed", error=str(error))
        raise ValueError(f"LLM response did not match expected schema: {error}")


def strip_markdown(raw: str) -> str:
    cleaned = raw.strip()
    if not cleaned.startswith("```"):
        return cleaned
    cleaned = cleaned.split("```")[1]
    if cleaned.startswith("json"):
        cleaned = cleaned[4:]
    return cleaned
