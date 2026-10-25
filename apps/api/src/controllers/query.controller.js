const mongoose = require('mongoose')
const queryService = require('../services/query.service')
const evalService = require('../services/eval.service')
const QueryHistory = require('../models/query.model')

async function sendAnalysis(req, res, next) {
  console.log('sendAnalysis', req.validated)
  console.log("================================================")
  await run(next, async () => {
    const result = await queryService.analyze(req.validated, req.userId)
    res.status(200).json({ success: true, data: result })
  })
}

async function sendHistory(req, res, next) {
  await run(next, async () => {
    const page = readPage(req)
    const { records, total } = await loadHistory(page, req.userId)
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
  })
}

async function sendOneHistory(req, res, next) {
  await run(next, async () => {
    const record = await findHistory(req.params.id, req.userId)
    if (!record) return next(httpError(404, 'Query history record not found'))
    res.status(200).json({ success: true, data: record })
  }, asIdError)
}

async function deleteHistory(req, res, next) {
  await run(next, async () => {
    const deleted = await QueryHistory.findOneAndDelete({ _id: req.params.id, ...ownedBy(req.userId) })
    if (!deleted) return next(httpError(404, 'Query history record not found'))
    res.status(200).json({ success: true, message: 'Query history record deleted successfully' })
  }, asIdError)
}

async function sendStats(req, res, next) {
  await run(next, async () => {
    const stats = await loadStats(req.userId)
    res.status(200).json({ success: true, data: stats })
  })
}

async function sendEval(req, res, next) {
  await run(next, async () => {
    const result = await evalService.scoreActiveCases(req.userId)
    res.status(200).json({ success: true, data: result })
  })
}

async function sendCreateEvalCase(req, res, next) {
  await run(next, async () => {
    const evalCase = await evalService.createEvalCase(req.validated)
    res.status(201).json({ success: true, data: evalCase })
  })
}

function readPage(req) {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100)
  const page = Math.max(parseInt(req.query.page) || 1, 1)
  return { limit, page, skip: (page - 1) * limit }
}

async function loadHistory({ skip, limit }, userId) {
  const filter = ownedBy(userId)
  const [records, total] = await Promise.all([
    QueryHistory.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select('-__v').lean(),
    QueryHistory.countDocuments(filter),
  ])
  return { records, total }
}

async function findHistory(id, userId) {
  return QueryHistory.findOne({ _id: id, ...ownedBy(userId) }).select('-__v').lean()
}

function ownedBy(userId) {
  return { userId: new mongoose.Types.ObjectId(userId) }
}

async function loadStats(userId) {
  const filter = ownedBy(userId)
  const [summary] = await QueryHistory.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalQueries: { $sum: 1 },
        avgDurationMs: { $avg: '$durationMs' },
      },
    },
  ])
  const providerCounts = await QueryHistory.aggregate([
    { $match: filter },
    { $group: { _id: '$provider', count: { $sum: 1 } } },
  ])
  const recent = await QueryHistory.find(filter)
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

async function run(next, action, mapError = (err) => err) {
  try {
    await action()
  } catch (err) {
    next(mapError(err))
  }
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

module.exports = {
  sendAnalysis,
  sendHistory,
  sendOneHistory,
  deleteHistory,
  sendStats,
  sendEval,
  sendCreateEvalCase,
}
