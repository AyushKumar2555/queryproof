from pydantic import BaseModel, Field
from typing import Any
from enum import Enum


# inheriting from both str and Enum makes values serialize as "warn" not 2 in JSON
# without str, your frontend receives integers instead of readable strings
class IssueSeverity(str, Enum):
    ERROR = "error"
    WARN  = "warn"
    INFO  = "info"


class PerformanceIssue(BaseModel):
    severity:    IssueSeverity
    title:       str
    description: str


class OptimizationImpact(str, Enum):
    HIGH   = "high"
    MEDIUM = "medium"
    LOW    = "low"


class Optimization(BaseModel):
    title:       str
    impact:      OptimizationImpact
    description: str
    # not every optimization has a rewritten query — None means it's safe to omit
    optimized_query: dict[str, Any] | None = None


class MappingSuggestion(BaseModel):
    field:          str
    # current_type is optional — user may not have provided a mapping at all
    current_type:   str | None = None
    suggested_type: str
    reason:         str


class AnalyzeRequest(BaseModel):
    # ... means required — FastAPI returns 422 automatically if this is missing
    # min_length=5 rejects nonsense inputs like "?" or "hi" before hitting the LLM
    natural_language_query: str = Field(..., min_length=5, max_length=2000)

    # optional — when present, the prompt includes this mapping instead of the field list
    index_mapping: dict[str, Any] | None = Field(default=None)
    # this service only queries the drug enforcement index
    index_name:    str = Field(default="drug_enforcement", max_length=200)


class AnalysisResult(BaseModel):
    # no default = required — the LLM must always return a valid ES query dict
    # if it doesn't, Pydantic raises a validation error before this reaches the router
    es_query:            dict[str, Any]
    explanation:         str
    # set by the API after the LLM responds — the model is not asked to invent this
    provider:            str = "unknown"

    # these are lists because there can be zero or many — empty list is valid
    performance_issues:  list[PerformanceIssue]
    optimizations:       list[Optimization]
    mapping_suggestions: list[MappingSuggestion]