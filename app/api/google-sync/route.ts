// Google Drive Sync API Route

import { NextRequest, NextResponse } from 'next/server'
import { syncGoogleSheetFile, GoogleSheetFileType } from '@/lib/api/googleSheets'
import { parseCSVWithClaude, validateParsedData } from '@/lib/api/claude'
import { 
  parseWeightingsCsv, 
  validateWeightingsData, 
  parseHoldingsCsv, 
  validateHoldingsData,
  parseFactsetCsv,
  validateFactsetData,
  parseGicsYahooCsv,
  validateGicsYahooData
} from '@/lib/utils/csvParser'
import { CSVFileType, HoldingRecord } from '@/lib/types/csv'
import { createClient } from '@/app/utils/supabase/server'
import { createServiceRoleClient } from '@/app/utils/supabase/service-role'

/**
 * Request body for Google Sync endpoint
 */
interface GoogleSyncRequest {
  fileType: 'holdings' | 'factset' | 'weightings' | 'gic_yahoo' | 'all'
  dryRun?: boolean
}

/**
 * Response for a single file sync
 */
interface FileSyncResult {
  file: string
  tab: string
  rowsProcessed: number
  status: 'success' | 'error'
  error?: string
}

/**
 * Response for Google Sync endpoint
 */
interface GoogleSyncResponse {
  success: boolean
  synced: FileSyncResult[]
  timestamp: string
  message?: string
  error?: string
}

/**
 * Map Google Sheet file types to CSV file types
 */
const FILE_TYPE_MAP: Record<GoogleSheetFileType, CSVFileType> = {
  holdings: 'holdings',
  factset: 'fundamentals', // FactSet data maps to fundamentals
  weightings: 'weightings',
  gic_yahoo: 'any', // Will need to be determined
}

/**
 * Sync a single file from Google Drive
 */
