// Direct CSV parser for structured data (bypasses Claude API)
// Use this for predictable, standardized CSV files

/**
 * Parse FactSet CSV directly without Claude
 * Maps CSV columns to factset_data_v2 table structure
 */
export function parseFactsetCsv(csvContent: string): Array<Record<string, any>> {
  const lines = csvContent.trim().split('\n')
  
  if (lines.length < 3) {
    throw new Error('CSV must have at least 3 rows (column numbers, headers, data)')
  }

  // Skip row 1 (column numbers), use row 2 as headers
  const headers = parseCsvLine(lines[1])
  console.log(`Found ${headers.length} columns in FactSet CSV`)

  // All FactSet columns are text type in the database
  // Just map CSV headers directly to DB column names
  const records = []
  
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue // Skip empty lines
    
    const values = parseCsvLine(line)
    
    // Create record object
    const record: Record<string, any> = {}
    
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j]
      if (!header) continue // Skip empty headers
      
      const value = values[j]
      
      // Store empty values as null, otherwise keep as text
      if (value === '' || value === null || value === undefined) {
        record[header] = null
      } else {
        record[header] = value
      }
    }
    
    // Only add records with a valid ticker
    if (record.Ticker) {
      records.push(record)
    }
  }

  console.log(`Parsed ${records.length} FactSet records from ${lines.length - 2} data rows`)
  
  return records
}

/**
 * Validate FactSet data structure
 */
export function validateFactsetData(records: Array<Record<string, any>>): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (records.length === 0) {
    errors.push('No records found')
    return { valid: false, errors }
  }
  
  // Check required columns
  const requiredColumns = ['Ticker', 'PRICE', 'MKT CAP']
  const firstRecord = records[0]
  
  for (const col of requiredColumns) {
    if (!(col in firstRecord)) {
      errors.push(`Missing required column: ${col}`)
    }
  }
  
  // Check for duplicate tickers (WARNING only)
  const tickers = new Set()
  const duplicates: string[] = []
  
  for (const record of records) {
    if (tickers.has(record.Ticker)) {
      duplicates.push(record.Ticker)
    }
    tickers.add(record.Ticker)
  }
  
  if (duplicates.length > 0) {
    console.warn(`⚠️ Warning: Found ${duplicates.length} duplicate tickers in FactSet: ${duplicates.slice(0, 5).join(', ')}`)
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Parse GIC & Yahoo CSV directly without Claude
 * Maps CSV columns to gics_yahoo_finance table structure
 */
export function parseGicsYahooCsv(csvContent: string): Array<Record<string, any>> {
  const lines = csvContent.trim().split('\n')
  
  if (lines.length < 2) {
    throw new Error('CSV must have at least 2 rows (headers, data)')
  }

  // Parse headers
  const headers = parseCsvLine(lines[0])
  console.log(`Found ${headers.length} columns in GIC & Yahoo CSV`)

  // All columns are text type in the database
  // Just map CSV headers directly to DB column names
  const records = []
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue // Skip empty lines
    
    const values = parseCsvLine(line)
    
    // Create record object
    const record: Record<string, any> = {}
    
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j]
      if (!header || header.trim() === '') continue // Skip empty headers
      
      const value = values[j]
      
      // Store empty values as null, otherwise keep as text
      if (value === '' || value === null || value === undefined) {
        record[header] = null
      } else {
        record[header] = value
      }
    }
    
    // Only add records with a valid ticker
    if (record.Ticker) {
      records.push(record)
    }
  }

  console.log(`Parsed ${records.length} GIC & Yahoo records from ${lines.length - 1} data rows`)
  
  return records
}

/**
 * Validate GIC & Yahoo data structure
 */
