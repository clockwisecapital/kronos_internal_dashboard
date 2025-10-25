// Claude API Integration for CSV Parsing

import { 
  CSVFileType, 
  ParsedCSVData, 
  CSV_SCHEMAS, 
  CSVRecord,
  HoldingRecord,
  WeightingsRecord,
  PriceRecord,
  FundamentalRecord,
  BenchmarkRecord,
  SectorValuationRecord,
  CycleIndicatorRecord,
  ModelPortfolioRecord
} from '@/lib/types/csv'

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
const CLAUDE_MODEL = 'claude-sonnet-4-5-20250929'

interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ClaudeResponse {
  id: string
  type: string
  role: string
  content: Array<{
    type: string
    text: string
  }>
  model: string
  stop_reason: string
}

/**
 * Parse CSV content using Claude API
 */
export async function parseCSVWithClaude(
  csvContent: string,
  fileType: CSVFileType
): Promise<ParsedCSVData> {
  const apiKey = process.env.CLAUDE_API_KEY
  
  // Debug: Check if API key is loaded
  console.log('Claude API Key loaded:', !!apiKey, 'Length:', apiKey?.length)
  
  if (!apiKey) {
    throw new Error('CLAUDE_API_KEY environment variable is not set')
  }

  // 'any' type should not reach here (auto-detected in upload route)
  if (fileType === 'any') {
    throw new Error('File type must be detected before parsing')
  }
  
  const expectedColumns = CSV_SCHEMAS[fileType]
  
  // Limit CSV content to prevent timeouts (500KB or ~5000 rows)
  // Weightings CSV can be 700+ rows (~70KB)
  const maxCsvLength = 500000
  const truncatedCsv = csvContent.length > maxCsvLength 
    ? csvContent.substring(0, maxCsvLength) + '\n... (truncated)'
    : csvContent
  
  console.log(`CSV length: ${csvContent.length} chars, Truncated: ${csvContent.length > maxCsvLength}, Rows: ~${csvContent.split('\n').length}`)
  
  const prompt = generateParsingPrompt(fileType, expectedColumns, truncatedCsv)

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 16384, // Large enough for 700+ row responses (weightings CSV)
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Claude API error: ${response.status} - ${error}`)
    }

    const data: ClaudeResponse = await response.json()
    const responseText = data.content[0]?.text

    if (!responseText) {
      throw new Error('Empty response from Claude API')
    }

    // Extract JSON from response (Claude might wrap it in markdown)
    const jsonMatch = responseText.match(/```(?:json)?\n?([\s\S]*?)\n?```/) || 
                     responseText.match(/\{[\s\S]*\}/)
    
    if (!jsonMatch) {
      console.error('Claude response (first 500 chars):', responseText.substring(0, 500))
      throw new Error('Could not extract JSON from Claude response')
    }

    const jsonText = jsonMatch[1] || jsonMatch[0]
    
    // Debug: Log partial JSON if parsing fails
    let parsedData
    try {
      parsedData = JSON.parse(jsonText)
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      console.error('JSON text (first 1000 chars):', jsonText.substring(0, 1000))
      console.error('JSON text (last 500 chars):', jsonText.substring(Math.max(0, jsonText.length - 500)))
      throw new Error(`Invalid JSON from Claude: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
    }

    // Validate the response structure
    if (!parsedData.records || !Array.isArray(parsedData.records)) {
      throw new Error('Invalid response format: missing records array')
    }

    return {
      records: parsedData.records,
      rowCount: parsedData.records.length,
      columns: parsedData.columns || expectedColumns,
      warnings: parsedData.warnings || [],
      errors: parsedData.errors || []
    }

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`CSV parsing failed: ${error.message}`)
    }
    throw error
  }
}

/**
 * Generate parsing prompt for Claude
 */
function generateParsingPrompt(
  fileType: CSVFileType,
  expectedColumns: readonly string[],
  csvContent: string
): string {
  const instructions = getFileTypeInstructions(fileType)
  
  return `You are a CSV parser. Parse the following ${fileType} CSV data and return a JSON object.

**Required Output Format:**
{
  "records": [array of parsed objects],
  "columns": [array of column names],
  "warnings": [array of warning messages],
  "errors": [array of error messages]
}

**Expected Columns:**
${expectedColumns.join(', ')}

**Validation Rules:**
${instructions}

**Important:**
- Convert numeric strings to numbers
- Convert date strings to ISO format (YYYY-MM-DD)
- Trim whitespace from all values
- Report missing required columns in "errors"
- Report data type mismatches in "warnings"
- Skip empty rows
- Return valid JSON only (no markdown, no explanations)

**CSV Data:**
${csvContent}

Return ONLY the JSON object, nothing else.`
}

