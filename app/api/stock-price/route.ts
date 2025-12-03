// Stock Price API Route - Fetch real-time stock price for Trading Tab
import { NextRequest, NextResponse } from 'next/server'
import { fetchQuote } from '@/lib/services/yahooFinance'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ticker = searchParams.get('ticker')

    if (!ticker) {
      return NextResponse.json(
        { success: false, message: 'Ticker parameter is required' },
        { status: 400 }
      )
    }

    console.log(`Fetching price for ${ticker}...`)

    const priceData = await fetchQuote(ticker)

    if (!priceData) {
      return NextResponse.json(
        { success: false, message: `No price data available for ${ticker}` },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        ticker: priceData.ticker,
        price: priceData.currentPrice,
        previousClose: priceData.previousClose,
        change: priceData.change,
        changePercent: priceData.changePercent,
        timestamp: priceData.timestamp
      }
    })

  } catch (error) {
    console.error('Stock price API error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch stock price'
      },
      { status: 500 }
    )
  }
}