export function validateGicsYahooData(records: Array<Record<string, any>>): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (records.length === 0) {
    errors.push('No records found')
    return { valid: false, errors }
  }
  
  // Check required columns
  const requiredColumns = ['Ticker', 'Company Name', 'GICS Sector']
  const firstRecord = records[0]
  
  for (const col of requiredColumns) {
    if (!(col in firstRecord)) {
      errors.push(`Missing required column: ${col}`)
    }
  }
  
  // Check for duplicate tickers (WARNING only)
  const tickers = new Set()
  const duplicates: string[] = []
  
  for (const record of records) {
    if (tickers.has(record.Ticker)) {
      duplicates.push(record.Ticker)
    }
    tickers.add(record.Ticker)
  }
  
  if (duplicates.length > 0) {
    console.warn(`⚠️ Warning: Found ${duplicates.length} duplicate tickers in GIC & Yahoo: ${duplicates.slice(0, 5).join(', ')}`)
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Parse holdings CSV directly without Claude
 * Maps CSV columns to holdings table structure
 */
export function parseHoldingsCsv(csvContent: string): Array<Record<string, any>> {
  const lines = csvContent.trim().split('\n')
  
  if (lines.length === 0) {
    throw new Error('CSV is empty')
  }

  // Parse header row
  const headers = parseCsvLine(lines[0])
  console.log(`Found ${headers.length} columns:`, headers)

  // Expected holdings columns (map CSV headers to DB column names)
  // Handle various possible header formats
  const columnMap: Record<string, string> = {
    'Date': 'date',
    'Account': 'account',
    'StockTicker': 'stock_ticker',
    'Stock Ticker': 'stock_ticker',
    'Ticker': 'stock_ticker',
    'CUSIP': 'cusip',
    'SecurityName': 'security_name',
    'Security Name': 'security_name',
    'Name': 'security_name',
    'Shares': 'shares',
    'ClosePrice': 'close_price',
    'Close Price': 'close_price',
    'Price': 'close_price',
    'MarketValue': 'market_value',
    'Market Value': 'market_value',
    'Weightings': 'weightings',
    'Weight': 'weightings',
    'NetAssets': 'net_assets',
    'Net Assets': 'net_assets',
    'SharesOutstand': 'shares_outstand',
    'Shares Outstand': 'shares_outstand',
    'SharesOutstanding': 'shares_outstand',
    'CreationUnits': 'creation_units',
    'Creation Units': 'creation_units',
  }

  // Valid database columns (only include these)
  const validColumns = [
    'date', 'account', 'stock_ticker', 'cusip', 'security_name',
    'shares', 'close_price', 'market_value', 'weightings',
    'net_assets', 'shares_outstand', 'creation_units'
  ]

  // Parse data rows
  const records = []
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue // Skip empty lines
    
    const values = parseCsvLine(line)
    
    // Create record object
    const record: Record<string, any> = {}
    
    for (let j = 0; j < headers.length; j++) {
      const csvHeader = headers[j]
      const dbColumnName = columnMap[csvHeader] || csvHeader.toLowerCase().replace(/\s+/g, '_')
      const value = values[j]
      
      // Only include columns that exist in the database schema
      if (!validColumns.includes(dbColumnName)) {
        continue // Skip unknown columns
      }
      
      // Handle empty values
      if (value === '' || value === null || value === undefined) {
        record[dbColumnName] = null
      } 
      // Parse numbers for numeric columns
      else if (['shares', 'close_price', 'market_value', 'weightings', 'net_assets', 'shares_outstand', 'creation_units'].includes(dbColumnName)) {
        const numValue = parseFloat(value.replace(/,/g, '')) // Remove commas
        record[dbColumnName] = isNaN(numValue) ? null : numValue
      } 
      // Keep strings as-is
      else {
        record[dbColumnName] = value
      }
    }
    
    // Only add records with a valid ticker
    if (record.stock_ticker) {
      records.push(record)
    }
  }

  console.log(`Parsed ${records.length} holdings records from ${lines.length - 1} data rows`)
  
  return records
}

/**
 * Validate holdings data structure
 */
