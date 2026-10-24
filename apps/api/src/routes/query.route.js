const express = require('express')
const { validate } = require('../middleware/validate.middleware')
const { analyzeSchema } = require('../types/analysis.schema')
const queryController = require('../controllers/query.controller')

const router = express.Router()

router.post('/analyze', validate(analyzeSchema), queryController.sendAnalysis)
router.get('/history', queryController.sendHistory)
router.get('/history/:id', queryController.sendOneHistory)
router.delete('/history/:id', queryController.deleteHistory)
router.get('/stats', queryController.sendStats)
router.post('/eval', queryController.sendEval)

module.exports = router
