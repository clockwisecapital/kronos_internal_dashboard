// Inngest Functions for Automated Data Sync
import { inngest } from './client'
import { syncGoogleSheetFile, GoogleSheetFileType } from '@/lib/api/googleSheets'
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
import { createServiceRoleClient } from '@/app/utils/supabase/service-role'

// Type definitions
interface SyncResult {
  file: string
  tab: string
  rowsProcessed: number
  status: 'success' | 'error'
  error?: string
}

/**
 * Automated Data Sync Function
 * 
 * Syncs all 4 data sources from Google Drive to Supabase:
 * - Holdings (40 rows)
 * - FactSet (2,307 rows)
 * - Weightings (633 rows)
 * - GIC & Yahoo (2,274 rows)
 * 
 * Total: 5,254 rows in ~9-12 seconds
 * 
 * Scheduled via Inngest dashboard
 */
export const syncAllDataSources = inngest.createFunction(
  {
    id: 'sync-all-data-sources',
    name: 'Sync All Data Sources from Google Drive',
    retries: 3,
  },
  { cron: '0 8 * * 1-5' }, // 8 AM EST, Monday-Friday
  async ({ event, step }) => {
    const startTime = Date.now()
    const filesToSync: GoogleSheetFileType[] = ['holdings', 'factset', 'weightings', 'gic_yahoo']
    const results: SyncResult[] = []
    let totalRows = 0

    console.log(`\n${'='.repeat(60)}`)
    console.log(`Inngest: Automated Data Sync Started`)
    console.log(`Event ID: ${event.id}`)
    console.log(`Timestamp: ${new Date().toISOString()}`)
    console.log(`${'='.repeat(60)}`)

    // Sync each data source in parallel for better performance
    for (const fileType of filesToSync) {
      const result = await step.run(`sync-${fileType}`, async () => {
        try {
          console.log(`\nSyncing ${fileType}...`)
          
          // Step 1: Fetch from Google Drive
          const { fileName, tabName, csvContent } = await syncGoogleSheetFile(fileType)
          console.log(`✓ Fetched ${fileName} (tab: ${tabName})`)

          // Step 2: Parse CSV
          let parsedRecords: any[]
          let parsedRowCount: number

          switch (fileType) {
            case 'holdings':
              parsedRecords = parseHoldingsCsv(csvContent)
              parsedRowCount = parsedRecords.length
              const hValidation = validateHoldingsData(parsedRecords)
              if (!hValidation.valid) throw new Error(`Validation failed: ${hValidation.errors.join(', ')}`)
              break

            case 'factset':
              parsedRecords = parseFactsetCsv(csvContent)
              parsedRowCount = parsedRecords.length
              const fValidation = validateFactsetData(parsedRecords)
              if (!fValidation.valid) throw new Error(`Validation failed: ${fValidation.errors.join(', ')}`)
              break

            case 'weightings':
              parsedRecords = parseWeightingsCsv(csvContent)
              parsedRowCount = parsedRecords.length
              const wValidation = validateWeightingsData(parsedRecords)
              if (!wValidation.valid) throw new Error(`Validation failed: ${wValidation.errors.join(', ')}`)
              break

            case 'gic_yahoo':
              parsedRecords = parseGicsYahooCsv(csvContent)
              parsedRowCount = parsedRecords.length
              const gValidation = validateGicsYahooData(parsedRecords)
              if (!gValidation.valid) throw new Error(`Validation failed: ${gValidation.errors.join(', ')}`)
              break

            default:
              throw new Error(`Unknown file type: ${fileType}`)
          }

          console.log(`✓ Parsed ${parsedRowCount} records`)

          // Step 3: Save to database
          const supabase = createServiceRoleClient()
          
          if (fileType === 'holdings') {
            await supabase.from('holdings').delete().neq('id', '00000000-0000-0000-0000-000000000000')
            const { error } = await supabase.from('holdings').insert(parsedRecords)
            if (error) throw error
          } else if (fileType === 'factset') {
            await supabase.from('factset_data_v2').delete().neq('Ticker', '')
            const batchSize = 500
            for (let i = 0; i < parsedRecords.length; i += batchSize) {
              const { error } = await supabase.from('factset_data_v2').insert(parsedRecords.slice(i, i + batchSize))
              if (error) throw error
            }
          } else if (fileType === 'weightings') {
            await supabase.from('weightings_universe').delete().neq('Ticker', '')
            const batchSize = 500
            for (let i = 0; i < parsedRecords.length; i += batchSize) {
              const { error } = await supabase.from('weightings_universe').insert(parsedRecords.slice(i, i + batchSize))
              if (error) throw error
            }
          } else if (fileType === 'gic_yahoo') {
            await supabase.from('gics_yahoo_finance').delete().neq('Ticker', '')
            const batchSize = 500
            for (let i = 0; i < parsedRecords.length; i += batchSize) {
              const { error } = await supabase.from('gics_yahoo_finance').insert(parsedRecords.slice(i, i + batchSize))
              if (error) throw error
            }
          }

          console.log(`✓ Saved ${parsedRowCount} records to database`)
          
          return {
            file: fileName,
            tab: tabName,
            rowsProcessed: parsedRowCount,
            status: 'success' as const
          }

        } catch (error) {
          console.error(`✗ Error syncing ${fileType}:`, error)
          return {
            file: fileType,
            tab: 'N/A',
            rowsProcessed: 0,
            status: 'error' as const,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      })

      results.push(result)
      if (result.status === 'success') {
        totalRows += result.rowsProcessed
      }
    }

    // Log to sync_history
    await step.run('log-sync-history', async () => {
      const supabase = createServiceRoleClient()
      const duration = Date.now() - startTime
      const successCount = results.filter(r => r.status === 'success').length
      const status = successCount === filesToSync.length ? 'success' : 
                     successCount > 0 ? 'partial' : 'failed'

      await supabase.from('sync_history').insert({
        sync_date: new Date().toISOString(),
        sync_type: 'automated',
        file_type: 'all',
        status,
        files_synced: results,
        total_rows: totalRows,
        duration_ms: duration,
        triggered_by: 'inngest',
      })

      console.log(`\n${'='.repeat(60)}`)
      console.log(`Inngest: Automated Sync Complete`)
      console.log(`Status: ${status}`)
      console.log(`Total Rows: ${totalRows}`)
      console.log(`Duration: ${(duration / 1000).toFixed(1)}s`)
      console.log(`${'='.repeat(60)}\n`)
    })

    return {
      success: true,
      results,
      summary: {
        totalFiles: filesToSync.length,
        successfulFiles: results.filter(r => r.status === 'success').length,
        failedFiles: results.filter(r => r.status === 'error').length,
        totalRows,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }
    }
  }
)

/**
 * Manual Sync Trigger Function
 * 
 * Can be triggered manually from the UI or via API
 * Useful for testing or ad-hoc syncs
 */
export const syncDataManual = inngest.createFunction(
  {
    id: 'sync-data-manual',
    name: 'Manual Data Sync',
    retries: 2,
  },
  { event: 'data/sync.manual' },
  async ({ event, step }) => {
    const { fileType } = event.data as { fileType?: GoogleSheetFileType | 'all' }
    const startTime = Date.now()
    const filesToSync: GoogleSheetFileType[] = 
      fileType === 'all' || !fileType
        ? ['holdings', 'factset', 'weightings', 'gic_yahoo']
        : [fileType]

    console.log(`\n${'='.repeat(60)}`)
    console.log(`Inngest: Manual Data Sync Started`)
    console.log(`Event ID: ${event.id}`)
    console.log(`File Type: ${fileType || 'all'}`)
    console.log(`Timestamp: ${new Date().toISOString()}`)
    console.log(`${'='.repeat(60)}`)

    const results: SyncResult[] = []
    let totalRows = 0

    // Sync each data source
    for (const fileTypeToSync of filesToSync) {
      const result = await step.run(`sync-${fileTypeToSync}`, async () => {
        try {
          console.log(`\nSyncing ${fileTypeToSync}...`)
          
          // Step 1: Fetch from Google Drive
          const { fileName, tabName, csvContent } = await syncGoogleSheetFile(fileTypeToSync)
          console.log(`✓ Fetched ${fileName} (tab: ${tabName})`)

          // Step 2: Parse CSV
          let parsedRecords: any[]
          let parsedRowCount: number

          switch (fileTypeToSync) {
            case 'holdings':
              parsedRecords = parseHoldingsCsv(csvContent)
              parsedRowCount = parsedRecords.length
              const hValidation = validateHoldingsData(parsedRecords)
              if (!hValidation.valid) throw new Error(`Validation failed: ${hValidation.errors.join(', ')}`)
              break

            case 'factset':
              parsedRecords = parseFactsetCsv(csvContent)
              parsedRowCount = parsedRecords.length
              const fValidation = validateFactsetData(parsedRecords)
              if (!fValidation.valid) throw new Error(`Validation failed: ${fValidation.errors.join(', ')}`)
              break

            case 'weightings':
              parsedRecords = parseWeightingsCsv(csvContent)
              parsedRowCount = parsedRecords.length
              const wValidation = validateWeightingsData(parsedRecords)
              if (!wValidation.valid) throw new Error(`Validation failed: ${wValidation.errors.join(', ')}`)
              break

            case 'gic_yahoo':
              parsedRecords = parseGicsYahooCsv(csvContent)
              parsedRowCount = parsedRecords.length
              const gValidation = validateGicsYahooData(parsedRecords)
              if (!gValidation.valid) throw new Error(`Validation failed: ${gValidation.errors.join(', ')}`)
              break

            default:
              throw new Error(`Unknown file type: ${fileTypeToSync}`)
          }

          console.log(`✓ Parsed ${parsedRowCount} records`)

          // Step 3: Save to database
          const supabase = createServiceRoleClient()
          
          if (fileTypeToSync === 'holdings') {
            await supabase.from('holdings').delete().neq('id', '00000000-0000-0000-0000-000000000000')
            const { error } = await supabase.from('holdings').insert(parsedRecords)
            if (error) throw error
          } else if (fileTypeToSync === 'factset') {
            await supabase.from('factset_data_v2').delete().neq('Ticker', '')
            const batchSize = 500
            for (let i = 0; i < parsedRecords.length; i += batchSize) {
              const { error } = await supabase.from('factset_data_v2').insert(parsedRecords.slice(i, i + batchSize))
              if (error) throw error
            }
          } else if (fileTypeToSync === 'weightings') {
            await supabase.from('weightings_universe').delete().neq('Ticker', '')
            const batchSize = 500
            for (let i = 0; i < parsedRecords.length; i += batchSize) {
              const { error } = await supabase.from('weightings_universe').insert(parsedRecords.slice(i, i + batchSize))
              if (error) throw error
            }
          } else if (fileTypeToSync === 'gic_yahoo') {
            await supabase.from('gics_yahoo_finance').delete().neq('Ticker', '')
            const batchSize = 500
            for (let i = 0; i < parsedRecords.length; i += batchSize) {
              const { error } = await supabase.from('gics_yahoo_finance').insert(parsedRecords.slice(i, i + batchSize))
              if (error) throw error
            }
          }

          console.log(`✓ Saved ${parsedRowCount} records to database`)
          
          return {
            file: fileName,
            tab: tabName,
            rowsProcessed: parsedRowCount,
            status: 'success' as const
          }

        } catch (error) {
          console.error(`✗ Error syncing ${fileTypeToSync}:`, error)
          return {
            file: fileTypeToSync,
            tab: 'N/A',
            rowsProcessed: 0,
            status: 'error' as const,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      })

      results.push(result)
      if (result.status === 'success') {
        totalRows += result.rowsProcessed
      }
    }

    // Log to sync_history
    await step.run('log-sync-history', async () => {
      const supabase = createServiceRoleClient()
      const duration = Date.now() - startTime
      const successCount = results.filter(r => r.status === 'success').length
      const status = successCount === filesToSync.length ? 'success' : 
                     successCount > 0 ? 'partial' : 'failed'

      await supabase.from('sync_history').insert({
        sync_date: new Date().toISOString(),
        sync_type: 'manual',
        file_type: fileType || 'all',
        status,
        files_synced: results,
        total_rows: totalRows,
        duration_ms: duration,
        triggered_by: 'inngest-manual',
      })

      console.log(`\n${'='.repeat(60)}`)
      console.log(`Inngest: Manual Sync Complete`)
      console.log(`Status: ${status}`)
      console.log(`Total Rows: ${totalRows}`)
      console.log(`Duration: ${(duration / 1000).toFixed(1)}s`)
      console.log(`${'='.repeat(60)}\n`)
    })

    return {
      success: true,
      results,
      summary: {
        totalFiles: filesToSync.length,
        successfulFiles: results.filter(r => r.status === 'success').length,
        failedFiles: results.filter(r => r.status === 'error').length,
        totalRows,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }
    }
  }
)
