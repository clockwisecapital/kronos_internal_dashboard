// VIX API Route - Real-time CBOE Volatility Index data from Yahoo Finance
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface VIXData {
  level: number
  dailyChange: number
  changePercent: number
  classification: 'Low Volatility' | 'Moderate Volatility' | 'High Volatility'
  color: 'green' | 'yellow' | 'red'
  previousClose: number
}

/**
 * Fetch VIX data from Yahoo Finance
 * Ticker: ^VIX (CBOE Volatility Index)
 */
async function fetchVIXFromYahoo(): Promise<VIXData | null> {
  try {
    const ticker = '^VIX'
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    })

    if (!response.ok) {
      console.error('Failed to fetch VIX data from Yahoo Finance')
      return null
    }

    const data = await response.json()
    
    const result = data.chart?.result?.[0]
    if (!result) {
      console.error('No VIX data in response')
      return null
    }

    // Get current price and previous close
    const quote = result.meta
    const currentPrice = quote.regularMarketPrice
    const previousClose = quote.chartPreviousClose || quote.previousClose
    
    if (!currentPrice || !previousClose) {
      console.error('Missing price data for VIX')
      return null
    }

    // Calculate daily change
    const dailyChange = currentPrice - previousClose
    const changePercent = (dailyChange / previousClose) * 100

    // Classify based on VIX level
    let classification: 'Low Volatility' | 'Moderate Volatility' | 'High Volatility'
    let color: 'green' | 'yellow' | 'red'

    if (currentPrice < 20) {
      classification = 'Low Volatility'
      color = 'green'
    } else if (currentPrice >= 20 && currentPrice <= 30) {
      classification = 'Moderate Volatility'
      color = 'yellow'
    } else {
      classification = 'High Volatility'
      color = 'red'
    }

    return {
      level: currentPrice,
      dailyChange,
      changePercent,
      classification,
      color,
      previousClose
    }

  } catch (error) {
    console.error('Error fetching VIX data:', error)
    return null
  }
}

export async function GET() {
  try {
    console.log('=== VIX API: Fetching real-time data ===')
    
    const vixData = await fetchVIXFromYahoo()

    if (!vixData) {
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to fetch VIX data'
        },
        { status: 500 }
      )
    }

    console.log(`VIX Level: ${vixData.level.toFixed(2)} (${vixData.classification})`)

    return NextResponse.json({
      success: true,
      data: vixData,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('VIX API error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch VIX data'
      },
      { status: 500 }
    )
  }
}