/**
 * Get file-type-specific validation instructions
 */
function getFileTypeInstructions(fileType: CSVFileType): string {
  if (fileType === 'any') {
    throw new Error('File type must be detected before getting instructions')
  }
  
  const instructions: Record<Exclude<CSVFileType, 'any'>, string> = {
    holdings: `
      - date: valid date (MM/DD/YYYY)
      - account: string (e.g., TIME, TME)
      - stock_ticker: string (uppercase stock symbol)
      - cusip: string (9-character identifier, optional)
      - security_name: string (company name)
      - shares: positive number
      - close_price: positive number (close price from CSV)
      - market_value: positive number (pre-calculated market value from CSV)
      - weightings: number (percentage as decimal, e.g., 5.53 for 5.53%)
      - net_assets: positive number
      - shares_outstand: positive number
      - creation_units: positive number
      - IMPORTANT: Include ALL rows including money market funds (MoneyMarketFlag column should be ignored but keep the row)
    `,
    weightings: `
      - ticker: string (uppercase stock symbol)
      - name: string (company name)
      - spy: number or null (S&P 500 weight %, use null for "-")
      - qqq: number or null (Nasdaq 100 weight %, use null for "-")
      - xlk, xlf, xlc, xly, xlp, xle, xlv, xli, xlb, xlre, xlu: numbers or null (sector ETF weights)
      - igv, ita, soxx, smh, arkk: numbers or null (thematic ETF weights)
      - IMPORTANT: Convert "-" to null for missing values
      - Parse percentages as decimal numbers (e.g., 7.7065 = 7.7065)
    `,
    prices: `
      - ticker: string (uppercase, max 5 chars)
      - date: valid date (YYYY-MM-DD)
      - open, high, low, close: positive numbers
      - volume: positive integer
      - Validate: high >= low, high >= open, high >= close
    `,
    fundamentals: `
      - ticker: string (uppercase, max 5 chars)
      - sector: string
      - All numeric fields should be numbers (can be negative for some metrics)
      - pe_ratio, ev_ebitda, ev_sales should be positive
      - Returns (return_12m, return_36m) can be negative
      - Percentages should be in decimal format (10% = 10.0, not 0.1)
    `,
    benchmarks: `
      - index: string (e.g., SPY, QQQ, DIA)
      - date: valid date (YYYY-MM-DD)
      - price: positive number
      - All change fields can be negative (percentage format)
    `,
    sector_valuations: `
      - index: string (e.g., SPY, QQQ)
      - All numeric fields should be positive numbers
      - PE ratios typically 10-40
      - PS ratios typically 1-10
      - PB ratios typically 1-5
      - Dividend yields typically 0-5%
    `,
    cycle_indicators: `
      - cycle_type: string (e.g., Country, Long-term Economic, Technology)
      - phase: string (e.g., Growth, Peak, Crisis, Late/Crisis)
      - alignment_pct: number between 0-100
      - trend: string (Rising, Stable, Falling)
      - description: string (brief phase description)
      - updated_date: valid date (YYYY-MM-DD)
    `,
    model_portfolios: `
      - model_name: string (e.g., Max Growth, Growth, Moderate, Conservative, Max Income)
      - ticker: string (uppercase, max 5 chars)
      - target_weight: positive number (percentage, should sum to 100 per model)
      - asset_class: string (Equity, Fixed Income, Cash, ETF)
      - sector: string (sector name or Cash/Bonds)
    `
  }

  return instructions[fileType]
}

/**
 * Validate parsed data against schema
 */
