const { z } = require('zod')

// request schema — validates what comes in from the client
// mirrors AnalyzeRequest in FastAPI but in camelCase (JS convention)
const analyzeSchema = z.object({
  // required — min 5 chars to reject nonsense like "?" or "hi"
  naturalLanguageQuery: z.string({
    required_error: 'naturalLanguageQuery is required',
    invalid_type_error: 'naturalLanguageQuery must be a string',
  }).trim()
    .min(5, 'Query must be at least 5 characters')
    .max(2000, 'Query must not exceed 2000 characters'),
     // strips leading/trailing whitespace automatically

  // optional — when provided enables deeper analysis
  indexMapping: z.record(z.string(), z.unknown()).optional(),

  // this API only searches the drug_enforcement index
  indexName: z.string().max(200).default('drug_enforcement'),
})

// response shape — documents what we return to the client
// Define inline to avoid potential issues with Zod v4
const analysisResultSchema = z.object({
  esQuery:            z.record(z.unknown()),
  explanation:        z.string(),
  performanceIssues:  z.array(z.object({
    severity:    z.enum(['error', 'warn', 'info']),
    title:       z.string(),
    description: z.string(),
  })),
  optimizations:      z.array(z.object({
    title:           z.string(),
    impact:          z.enum(['high', 'medium', 'low']),
    description:     z.string(),
    optimizedQuery:  z.record(z.unknown()).nullable().optional(),
  })),
  mappingSuggestions: z.array(z.object({
    field:         z.string(),
    currentType:   z.string().nullable().optional(),
    suggestedType: z.string(),
    reason:        z.string(),
  })),
  provider: z.string().optional(),
})

module.exports = {
  analyzeSchema,
  analysisResultSchema,
}