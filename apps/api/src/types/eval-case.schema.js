const { z } = require('zod')

// checklist for creating an EvalCase — not the Mongo model and not Express middleware
const createEvalCaseSchema = z.object({
  question: z.string({
    required_error: 'question is required',
    invalid_type_error: 'question must be a string',
  }).trim()
    .min(5, 'Question must be at least 5 characters')
    .max(2000, 'Question must not exceed 2000 characters'),

  indexName: z.string().trim().max(200).default('drug_enforcement'),

  expected: z.object({
    classification: optionalText(),
    state: optionalText(),
    recallingFirm: optionalText(),
    dateFrom: optionalText(),
    dateTo: optionalText(),
    textMustContain: z.array(z.string().trim().min(1)).default([]),
  }).default({ textMustContain: [] }),

  active: z.boolean().default(true),
})

function optionalText() {
  return z.string().trim().min(1).nullable().optional()
}

module.exports = { createEvalCaseSchema }
