// Auto-detect CSV file type based on column headers

import { CSVFileType, CSV_SCHEMAS } from '@/lib/types/csv'

/**
 * Detect CSV file type from headers
 */
export function detectFileType(csvContent: string): CSVFileType | null {
  // Extract first line (headers)
  const lines = csvContent.trim().split('\n')
  if (lines.length === 0) return null
  
  const headers = lines[0]
    .toLowerCase()
    .split(',')
    .map(h => h.trim())

  // Check each schema for matching columns
  const fileTypes = Object.keys(CSV_SCHEMAS) as CSVFileType[]
  
  for (const fileType of fileTypes) {
    if (fileType === 'any') continue
    
    const schema = CSV_SCHEMAS[fileType]
    const schemaLower = schema.map(col => col.toLowerCase())
    
    // Check if all schema columns are present in headers
    const matchCount = schemaLower.filter(col => headers.includes(col)).length
    const matchPercentage = matchCount / schemaLower.length
    
    // If 80%+ of expected columns match, consider it a match
    if (matchPercentage >= 0.8) {
      return fileType
    }
  }
  
  return null
}

/**
 * Extract file type from filename if possible
 */
export function detectFileTypeFromName(fileName: string): CSVFileType | null {
  const nameLower = fileName.toLowerCase()
  
  if (nameLower.includes('holding')) return 'holdings'
  if (nameLower.includes('price')) return 'prices'
  if (nameLower.includes('fundamental')) return 'fundamentals'
  if (nameLower.includes('benchmark')) return 'benchmarks'
  if (nameLower.includes('sector') && nameLower.includes('valuation')) return 'sector_valuations'
  if (nameLower.includes('cycle')) return 'cycle_indicators'
  if (nameLower.includes('model') && nameLower.includes('portfolio')) return 'model_portfolios'
  
  return null
}

/**
 * Smart detection combining both methods
 */
export function smartDetectFileType(fileName: string, csvContent: string): CSVFileType | null {
  // Try filename first
  const fromName = detectFileTypeFromName(fileName)
  if (fromName) return fromName
  
  // Fall back to content analysis
  return detectFileType(csvContent)
}
