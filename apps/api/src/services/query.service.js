const axios = require('axios')
const config = require('../config')
const { logger } = require('../middleware/logger.middleware')
const QueryHistory = require('../models/query.model')

// 1. Ask the AI for an Elasticsearch query.
// 2. Run that query on the drug_enforcement index.
// 3. Save the run and return the query plus the hits.
async function analyze(data) {
  const startedAt = Date.now()

  const aiData = await askAi(data)
  const result = renameAiFields(aiData)
  result.hits = await searchDrugEnforcement(result.esQuery)

  saveHistory(data, result, Date.now() - startedAt)
  return result
}

// FastAPI expects snake_case names.
async function askAi(data) {
  try {
    const response = await axios.post(
      `${config.aiServiceUrl}/api/v1/analyze`,
      {
        natural_language_query: data.naturalLanguageQuery,
        index_mapping: data.indexMapping || null,
        index_name: 'drug_enforcement',
      },
      { timeout: 30000 }
    )
    return response.data
  } catch (err) {
    throw asHttpError(err, 'AI service')
  }
}

// FastAPI sends es_query. This API returns esQuery.
function renameAiFields(data) {
  return {
    esQuery: data.es_query,
    explanation: data.explanation,
    performanceIssues: data.performance_issues || [],
    optimizations: data.optimizations || [],
    mappingSuggestions: data.mapping_suggestions || [],
    provider: data.provider || 'unknown',
  }
}

async function searchDrugEnforcement(esQuery) {
  try {
    const response = await axios.post(
      `${config.elasticsearchUrl}/drug_enforcement/_search`,
      esQuery,
      { timeout: 10000 }
    )
    return response.data.hits?.hits || []
  } catch (err) {
    throw asHttpError(err, 'Elasticsearch')
  }
}

// Save in the background. A database error should not hide the search result.
function saveHistory(input, result, durationMs) {
  const provider = result.provider
  const storedResult = { ...result }
  delete storedResult.provider

  QueryHistory.create({
    naturalLanguageQuery: input.naturalLanguageQuery,
    indexName: 'drug_enforcement',
    indexMapping: input.indexMapping || null,
    provider,
    result: storedResult,
    durationMs,
  }).catch((err) => {
    logger.error('history.save.failed', { error: err.message })
  })
}

function asHttpError(err, serviceName) {
  if (err.code === 'ECONNREFUSED') {
    const error = new Error(`${serviceName} is not running`)
    error.status = 503
    return error
  }
  if (err.code === 'ECONNABORTED') {
    const error = new Error(`${serviceName} took too long`)
    error.status = 504
    return error
  }
  if (err.response) {
    const error = new Error(`${serviceName} returned an error`)
    error.status = 502
    return error
  }
  return err
}

module.exports = { analyze }
