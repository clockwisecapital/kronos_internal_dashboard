// CSV Upload API Route

import { NextRequest, NextResponse } from 'next/server'
import { parseCSVWithClaude, validateParsedData } from '@/lib/api/claude'
import { CSVFileType, UploadResponse, HoldingRecord } from '@/lib/types/csv'
import { smartDetectFileType } from '@/lib/utils/detectFileType'
import { createClient } from '@/app/utils/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    let fileType = formData.get('fileType') as CSVFileType
    const fileName = formData.get('fileName') as string || file.name

    // Validate inputs
    if (!file) {
      return NextResponse.json<UploadResponse>(
        { success: false, message: 'No file provided', error: 'Missing file' },
        { status: 400 }
      )
    }

    if (!fileType) {
      return NextResponse.json<UploadResponse>(
        { success: false, message: 'No file type specified', error: 'Missing fileType' },
        { status: 400 }
      )
    }

    // Validate file extension
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json<UploadResponse>(
        { success: false, message: 'Only CSV files are accepted', error: 'Invalid file type' },
        { status: 400 }
      )
    }

    // Read file content
    const csvContent = await file.text()

    if (!csvContent || csvContent.trim().length === 0) {
      return NextResponse.json<UploadResponse>(
        { success: false, message: 'File is empty', error: 'Empty file' },
        { status: 400 }
      )
    }

    // Auto-detect file type if 'any' was selected
    if (fileType === 'any') {
      const detectedType = smartDetectFileType(fileName, csvContent)
      if (!detectedType) {
        return NextResponse.json<UploadResponse>(
          { 
            success: false, 
            message: 'Could not auto-detect file type', 
            error: 'Unable to determine CSV type from filename or content. Please select a specific file type.' 
          },
          { status: 400 }
        )
      }
      fileType = detectedType
      console.log(`Auto-detected file type: ${fileType} from ${fileName}`)
    }

    // OPTIMIZATION: For weightings, filter to only holdings tickers BEFORE parsing
    let filteredCsvContent = csvContent
    if (fileType === 'weightings') {
      const supabase = await createClient()
      
      // Get current holdings tickers
      const { data: holdingsData, error: holdingsError } = await supabase
        .from('holdings')
        .select('stock_ticker')
      
      if (holdingsError) {
        console.warn('Could not fetch holdings for filtering:', holdingsError.message)
        // Continue without filtering
      } else if (holdingsData && holdingsData.length > 0) {
        // Extract unique tickers
        const holdingsTickers = new Set(
          holdingsData.map(h => h.stock_ticker.toUpperCase())
        )
        
        console.log(`Filtering weightings CSV to ${holdingsTickers.size} holdings tickers`)
        
        // Filter CSV to only rows matching holdings tickers
        const lines = csvContent.split('\n')
        const header = lines[0]
        const filteredLines = lines.slice(1).filter(line => {
          const ticker = line.split(',')[0]?.trim().toUpperCase()
          return holdingsTickers.has(ticker)
        })
        
        filteredCsvContent = [header, ...filteredLines].join('\n')
        console.log(`Filtered CSV from ${lines.length - 1} to ${filteredLines.length} rows (${((filteredLines.length / (lines.length - 1)) * 100).toFixed(1)}% of original)`)
      }
    }

    // Parse CSV using Claude API
    console.log(`Parsing ${fileType} CSV: ${fileName}`)
    const parsedData = await parseCSVWithClaude(filteredCsvContent, fileType)

    // Validate parsed data
    const validation = validateParsedData(parsedData, fileType)
    
    if (!validation.valid) {
      return NextResponse.json<UploadResponse>(
        {
          success: false,
          message: 'CSV validation failed',
          error: validation.errors.join(', '),
          preview: parsedData
        },
        { status: 400 }
      )
    }

    // Store in Supabase
    const uploadId = crypto.randomUUID()
    const supabase = await createClient()

    console.log(`Successfully parsed ${parsedData.rowCount} rows from ${fileName}`)

    // Save to appropriate table based on file type
    if (fileType === 'holdings') {
      // Delete existing holdings to avoid duplicates (CSV represents current state)
      const { error: deleteError } = await supabase
        .from('holdings')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all records

      if (deleteError) {
        console.error('Supabase delete error:', deleteError)
        throw new Error(`Failed to clear existing holdings: ${deleteError.message}`)
      }

      console.log('Cleared existing holdings')

      // Check for duplicate tickers
      const holdingsRecords = parsedData.records as HoldingRecord[]
      const tickers = holdingsRecords.map(r => r.stock_ticker)
      const uniqueTickers = new Set(tickers)
      if (tickers.length !== uniqueTickers.size) {
        console.warn(`⚠️ Found ${tickers.length - uniqueTickers.size} duplicate tickers in CSV`)
        console.warn('Duplicate tickers:', tickers.filter((t: string, i: number) => tickers.indexOf(t) !== i))
      }

      // Insert new holdings
      const { error: insertError, data: insertedData } = await supabase
        .from('holdings')
        .insert(parsedData.records)
        .select()

      if (insertError) {
        console.error('Supabase insert error:', insertError)
        throw new Error(`Failed to save to database: ${insertError.message}`)
      }

      console.log(`Saved ${insertedData?.length || parsedData.rowCount} holdings to database (parsed: ${parsedData.rowCount})`)
      
      if (insertedData && insertedData.length !== parsedData.rowCount) {
        console.warn(`⚠️ Mismatch: Parsed ${parsedData.rowCount} rows but only saved ${insertedData.length}`)
      }
    } else if (fileType === 'weightings') {
      // Weightings were already filtered before parsing (see lines 66-98)
      // Delete existing weightings to avoid duplicates (CSV represents current state)
      const { error: deleteError } = await supabase
        .from('weightings')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all records

      if (deleteError) {
        console.error('Supabase delete error:', deleteError)
        throw new Error(`Failed to clear existing weightings: ${deleteError.message}`)
      }

      console.log('Cleared existing weightings')

      // Insert new weightings in batches (Supabase limit: ~1000 per request)
      // For 700+ rows, use batch size of 500 to be safe (though we filtered to ~35)
      const batchSize = 500
      const batches = []
      
      for (let i = 0; i < parsedData.records.length; i += batchSize) {
        batches.push(parsedData.records.slice(i, i + batchSize))
      }

      console.log(`Inserting ${parsedData.records.length} weightings in ${batches.length} batch(es)`)

      let totalInserted = 0
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]
        const { error: insertError, data: insertedData } = await supabase
          .from('weightings')
          .insert(batch)
          .select()

        if (insertError) {
          console.error(`Supabase insert error (batch ${i + 1}/${batches.length}):`, insertError)
          throw new Error(`Failed to save batch ${i + 1} to database: ${insertError.message}`)
        }

        totalInserted += insertedData?.length || 0
        console.log(`Batch ${i + 1}/${batches.length}: Inserted ${insertedData?.length} records`)
      }

      console.log(`Saved ${totalInserted} weightings to database (parsed: ${parsedData.rowCount})`)
      
      if (totalInserted !== parsedData.rowCount) {
        console.warn(`⚠️ Mismatch: Parsed ${parsedData.rowCount} rows but only saved ${totalInserted}`)
      }
    }
    // Add other file types as tables are created
    // else if (fileType === 'benchmarks') { ... }
    // else if (fileType === 'fundamentals') { ... }

    return NextResponse.json<UploadResponse>({
      success: true,
      uploadId,
      message: `Successfully parsed ${parsedData.rowCount} records`,
      fileType,
      fileName,
      preview: {
        ...parsedData,
        records: parsedData.records.slice(0, 10) // Only return first 10 for preview
      }
    })

  } catch (error) {
    console.error('Upload error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return NextResponse.json<UploadResponse>(
      {
        success: false,
        message: 'Upload failed',
        error: errorMessage
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
