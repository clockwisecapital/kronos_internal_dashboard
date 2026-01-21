// Holdings API Route - Returns holdings data for Trading Tab
import { NextResponse } from 'next/server'
import { createClient } from '@/app/utils/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = await createClient()

    // Get the most recent holdings date
    const { data: dateData, error: dateError } = await supabase
      .from('holdings')
      .select('date')
      .order('date', { ascending: false })
      .limit(1)

    if (dateError) {
      throw new Error(`Failed to fetch holdings date: ${dateError.message}`)
    }

    if (!dateData || dateData.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No holdings data available'
      }, { status: 404 })
    }

    const latestDate = dateData[0].date

    // Fetch holdings from the most recent date
    const { data: holdings, error: holdingsError } = await supabase
      .from('holdings')
      .select('*')
      .eq('date', latestDate)
      .order('market_value', { ascending: false })
      .limit(5000)

    if (holdingsError) {
      throw new Error(`Failed to fetch holdings: ${holdingsError.message}`)
    }

    if (!holdings || holdings.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No holdings data available'
      }, { status: 404 })
    }

    // Deduplicate by ticker (keep first occurrence)
    const uniqueHoldingsMap = new Map()
    holdings.forEach(h => {
      if (!uniqueHoldingsMap.has(h.stock_ticker)) {
        uniqueHoldingsMap.set(h.stock_ticker, h)
      }
    })

    const deduplicatedHoldings = Array.from(uniqueHoldingsMap.values())

    console.log(`Holdings API: Loaded ${deduplicatedHoldings.length} holdings from date: ${latestDate}`)

    return NextResponse.json({
      success: true,
      data: deduplicatedHoldings,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Holdings API error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch holdings data'
      },
      { status: 500 }
    )
  }
}
