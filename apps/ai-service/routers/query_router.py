import structlog
from fastapi import APIRouter, HTTPException

from core.config import get_settings
from schemas.analysis import AnalyzeRequest, AnalysisResult
from services.query_analyzer import analyze

log = structlog.get_logger()
router = APIRouter(tags=["Query Analysis"])


@router.post(
    "/analyze",
    response_model=AnalysisResult,
    summary="Turn a question into a drug_enforcement query",
)
async def analyze_query(request: AnalyzeRequest) -> AnalysisResult:
    log.info("analyze.request.received", query=request.natural_language_query[:80])
    try:
        result = await analyze(request)
        return result.model_copy(update={"provider": get_settings().llm_provider})
    except ValueError as error:
        log.error("analyze.request.parse_failed", error=str(error))
        raise HTTPException(status_code=502, detail="AI service returned an unexpected response.")
    except Exception as error:
        log.error("analyze.request.failed", error=str(error))
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")
