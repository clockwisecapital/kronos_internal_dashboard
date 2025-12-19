// Comprehensive Ticker View API - Aggregates data from all sources
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/app/utils/supabase/service-role'
import { createClient } from '@/app/utils/supabase/server'
import { fetchQuote } from '@/lib/services/yahooFinance'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const ticker = searchParams.get('ticker')?.toUpperCase()
    
    if (!ticker) {
      return NextResponse.json({
        success: false,
        message: 'Ticker parameter is required'
      }, { status: 400 })
    }

    console.log(`Fetching comprehensive data for ticker: ${ticker}`)
    const supabase = createServiceRoleClient()
    const serverSupabase = await createClient()

    // 1. Get latest holdings date
    const { data: dateData } = await supabase
      .from('holdings')
      .select('date')
      .order('date', { ascending: false })
      .limit(1)

    const latestDate = dateData && dateData.length > 0 ? dateData[0].date : null

    // 2. Fetch Holdings data (Weight, Shares, Market Value)
    let holdingData = null
    if (latestDate) {
      const { data: holding } = await supabase
        .from('holdings')
        .select('*')
        .eq('stock_ticker', ticker)
        .eq('date', latestDate)
        .single()
      
      holdingData = holding
    }

    // 3. Fetch Net Weight data from portfolio API
    let netWeightData = null
    try {
      const portResponse = await fetch(`${request.url.split('/api/')[0]}/api/portfolio`, {
        cache: 'no-store'
      })
      if (portResponse.ok) {
        const portResult = await portResponse.json()
        if (portResult.success && portResult.data?.rows) {
          netWeightData = portResult.data.rows.find((r: any) => r.ticker === ticker)
        }
      }
    } catch (error) {
      console.warn('Could not fetch net weight data:', error)
    }

    // 4. Fetch Universe data (Target Weight, Sector info)
    const { data: universeData } = await supabase
      .from('universe')
      .select('*')
      .eq('ticker', ticker)
      .single()

    // 5. Fetch Current Price from Yahoo Finance
    let priceData = null
    try {
      priceData = await fetchQuote(ticker)
    } catch (error) {
      console.warn(`Could not fetch price for ${ticker}:`, error)
    }

    // 6. Fetch Target Price
    const { data: targetPriceData } = await supabase
      .from('tgt_prices')
      .select('*')
      .eq('ticker', ticker)
      .single()

    // 7. Fetch ETF Weights (All indexes)
    const { data: weightingsData } = await supabase
      .from('weightings_universe')
      .select('*')
      .eq('Ticker', ticker)
      .single()

    // 8. Fetch FactSet data (Betas, Earnings, Valuations)
    const { data: factsetData } = await supabase
      .from('factset_data_v2')
      .select('*')
      .eq('Ticker', ticker)
      .single()

    // 9. Fetch Performance data
    let performanceData = null
    try {
      const perfResponse = await fetch(`${request.url.split('/api/')[0]}/api/performance`, {
        cache: 'no-store'
      })
      if (perfResponse.ok) {
        const perfResult = await perfResponse.json()
        if (perfResult.success && perfResult.data?.holdings) {
          performanceData = perfResult.data.holdings.find((h: any) => h.ticker === ticker)
        }
      }
    } catch (error) {
      console.warn('Could not fetch performance data:', error)
    }

    // 10. Calculate additional metrics
    const currentPrice = priceData?.currentPrice || holdingData?.close_price || null
    const previousClose = priceData?.previousClose || holdingData?.close_price || null
    const priceChange = currentPrice && previousClose ? 
      ((currentPrice - previousClose) / previousClose) * 100 : null

    const targetPrice = targetPriceData?.target_price || 
      (factsetData ? parseFloat(factsetData['Consensus Price Target']) : null)
    
    const upside = currentPrice && targetPrice ?
      ((targetPrice - currentPrice) / currentPrice) * 100 : null

    // 11. Prepare index membership data
    const indexWeights: Record<string, number> = {}
    if (weightingsData) {
      const etfColumns = ['SPY', 'QQQ', 'DIA', 'XLK', 'XLF', 'XLC', 'XLY', 'XLP', 
                          'XLE', 'XLV', 'XLI', 'XLB', 'XLRE', 'XLU', 'SOXX', 'SMH', 'ARKK']
      
      etfColumns.forEach(col => {
        const value = weightingsData[col]
        if (value && value !== '-' && value !== '') {
          indexWeights[col] = parseFloat(value)
        }
      })
    }

    // 12. Format response
    const response = {
      ticker,
      name: weightingsData?.Name || factsetData?.['Company Name'] || holdingData?.security_name || ticker,
      isClockwiseHolding: !!holdingData,
      
      // Basic KPIs
      weight: holdingData ? (holdingData.market_value / (holdingData.net_assets || 1)) * 100 : null,
      netWeight: netWeightData?.net_weight || null,
      targetWeight: universeData?.target_weight || null,
      price: currentPrice,
      priceChange,
      targetPrice,
      upside,
      qqqWeight: indexWeights['QQQ'] || null,
      spyWeight: indexWeights['SPY'] || null,
      
      // Holding details
      shares: holdingData?.shares || null,
      marketValue: holdingData?.market_value || null,
      
      // True Beta & Risk
      beta1yr: factsetData ? parseFloat(factsetData['1 yr Beta']) : null,
      beta3yr: factsetData ? parseFloat(factsetData['3 yr beta']) : null,
      beta5yr: factsetData ? parseFloat(factsetData['5 yr beta - monthly']) : null,
      trueBeta: universeData?.true_beta || null,
      earningsDate: factsetData?.['Next Earnings Date'] || null,
      earningsTime: factsetData?.['Next Earnings Date Time of day'] || null,
      
      // Index Membership
      indexWeights,
      
      // Performance
      performance: performanceData || null,
      
      // Valuation Metrics
      factset: factsetData || null,
      
      // Universe/Sector Data
      universe: universeData || null,
    }

    console.log(`Successfully aggregated data for ${ticker}`)

    return NextResponse.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Ticker View API error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch ticker data',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

