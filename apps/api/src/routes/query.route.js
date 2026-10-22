const express = require('express')
const { validate } = require('../middleware/validate.middleware')
const { analyzeSchema } = require('../types/analysis.schema')
const queryService = require('../services/query.service')
const QueryHistory = require('../models/query.model')

const router = express.Router()

router.post('/analyze', validate(analyzeSchema), sendAnalysis)
router.get('/history', sendHistory)
router.get('/history/:id', sendOneHistory)
router.delete('/history/:id', deleteHistory)
router.get('/stats', sendStats)

async function sendAnalysis(req, res, next) {
  try {
    const result = await queryService.analyze(req.validated)
    res.status(200).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

async function sendHistory(req, res, next) {
  try {
    const page = readPage(req)
    const { records, total } = await loadHistory(page)
    res.status(200).json({
      success: true,
      data: records,
      pagination: {
        total,
        page: page.page,
        limit: page.limit,
        totalPages: Math.ceil(total / page.limit),
      },
    })
  } catch (err) {
    next(err)
  }
}

async function sendOneHistory(req, res, next) {
  try {
    const record = await findHistory(req.params.id)
    if (!record) return next(httpError(404, 'Query history record not found'))
    res.status(200).json({ success: true, data: record })
  } catch (err) {
    next(asIdError(err))
  }
}

async function deleteHistory(req, res, next) {
  try {
    const deleted = await QueryHistory.findByIdAndDelete(req.params.id)
    if (!deleted) return next(httpError(404, 'Query history record not found'))
    res.status(200).json({ success: true, message: 'Query history record deleted successfully' })
  } catch (err) {
    next(asIdError(err))
  }
}

async function sendStats(req, res, next) {
  try {
    const stats = await loadStats()
    res.status(200).json({ success: true, data: stats })
  } catch (err) {
    next(err)
  }
}

function readPage(req) {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100)
  const page = Math.max(parseInt(req.query.page) || 1, 1)
  return { limit, page, skip: (page - 1) * limit }
}

async function loadHistory({ skip, limit }) {
  const [records, total] = await Promise.all([
    QueryHistory.find().sort({ createdAt: -1 }).skip(skip).limit(limit).select('-__v').lean(),
    QueryHistory.countDocuments(),
  ])
  return { records, total }
}

async function findHistory(id) {
  return QueryHistory.findById(id).select('-__v').lean()
}

async function loadStats() {
  const [summary] = await QueryHistory.aggregate([
    {
      $group: {
        _id: null,
        totalQueries: { $sum: 1 },
        avgDurationMs: { $avg: '$durationMs' },
      },
    },
  ])
  const providerCounts = await QueryHistory.aggregate([
    { $group: { _id: '$provider', count: { $sum: 1 } } },
  ])
  const recent = await QueryHistory.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .select('naturalLanguageQuery createdAt')
    .lean()

  return {
    totalQueries: summary?.totalQueries ?? 0,
    avgDurationMs: Math.round((summary?.avgDurationMs || 0) * 100) / 100,
    providerBreakdown: countByProvider(providerCounts),
    topQueries: recent.map((item) => ({
      query: item.naturalLanguageQuery.slice(0, 60),
      createdAt: item.createdAt,
    })),
  }
}

function countByProvider(rows) {
  return rows.reduce((counts, row) => {
    counts[row._id || 'unknown'] = row.count
    return counts
  }, {})
}

function asIdError(err) {
  if (err.name === 'CastError') return httpError(400, 'Invalid ID format')
  return err
}

function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

module.exports = router
