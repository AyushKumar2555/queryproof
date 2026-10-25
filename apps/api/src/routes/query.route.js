const express = require('express')
const { validate } = require('../middleware/validate.middleware')
const { requireUser } = require('../middleware/auth.middleware')
const { analyzeSchema } = require('../types/analysis.schema')
const { createEvalCaseSchema } = require('../types/eval-case.schema')
const queryController = require('../controllers/query.controller')

const router = express.Router()

router.use(requireUser)
router.post('/analyze', validate(analyzeSchema), queryController.sendAnalysis)
router.get('/history', queryController.sendHistory)
router.get('/history/:id', queryController.sendOneHistory)
router.delete('/history/:id', queryController.deleteHistory)
router.get('/stats', queryController.sendStats)
router.post('/eval/cases', validate(createEvalCaseSchema), queryController.sendCreateEvalCase)
router.post('/eval', queryController.sendEval)

module.exports = router
