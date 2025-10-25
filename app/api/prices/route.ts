// API Route to Fetch Real-Time Prices for Holdings

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/utils/supabase/server'
import { fetchQuotesInBatches } from '@/lib/services/yahooFinance'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get all unique tickers from holdings
    const { data: holdings, error } = await supabase
      .from('holdings')
      .select('stock_ticker')
    
    if (error) {
      throw new Error(`Failed to fetch holdings: ${error.message}`)
    }

    if (!holdings || holdings.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No holdings found',
        prices: []
      })
    }

    // Extract unique tickers
    const uniqueTickers = [...new Set(holdings.map(h => h.stock_ticker))]
    console.log(`Fetching prices for ${uniqueTickers.length} unique tickers`)

    // Fetch prices in batches (10 at a time to avoid rate limiting)
    const prices = await fetchQuotesInBatches(uniqueTickers, 10)

    console.log(`Successfully fetched ${prices.length} prices`)

    return NextResponse.json({
      success: true,
      message: `Fetched ${prices.length} prices`,
      prices,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Prices API error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch prices',
        prices: []
      },
      { status: 500 }
    )
  }
}

// POST endpoint to fetch prices for specific tickers
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tickers } = body

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid request: tickers array required'
        },
        { status: 400 }
      )
    }

    console.log(`Fetching prices for ${tickers.length} specified tickers`)

    // Fetch prices
    const prices = await fetchQuotesInBatches(tickers, 10)

    return NextResponse.json({
      success: true,
      message: `Fetched ${prices.length} prices`,
      prices,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Prices API error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch prices',
        prices: []
      },
      { status: 500 }
    )
  }
}
