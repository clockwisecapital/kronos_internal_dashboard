// FactSet Prices API Route
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/app/utils/supabase/service-role'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    console.log('Fetching target prices and current prices from FactSet...')
    const supabase = createServiceRoleClient()

    // Fetch target prices and current prices from FactSet (bypasses RLS with service role key)
    const { data, error } = await supabase
      .from('factset_data_v2')
      .select('"Ticker", "Consensus Price Target", "PRICE"')

    if (error) {
      console.error('FactSet prices API error:', error)
      throw error
    }

    console.log(`FactSet Prices API: Loaded ${data?.length || 0} records`)

    // Process the data to return clean objects
    const processedData = (data || []).map(row => {
      const ticker = row.Ticker?.trim().toUpperCase() || ''
      const targetPriceStr = row['Consensus Price Target']
      const currentPriceStr = row['PRICE']
      
      let targetPrice: number | null = null
      if (targetPriceStr && targetPriceStr !== '#N/A' && targetPriceStr !== 'N/A' && targetPriceStr !== '') {
        const parsed = parseFloat(String(targetPriceStr).replace(/[^0-9.-]/g, ''))
        if (!isNaN(parsed) && parsed > 0) {
          targetPrice = parsed
        }
      }
      
      let currentPrice: number | null = null
      if (currentPriceStr && currentPriceStr !== '#N/A' && currentPriceStr !== 'N/A' && currentPriceStr !== '') {
        const parsed = parseFloat(String(currentPriceStr).replace(/[^0-9.-]/g, ''))
        if (!isNaN(parsed) && parsed > 0) {
          currentPrice = parsed
        }
      }
      
      return {
        ticker,
        targetPrice,
        currentPrice
      }
    })

    return NextResponse.json({
      success: true,
      data: processedData,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('FactSet Prices API error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch FactSet prices',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}




