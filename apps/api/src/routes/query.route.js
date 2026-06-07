const express = require('express')
const { validate } = require('../middleware/validate.middleware')
const { analyzeSchema } = require('../types/analysis.schema')
// Import the singleton instance directly (already exported as new QueryService())
// No need to use 'new' - the service file exports an instance, not a class
const queryService = require('../services/query.service')
const { logger } = require('../middleware/logger.middleware')

const router = express.Router()

// queryService is already a singleton instance from the service file
// no need to create a new instance here

/**
 * POST /api/analyze
 * Analyzes a natural language query and returns an ES DSL query with explanations
 * 
 * Request body (validated by Zod schema):
 *   - naturalLanguageQuery (required): The user's query in plain English
 *   - indexMapping (optional): ES index mapping for deeper analysis
 *   - indexName (optional): Name of the ES index being queried
 * 
 * Response:
 *   - success: boolean
 *   - data: The analysis result containing esQuery, explanation, issues, optimizations
 */
router.post('/analyze', validate(analyzeSchema), async (req, res, next) => {
  try {
    // req.validated contains the cleaned/validated data from the validate middleware
    // this ensures we only work with fields defined in the schema
    const result = await queryService.analyze(req.validated)

    logger.info('route.analyze.success', {
      query: req.validated.naturalLanguageQuery.slice(0, 80),
    })

    res.status(200).json({
      success: true,
      data: result,
    })

  } catch (err) {
    // pass to the global error handler in error.middleware.js
    // don't send response here — let the error handler deal with it
    next(err)
  }
})

/**
 * GET /api/history
 * Returns recent query history from MongoDB
 * 
 * Query parameters:
 *   - limit (optional): Number of records to return (default: 20, max: 100)
 *   - page (optional): Page number for pagination (default: 1)
 * 
 * Response:
 *   - success: boolean
 *   - data: Array of query history records
 *   - pagination: { total, page, limit, totalPages }
 */
router.get('/history', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100) // cap at 100
    const page = Math.max(parseInt(req.query.page) || 1, 1)       // minimum page 1
    const skip = (page - 1) * limit

    const QueryHistory = require('../models/query.model')
    
    // run both queries in parallel — no need to wait for one before starting the other
    const [records, total] = await Promise.all([
      QueryHistory.find()
        .sort({ createdAt: -1 })  // newest first
        .skip(skip)
        .limit(limit)
        .select('-__v')           // exclude mongoose version key
        .lean(),                  // plain JS objects, not mongoose docs (faster)
      QueryHistory.countDocuments(),
    ])

    logger.info('route.history.fetched', {
      count: records.length,
      page,
      total,
    })

    res.status(200).json({
      success: true,
      data: records,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })

  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/history/:id
 * Returns a single query history record by ID
 * 
 * Response:
 *   - success: boolean
 *   - data: The query history record
 */
router.get('/history/:id', async (req, res, next) => {
  try {
    const QueryHistory = require('../models/query.model')
    
    const record = await QueryHistory.findById(req.params.id)
      .select('-__v')
      .lean()

    if (!record) {
      const err = new Error('Query history record not found')
      err.status = 404
      return next(err)
    }

    res.status(200).json({
      success: true,
      data: record,
    })

  } catch (err) {
    // mongoose throws CastError for invalid ObjectId format
    if (err.name === 'CastError') {
      const error = new Error('Invalid ID format')
      error.status = 400
      return next(error)
    }
    next(err)
  }
})

/**
 * DELETE /api/history/:id
 * Deletes a single query history record by ID
 * 
 * Response:
 *   - success: boolean
 *   - message: Confirmation message
 */
router.delete('/history/:id', async (req, res, next) => {
  try {
    const QueryHistory = require('../models/query.model')
    
    const result = await QueryHistory.findByIdAndDelete(req.params.id)

    if (!result) {
      const err = new Error('Query history record not found')
      err.status = 404
      return next(err)
    }

    logger.info('route.history.deleted', {
      id: req.params.id,
    })

    res.status(200).json({
      success: true,
      message: 'Query history record deleted successfully',
    })

  } catch (err) {
    if (err.name === 'CastError') {
      const error = new Error('Invalid ID format')
      error.status = 400
      return next(error)
    }
    next(err)
  }
})

/**
 * GET /api/stats
 * Returns usage statistics from query history
 * 
 * Response:
 *   - success: boolean
 *   - data: { totalQueries, avgDurationMs, providerBreakdown, topQueries }
 */
router.get('/stats', async (req, res, next) => {
  try {
    const QueryHistory = require('../models/query.model')
    
    const [stats] = await QueryHistory.aggregate([
      {
        $group: {
          _id: null,
          totalQueries:  { $sum: 1 },
          avgDurationMs: { $avg: '$durationMs' },
        },
      },
      {
        $project: {
          _id: 0,
          totalQueries:  1,
          avgDurationMs: { $round: [{ $ifNull: ['$avgDurationMs', 0] }, 2] },
        },
      },
    ])

    const providerCounts = await QueryHistory.aggregate([
      { $group: { _id: '$provider', count: { $sum: 1 } } },
    ])

    const providerBreakdown = providerCounts.reduce((acc, { _id, count }) => {
      acc[_id || 'unknown'] = count
      return acc
    }, {})

    // get top 5 most recent queries for display
    const topQueries = await QueryHistory.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('naturalLanguageQuery createdAt')
      .lean()

    logger.info('route.stats.fetched', {
      totalQueries: stats?.totalQueries || 0,
    })

    res.status(200).json({
      success: true,
      data: {
        totalQueries: stats?.totalQueries ?? 0,
        avgDurationMs: stats?.avgDurationMs ?? 0,
        providerBreakdown,
        topQueries: topQueries.map(q => ({
          query: q.naturalLanguageQuery.slice(0, 60),
          createdAt: q.createdAt,
        })),
      },
    })

  } catch (err) {
    next(err)
  }
})

module.exports = router