export function validateHoldingsData(records: Array<Record<string, any>>): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (records.length === 0) {
    errors.push('No records found')
    return { valid: false, errors }
  }
  
  // Check required columns
  const requiredColumns = ['stock_ticker', 'security_name', 'shares', 'close_price', 'market_value']
  const firstRecord = records[0]
  
  for (const col of requiredColumns) {
    if (!(col in firstRecord)) {
      errors.push(`Missing required column: ${col}`)
    }
  }
  
  // Check for duplicate tickers (WARNING only, not a validation failure)
  const tickers = new Set()
  const duplicates: string[] = []
  
  for (const record of records) {
    if (tickers.has(record.stock_ticker)) {
      duplicates.push(record.stock_ticker)
    }
    tickers.add(record.stock_ticker)
  }
  
  if (duplicates.length > 0) {
    console.warn(`⚠️ Warning: Found ${duplicates.length} duplicate tickers: ${duplicates.slice(0, 5).join(', ')}`)
    // Note: Don't add to errors - duplicates are acceptable (same stock in different accounts)
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Parse weightings CSV directly without Claude
 * Maps CSV columns to weightings_universe table structure
 */
export function parseWeightingsCsv(csvContent: string): Array<Record<string, any>> {
  const lines = csvContent.trim().split('\n')
  
  if (lines.length === 0) {
    throw new Error('CSV is empty')
  }

  // Parse header row
  const headers = parseCsvLine(lines[0])
  console.log(`Found ${headers.length} columns:`, headers)

  // Parse data rows
  const records = []
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue // Skip empty lines
    
    const values = parseCsvLine(line)
    
    // Create record object mapping headers to values
    const record: Record<string, any> = {}
    
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j]
      const value = values[j]
      
      // Map to database column names
      // First two columns (Ticker, Name) use Title Case
      // ETF ticker columns (SPY, QQQ, etc.) stay in UPPERCASE to match DB schema
      let columnName: string
      if (j === 0) {
        columnName = 'Ticker' // First column
      } else if (j === 1) {
        columnName = 'Name' // Second column
      } else {
        // ETF columns - keep as uppercase (SPY, QQQ, XLK, etc.)
        columnName = header.toUpperCase()
      }
      
      // Handle empty values and "-" (which means null in the CSV)
      if (value === '' || value === null || value === undefined || value === '-') {
        record[columnName] = null
      } else if (columnName === 'Ticker' || columnName === 'Name') {
        // Keep ticker and name as strings
        record[columnName] = value
      } else {
        // For percentage columns, keep as string (matches table schema which is all text)
        record[columnName] = value
      }
    }
    
    // Only add records with a valid ticker
    if (record.Ticker) {
      records.push(record)
    }
  }

  console.log(`Parsed ${records.length} records from ${lines.length - 1} data rows`)
  
  return records
}

/**
 * Parse a single CSV line handling quoted values and commas
 */
function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let currentValue = ''
  let insideQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]
    
    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        currentValue += '"'
        i++ // Skip next quote
      } else {
        // Toggle quote mode
        insideQuotes = !insideQuotes
      }
    } else if (char === ',' && !insideQuotes) {
      // End of field
      values.push(currentValue.trim())
      currentValue = ''
    } else {
      currentValue += char
    }
  }
  
  // Add the last value
  values.push(currentValue.trim())
  
  return values
}

/**
 * Validate weightings data structure
 */
export function validateWeightingsData(records: Array<Record<string, any>>): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (records.length === 0) {
    errors.push('No records found')
    return { valid: false, errors }
  }
  
  // Check required columns
  const requiredColumns = ['Ticker', 'Name']
  const firstRecord = records[0]
  
  for (const col of requiredColumns) {
    if (!(col in firstRecord)) {
      errors.push(`Missing required column: ${col}`)
    }
  }
  
  // Check for duplicate tickers
  const tickers = new Set()
  const duplicates: string[] = []
  
  for (const record of records) {
    if (tickers.has(record.Ticker)) {
      duplicates.push(record.Ticker)
    }
    tickers.add(record.Ticker)
  }
  
  if (duplicates.length > 0) {
    errors.push(`Found ${duplicates.length} duplicate tickers: ${duplicates.slice(0, 5).join(', ')}`)
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}