export function validateParsedData(
  data: ParsedCSVData,
  fileType: CSVFileType
): { valid: boolean; errors: string[] } {
  if (fileType === 'any') {
    throw new Error('File type must be detected before validation')
  }
  
  const errors: string[] = []
  const expectedColumns = CSV_SCHEMAS[fileType]

  // Check if we have records
  if (!data.records || data.records.length === 0) {
    errors.push('No records found in CSV')
    return { valid: false, errors }
  }

  // Check if all required columns are present
  const firstRecord = data.records[0] as unknown as Record<string, unknown>
  const actualColumns = Object.keys(firstRecord)
  
  for (const requiredCol of expectedColumns) {
    if (!actualColumns.includes(requiredCol)) {
      errors.push(`Missing required column: ${requiredCol}`)
    }
  }

  // Basic data type validation
  data.records.forEach((record: CSVRecord, index: number) => {
    if (index < 5) { // Only validate first 5 rows for performance
      const validationErrors = validateRecord(record, fileType)
      errors.push(...validationErrors.map(err => `Row ${index + 1}: ${err}`))
    }
  })

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Validate individual record
 */
function validateRecord(record: CSVRecord, fileType: CSVFileType): string[] {
  const errors: string[] = []

  switch (fileType) {
    case 'holdings': {
      const holding = record as HoldingRecord
      if (!holding.stock_ticker || typeof holding.stock_ticker !== 'string') {
        errors.push('Invalid stock_ticker')
      }
      if (typeof holding.shares !== 'number' || holding.shares <= 0) {
        errors.push('Shares must be a positive number')
      }
      if (typeof holding.close_price !== 'number' || holding.close_price <= 0) {
        errors.push('Close price must be a positive number')
      }
      if (typeof holding.market_value !== 'number' || holding.market_value <= 0) {
        errors.push('Market value must be a positive number')
      }
      break
    }

    case 'weightings': {
      const weighting = record as WeightingsRecord
      if (!weighting.ticker || typeof weighting.ticker !== 'string') {
        errors.push('Invalid ticker')
      }
      if (!weighting.name || typeof weighting.name !== 'string') {
        errors.push('Invalid name')
      }
      // SPY and QQQ can be null (missing) but if present must be numbers
      if (weighting.spy !== null && weighting.spy !== undefined && typeof weighting.spy !== 'number') {
        errors.push('SPY weight must be a number or null')
      }
      if (weighting.qqq !== null && weighting.qqq !== undefined && typeof weighting.qqq !== 'number') {
        errors.push('QQQ weight must be a number or null')
      }
      break
    }

    case 'prices': {
      const price = record as PriceRecord
      if (!price.ticker || typeof price.ticker !== 'string') {
        errors.push('Invalid ticker')
      }
      if (!price.date || !/^\d{4}-\d{2}-\d{2}$/.test(price.date)) {
        errors.push('Invalid date format (expected YYYY-MM-DD)')
      }
      if (typeof price.close !== 'number' || price.close <= 0) {
        errors.push('Close price must be a positive number')
      }
      break
    }

    case 'fundamentals': {
      const fundamental = record as FundamentalRecord
      if (!fundamental.ticker || typeof fundamental.ticker !== 'string') {
        errors.push('Invalid ticker')
      }
      if (typeof fundamental.pe_ratio !== 'number') {
        errors.push('PE ratio must be a number')
      }
      break
    }

    case 'benchmarks': {
      const benchmark = record as BenchmarkRecord
      if (!benchmark.index || typeof benchmark.index !== 'string') {
        errors.push('Invalid index')
      }
      if (typeof benchmark.price !== 'number' || benchmark.price <= 0) {
        errors.push('Price must be a positive number')
      }
      break
    }

    case 'sector_valuations': {
      const sector = record as SectorValuationRecord
      if (!sector.index || typeof sector.index !== 'string') {
        errors.push('Invalid index')
      }
      if (typeof sector.pe_avg !== 'number' || sector.pe_avg <= 0) {
        errors.push('PE average must be a positive number')
      }
      break
    }

    case 'cycle_indicators': {
      const cycle = record as CycleIndicatorRecord
      if (!cycle.cycle_type || typeof cycle.cycle_type !== 'string') {
        errors.push('Invalid cycle type')
      }
      if (!cycle.phase || typeof cycle.phase !== 'string') {
        errors.push('Invalid phase')
      }
      if (typeof cycle.alignment_pct !== 'number' || cycle.alignment_pct < 0 || cycle.alignment_pct > 100) {
        errors.push('Alignment percentage must be between 0 and 100')
      }
      if (!cycle.updated_date || !/^\d{4}-\d{2}-\d{2}$/.test(cycle.updated_date)) {
        errors.push('Invalid date format (expected YYYY-MM-DD)')
      }
      break
    }

    case 'model_portfolios': {
      const model = record as ModelPortfolioRecord
      if (!model.model_name || typeof model.model_name !== 'string') {
        errors.push('Invalid model name')
      }
      if (!model.ticker || typeof model.ticker !== 'string') {
        errors.push('Invalid ticker')
      }
      if (typeof model.target_weight !== 'number' || model.target_weight <= 0) {
        errors.push('Target weight must be a positive number')
      }
      if (!model.asset_class || typeof model.asset_class !== 'string') {
        errors.push('Invalid asset class')
      }
      break
    }
  }

  return errors
}
