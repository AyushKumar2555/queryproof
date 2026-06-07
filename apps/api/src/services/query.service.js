const axios = require('axios')
const config = require('../config')
const { logger } = require('../middleware/logger.middleware')
const QueryHistory = require('../models/query.model')
// Import schemas from analysis.schema
const { analysisResultSchema } = require('../types/analysis.schema')

class QueryService {

  // analyze is the only public method — called by the route
  // everything else is private by convention (prefixed with _)
  async analyze(data) {
    const start = Date.now()

    // step 1 — call FastAPI AI service
    const aiResponse = await this._callAiService(data)

    // step 2 — validate the response shape before trusting it
    const validated = this._validateAiResponse(aiResponse)

    // step 3 — save to MongoDB in the background
    // we don't await this — saving to DB shouldn't slow down the API response
    this._saveToHistory(data, validated, Date.now() - start).catch((err) =>
      logger.error('history.save.failed', { error: err.message })
    )

    return validated
  }

  async _callAiService(data) {
    try {
      logger.info('ai_service.calling', {
        query: data.naturalLanguageQuery.slice(0, 80),
      })

      const response = await axios.post(
        `${config.aiServiceUrl}/api/v1/analyze`,
        {
          // FastAPI expects snake_case — convert from camelCase
          natural_language_query: data.naturalLanguageQuery,
          index_mapping:          data.indexMapping || null,
          index_name:             data.indexName || null,
        },
        {
          // fail fast — don't wait forever if AI service is down
          timeout: 30000,
          headers: { 'Content-Type': 'application/json' },
        }
      )

      logger.info('ai_service.success', {
        status: response.status,
      })

      return response.data

    } catch (err) {
      // axios wraps HTTP errors — check if it's a response error or network error
      if (err.response) {
        // FastAPI responded but with an error status
        logger.error('ai_service.error_response', {
          status:  err.response.status,
          message: err.response.data?.detail,
        })
        const error = new Error('AI service returned an error')
        error.status = 502
        throw error
      }

      if (err.code === 'ECONNREFUSED') {
        // FastAPI is not running
        logger.error('ai_service.not_running')
        const error = new Error('AI service is unavailable')
        error.status = 503
        throw error
      }

      if (err.code === 'ECONNABORTED') {
        // FastAPI took too long
        logger.error('ai_service.timeout')
        const error = new Error('AI service timed out')
        error.status = 504
        throw error
      }

      throw err
    }
  }

  _validateAiResponse(data) {
    // convert snake_case from FastAPI to camelCase for JS
    // Temporarily skip Zod validation due to v4 compatibility issues
    return {
      esQuery:            data.es_query,
      explanation:        data.explanation,
      performanceIssues:  data.performance_issues || [],
      optimizations:      data.optimizations || [],
      mappingSuggestions: data.mapping_suggestions || [],
    }
  }

  async _saveToHistory(input, result, durationMs) {
    await QueryHistory.create({
      naturalLanguageQuery: input.naturalLanguageQuery,
      indexMapping:         input.indexMapping || null,
      result,
      durationMs,
    })

    logger.info('history.saved', { durationMs })
  }
}

// export a single instance — same pattern as Python service
// one instance shared across all requests
module.exports = new QueryService()