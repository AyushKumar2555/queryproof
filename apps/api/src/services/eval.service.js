const axios = require('axios')
const config = require('../config')
const EvalCase = require('../models/eval-case.model')
const EvalRun = require('../models/eval-run.model')

async function scoreActiveCases() {
  const cases = await loadActiveCases()
  const results = []
  for (const row of cases) {
    results.push(await scoreOneCase(row))
  }
  return results
}

function loadActiveCases() {
  return EvalCase.find({ active: true, indexName: 'drug_enforcement' })
    .select('question indexName expected')
    .lean()
}

async function scoreOneCase(row) {
  const startedAt = Date.now()
  const generated = await askForQuery(row.question)
  const score = scoreQuery(generated.esQuery, row.expected || {})
  const run = await saveRun(row, generated, score, Date.now() - startedAt)
  return { id: run._id, question: row.question, ...score }
}

async function saveRun(row, generated, score, durationMs) {
  return EvalRun.create({
    evalCaseId: row._id,
    question: row.question,
    indexName: row.indexName,
    passed: score.passed,
    total: score.total,
    checks: score.checks,
    esQuery: generated.esQuery,
    provider: generated.provider,
    durationMs,
  })
}

// Query only. Analyze would also search Elasticsearch and save history.
async function askForQuery(question) {
  try {
    const response = await axios.post(
      `${config.aiServiceUrl}/api/v1/analyze`,
      {
        natural_language_query: question,
        index_mapping: null,
        index_name: 'drug_enforcement',
      },
      { timeout: 30000 }
    )
    return {
      esQuery: response.data.es_query,
      provider: response.data.provider || 'unknown',
    }
  } catch (err) {
    throw asHttpError(err, 'AI service')
  }
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

function checkField(esQuery, name, expectedValue) {
  if (expectedValue == null || String(expectedValue).trim() === '') return null

  const field = name === 'recallingFirm' ? 'recalling_firm' : name
  const wanted = String(expectedValue).trim().toLowerCase()
  const found = findValues(esQuery, field).flatMap(readText)

  return {
    name,
    passed: found.some((value) => value.toLowerCase() === wanted),
  }
}

function checkDates(esQuery, expected) {
  const ranges = [
    ...findValues(esQuery, 'report_date'),
    ...findValues(esQuery, 'recall_initiation_date'),
  ]
  const checks = []

  if (expected.dateFrom) {
    checks.push({
      name: 'dateFrom',
      passed: ranges.some((range) => hasBound(range, 'gte', expected.dateFrom) || hasBound(range, 'gt', expected.dateFrom)),
    })
  }

  if (expected.dateTo) {
    checks.push({
      name: 'dateTo',
      passed: ranges.some((range) => hasBound(range, 'lte', expected.dateTo) || hasBound(range, 'lt', expected.dateTo)),
    })
  }

  return checks
}

function checkText(esQuery, words) {
  if (!Array.isArray(words) || words.length === 0) return null

  const haystack = findValues(esQuery, 'product_description').flatMap(readText).join(' ').toLowerCase()

  return {
    name: 'textMustContain',
    passed: words.every((word) => haystack.includes(String(word).trim().toLowerCase())),
  }
}

function findValues(node, field) {
  if (!node || typeof node !== 'object') return []

  const found = []
  for (const [key, value] of Object.entries(node)) {
    if (key === field) found.push(value)
    found.push(...findValues(value, field))
  }
  return found
}

function readText(value) {
  if (value == null) return []
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return [String(value)]
  if (Array.isArray(value)) return value.flatMap(readText)
  if (value.value != null) return readText(value.value)
  if (value.query != null) return readText(value.query)
  return []
}

function hasBound(range, key, expected) {
  if (!range || typeof range !== 'object' || range[key] == null) return false
  return String(range[key]).trim() === String(expected).trim()
}

function scoreQuery(esQuery, expected = {}) {
  const checks = [
    checkField(esQuery, 'classification', expected.classification),
    checkField(esQuery, 'state', expected.state),
    checkField(esQuery, 'recallingFirm', expected.recallingFirm),
    ...checkDates(esQuery, expected),
    checkText(esQuery, expected.textMustContain),
  ].filter(Boolean)

  return {
    passed: checks.filter((check) => check.passed).length,
    total: checks.length,
    checks,
  }
}

async function createEvalCase(input) {
  const existing = await findEvalCase(input.question, input.indexName)
  if (existing) throw conflict('Eval case already exists')
  return EvalCase.create({
    question: input.question,
    indexName: input.indexName,
    expected: input.expected,
    active: input.active,
  })
}

function findEvalCase(question, indexName) {
  return EvalCase.findOne({ question, indexName })
}

function conflict(message) {
  const error = new Error(message)
  error.status = 409
  return error
}

module.exports = { scoreQuery, scoreActiveCases, createEvalCase }