async function syncSingleFile(
  fileType: GoogleSheetFileType,
  dryRun: boolean
): Promise<FileSyncResult> {
  try {
    console.log(`\n=== Syncing ${fileType} ===`)

    // Step 1: Fetch data from Google Sheets
    const { csvContent, fileName, tabName, rowCount } = await syncGoogleSheetFile(fileType)

    console.log(`Retrieved ${rowCount} rows from "${tabName}" tab`)

    if (dryRun) {
      console.log('DRY RUN: Skipping parsing and database operations')
      return {
        file: fileName,
        tab: tabName,
        rowsProcessed: rowCount,
        status: 'success',
      }
    }

    // Step 2: Parse CSV
    // For weightings and holdings, use direct CSV parsing (no Claude API needed)
    // For other types, use Claude for flexibility
    let parsedRecords: any[]
    let parsedRowCount: number
    
    if (fileType === 'holdings') {
      console.log(`Parsing holdings CSV directly (bypassing Claude)`)
      
      parsedRecords = parseHoldingsCsv(csvContent)
      parsedRowCount = parsedRecords.length
      
      // Validate holdings data
      const validation = validateHoldingsData(parsedRecords)
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
      }
      
      console.log(`✓ Parsed ${parsedRowCount} holdings records directly from CSV`)
    }
    else if (fileType === 'factset') {
      console.log(`Parsing FactSet CSV directly (bypassing Claude)`)
      
      parsedRecords = parseFactsetCsv(csvContent)
      parsedRowCount = parsedRecords.length
      
      // Validate FactSet data
      const validation = validateFactsetData(parsedRecords)
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
      }
      
      console.log(`✓ Parsed ${parsedRowCount} FactSet records directly from CSV`)
    }
    else if (fileType === 'gic_yahoo') {
      console.log(`Parsing GIC & Yahoo CSV directly (bypassing Claude)`)
      
      parsedRecords = parseGicsYahooCsv(csvContent)
      parsedRowCount = parsedRecords.length
      
      // Validate GIC & Yahoo data
      const validation = validateGicsYahooData(parsedRecords)
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
      }
      
      console.log(`✓ Parsed ${parsedRowCount} GIC & Yahoo records directly from CSV`)
    }
    else if (fileType === 'weightings') {
      console.log(`Parsing weightings CSV directly (bypassing Claude)`)
      
      parsedRecords = parseWeightingsCsv(csvContent)
      parsedRowCount = parsedRecords.length
      
      // Validate weightings data
      const validation = validateWeightingsData(parsedRecords)
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
      }
      
      console.log(`✓ Parsed ${parsedRowCount} weightings records directly from CSV`)
    } 
    else {
      console.log(`Parsing ${fileType} with Claude API`)
      
      const csvFileType = FILE_TYPE_MAP[fileType]
      const parsedData = await parseCSVWithClaude(csvContent, csvFileType)
      
      // Validate parsed data
      const validation = validateParsedData(parsedData, csvFileType)
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
      }
      
      parsedRecords = parsedData.records
      parsedRowCount = parsedData.rowCount
    }

    // Step 5: Store in Supabase using service role (bypasses RLS)
    const supabase = createServiceRoleClient()

    if (fileType === 'holdings') {
      // Delete existing holdings
      const { error: deleteError } = await supabase
        .from('holdings')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (deleteError) {
        throw new Error(`Failed to clear existing holdings: ${deleteError.message}`)
      }

      console.log('Cleared existing holdings')

      // Check for duplicate tickers
      const holdingsRecords = parsedRecords as HoldingRecord[]
      const tickers = holdingsRecords.map(r => r.stock_ticker)
      const uniqueTickers = new Set(tickers)
      if (tickers.length !== uniqueTickers.size) {
        console.warn(`⚠️ Found ${tickers.length - uniqueTickers.size} duplicate tickers`)
      }

      // Insert new holdings
      const { error: insertError, data: insertedData } = await supabase
        .from('holdings')
        .insert(parsedRecords)
        .select()

      if (insertError) {
        throw new Error(`Failed to save to database: ${insertError.message}`)
      }

      console.log(`✓ Saved ${insertedData?.length || 0} holdings to database`)
    } 
    else if (fileType === 'factset') {
      // Delete existing FactSet data
      // Note: factset_data_v2 uses "Ticker" as primary key
      const { error: deleteError } = await supabase
        .from('factset_data_v2')
        .delete()
        .neq('Ticker', '')

      if (deleteError) {
        throw new Error(`Failed to clear existing factset_data_v2: ${deleteError.message}`)
      }

      console.log('Cleared existing factset_data_v2')

      // Insert new FactSet data in batches (2300+ rows)
      const batchSize = 500
      const batches = []
      
      for (let i = 0; i < parsedRecords.length; i += batchSize) {
        batches.push(parsedRecords.slice(i, i + batchSize))
      }

      console.log(`Inserting ${parsedRecords.length} FactSet records in ${batches.length} batch(es)`)

      let totalInserted = 0
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]
        const { error: insertError, data: insertedData } = await supabase
          .from('factset_data_v2')
          .insert(batch)
          .select()

        if (insertError) {
          throw new Error(`Failed to save batch ${i + 1}: ${insertError.message}`)
        }

        totalInserted += insertedData?.length || 0
        console.log(`✓ Saved batch ${i + 1}/${batches.length} (${insertedData?.length || 0} records)`)
      }

      console.log(`✓ Saved ${totalInserted} FactSet records to database`)
    } 
    else if (fileType === 'gic_yahoo') {
      // Delete existing GIC & Yahoo data
      // Note: gics_yahoo_finance uses "Ticker" as primary key
      const { error: deleteError } = await supabase
        .from('gics_yahoo_finance')
        .delete()
        .neq('Ticker', '')

      if (deleteError) {
        throw new Error(`Failed to clear existing gics_yahoo_finance: ${deleteError.message}`)
      }

      console.log('Cleared existing gics_yahoo_finance')

      // Insert new GIC & Yahoo data in batches (2,274 rows)
      const batchSize = 500
      const batches = []
      
      for (let i = 0; i < parsedRecords.length; i += batchSize) {
        batches.push(parsedRecords.slice(i, i + batchSize))
      }

      console.log(`Inserting ${parsedRecords.length} GIC & Yahoo records in ${batches.length} batch(es)`)

      let totalInserted = 0
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]
        const { error: insertError, data: insertedData } = await supabase
          .from('gics_yahoo_finance')
          .insert(batch)
          .select()

        if (insertError) {
          throw new Error(`Failed to save batch ${i + 1}: ${insertError.message}`)
        }

        totalInserted += insertedData?.length || 0
        console.log(`✓ Saved batch ${i + 1}/${batches.length} (${insertedData?.length || 0} records)`)
      }

      console.log(`✓ Saved ${totalInserted} GIC & Yahoo records to database`)
    } 
    else if (fileType === 'weightings') {
      // Delete existing weightings from weightings_universe table
      // Note: weightings_universe uses "Ticker" as primary key, not "id"
      const { error: deleteError } = await supabase
        .from('weightings_universe')
        .delete()
        .neq('Ticker', '')

      if (deleteError) {
        throw new Error(`Failed to clear existing weightings_universe: ${deleteError.message}`)
      }

      console.log('Cleared existing weightings_universe')

      // Insert new weightings in batches (all 635+ tickers)
      const batchSize = 500
      const batches = []
      
      for (let i = 0; i < parsedRecords.length; i += batchSize) {
        batches.push(parsedRecords.slice(i, i + batchSize))
      }

      console.log(`Inserting ${parsedRecords.length} weightings into weightings_universe in ${batches.length} batch(es)`)

      let totalInserted = 0
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]
        const { error: insertError, data: insertedData } = await supabase
          .from('weightings_universe')
          .insert(batch)
          .select()

        if (insertError) {
          throw new Error(`Failed to save batch ${i + 1}: ${insertError.message}`)
        }

        totalInserted += insertedData?.length || 0
        console.log(`Batch ${i + 1}/${batches.length}: Inserted ${insertedData?.length} records`)
      }

      console.log(`✓ Saved ${totalInserted} weightings to weightings_universe table`)
    }
    // TODO: Add factset and gic_yahoo data handling

    return {
      file: fileName,
      tab: tabName,
      rowsProcessed: parsedRowCount,
      status: 'success',
    }

  } catch (error) {
    console.error(`Error syncing ${fileType}:`, error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return {
      file: fileType,
      tab: 'N/A',
      rowsProcessed: 0,
      status: 'error',
      error: errorMessage,
    }
  }
}

/**
 * POST /api/google-sync
 * Sync data from Google Drive to Supabase
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const body: GoogleSyncRequest = await request.json()
    const { fileType, dryRun = false } = body

    // Validate input
    if (!fileType) {
      return NextResponse.json<GoogleSyncResponse>(
        {
          success: false,
          synced: [],
          timestamp: new Date().toISOString(),
          message: 'No file type specified',
          error: 'Missing fileType parameter',
        },
        { status: 400 }
      )
    }

    console.log(`\n${'='.repeat(60)}`)
    console.log(`Google Drive Sync Started`)
    console.log(`File Type: ${fileType}`)
    console.log(`Dry Run: ${dryRun}`)
    console.log(`Timestamp: ${new Date().toISOString()}`)
    console.log(`${'='.repeat(60)}`)

    // Determine which files to sync
    const filesToSync: GoogleSheetFileType[] = 
      fileType === 'all' 
        ? ['holdings', 'factset', 'weightings', 'gic_yahoo'] // All 4 data sources use direct CSV parsing!
        : [fileType as GoogleSheetFileType]

    // Sync each file
    const results: FileSyncResult[] = []
    
    for (const file of filesToSync) {
      const result = await syncSingleFile(file, dryRun)
      results.push(result)
    }

    // Check if any syncs failed
    const failedSyncs = results.filter(r => r.status === 'error')
    const successCount = results.length - failedSyncs.length
    const totalRows = results.reduce((sum, r) => sum + r.rowsProcessed, 0)

    console.log(`\n${'='.repeat(60)}`)
    console.log(`Sync Complete: ${successCount}/${results.length} succeeded`)
    console.log(`${'='.repeat(60)}\n`)

    // Log to sync_history table (only if not dry run)
    if (!dryRun) {
      try {
        const supabaseAdmin = createServiceRoleClient()
        const duration = Date.now() - startTime

        const syncStatus = failedSyncs.length === 0 
          ? 'success' 
          : successCount > 0 
            ? 'partial' 
            : 'failed'

        await supabaseAdmin
          .from('sync_history')
          .insert({
            sync_type: 'manual',
            file_type: fileType,
            status: syncStatus,
            files_synced: results,
            total_rows: totalRows,
            duration_ms: duration,
            error_message: failedSyncs.length > 0 
              ? failedSyncs.map(f => `${f.file}: ${f.error}`).join('; ')
              : null,
            triggered_by: 'manual_ui',
          })

        console.log('✓ Logged sync to history table')
      } catch (logError) {
        console.error('Failed to log sync history:', logError)
        // Don't fail the request if logging fails
      }
    }

    return NextResponse.json<GoogleSyncResponse>({
      success: failedSyncs.length === 0,
      synced: results,
      timestamp: new Date().toISOString(),
      message: `Successfully synced ${successCount} of ${results.length} files`,
    })

  } catch (error) {
    console.error('Google sync error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const duration = Date.now() - startTime

    // Log failed sync
    try {
      const supabaseAdmin = createServiceRoleClient()
      await supabaseAdmin
        .from('sync_history')
        .insert({
          sync_type: 'manual',
          file_type: 'unknown',
          status: 'failed',
          files_synced: [],
          total_rows: 0,
          duration_ms: duration,
          error_message: errorMessage,
          triggered_by: 'manual_ui',
        })
    } catch (logError) {
      console.error('Failed to log sync error:', logError)
    }
    
    return NextResponse.json<GoogleSyncResponse>(
      {
        success: false,
        synced: [],
        timestamp: new Date().toISOString(),
        message: 'Sync failed',
        error: errorMessage,
      },
      { status: 500 }
    )
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
