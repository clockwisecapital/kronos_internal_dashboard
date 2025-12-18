import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/app/utils/supabase/service-role'
import {
  extractIndividualMetrics,
  calculatePercentileScores,
  calculateCompositeScores,
  calculateTotalScore,
  parseScoreWeightings,
  type FactSetData,
  type ScoreWeights,
  type StockScore
} from '@/lib/calculators/scoring'
import { fetchHistoricalPricesForScoring } from '@/lib/services/yahooFinance'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for complex calculations

interface HoldingData {
  stock_ticker: string
  shares: number
  market_value: number
}

interface BenchmarkWeighting {
  ticker: string
  spy: number | null
  qqq: number | null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const profile = searchParams.get('profile') || 'BASE'
    
    console.log(`=== Scoring API: Starting calculation for profile ${profile} ===`)
    
    const supabase = createServiceRoleClient()
    
    // 1. Fetch latest holdings
    console.log('Step 1: Fetching holdings...')
    const { data: holdingsDateData } = await supabase
      .from('holdings')
      .select('date')
      .order('date', { ascending: false })
      .limit(1)
    
    if (!holdingsDateData || holdingsDateData.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No holdings data available'
      }, { status: 404 })
    }
    
    const latestDate = holdingsDateData[0].date
    
    const { data: holdings, error: holdingsError } = await supabase
      .from('holdings')
      .select('stock_ticker, shares, market_value')
      .eq('date', latestDate)
    
    if (holdingsError || !holdings || holdings.length === 0) {
      throw new Error('Failed to fetch holdings')
    }
    
    // Deduplicate holdings
    const uniqueHoldings = new Map<string, HoldingData>()
    holdings.forEach((h: HoldingData) => {
      if (!uniqueHoldings.has(h.stock_ticker)) {
        uniqueHoldings.set(h.stock_ticker, h)
      }
    })
    
    const holdingsArray = Array.from(uniqueHoldings.values())
    const tickers = holdingsArray.map(h => h.stock_ticker)
    
    console.log(`Loaded ${holdingsArray.length} unique holdings`)
    
    // 2. Fetch FactSet data for all scoring metrics
    console.log('Step 2: Fetching FactSet data...')
    const { data: factsetData, error: factsetError } = await supabase
      .from('factset_data_v2')
      .select(`
        "Ticker",
        "EPS EST NTM",
        "EPS EST NTM - 30 days ago",
        "EPS surprise last qtr",
        "Sales LTM",
        "Sales EST NTM",
        "SALES EST NTM - 30 days ago",
        "SALES surprise last qtr",
        "EBITDA LTM",
        "PRICE",
        "Gross Profit LTM",
        "ROIC 1 YR",
        "ROIC  3YR",
        "acrcrurals %",
        "FCF",
        "Consensus Price Target",
        "Total assets",
        "1 month volatility",
        "3 yr beta",
        "EV/EBITDA - NTM",
        "EV/Sales - NTM",
        "P/E NTM",
        "52 week high"
      `)
      .in('Ticker', tickers)
    
    if (factsetError) {
      console.error('FactSet fetch error:', factsetError)
    }
    
    const factsetMap = new Map<string, FactSetData>()
    factsetData?.forEach((row: any) => {
      factsetMap.set(row.Ticker.toUpperCase(), row as FactSetData)
    })
    
    console.log(`Loaded FactSet data for ${factsetMap.size} tickers`)
    
    // 3. Fetch benchmark weightings
    console.log('Step 3: Fetching benchmark weightings...')
    const { data: weightingsData } = await supabase
      .from('weightings')
      .select('ticker, spy, qqq')
      .in('ticker', tickers)
    
    const weightingsMap = new Map<string, BenchmarkWeighting>()
    weightingsData?.forEach((w: BenchmarkWeighting) => {
      weightingsMap.set(w.ticker.toUpperCase(), w)
    })
    
    // 4. Fetch score weightings configuration
    console.log('Step 4: Fetching score weightings...')
    const { data: scoreWeightingsData, error: scoreWeightingsError } = await supabase
      .from('score_weightings')
      .select('profile_name, category, metric_name, metric_weight, category_weight')
      .eq('profile_name', profile)
    
    if (scoreWeightingsError || !scoreWeightingsData || scoreWeightingsData.length === 0) {
      throw new Error(`Failed to fetch score weightings for profile ${profile}`)
    }
    
    const { weights, categoryWeights } = parseScoreWeightings(
      scoreWeightingsData as ScoreWeights[],
      profile
    )
    
    console.log(`Loaded weightings for profile ${profile}`)
    
    // 5. Fetch historical prices from Yahoo Finance
    console.log('Step 5: Fetching historical prices from Yahoo Finance...')
    const historicalPricesPromises = tickers.map(ticker =>
      fetchHistoricalPricesForScoring(ticker)
        .then(data => ({ ticker, data }))
        .catch(error => {
          console.error(`Failed to fetch historical prices for ${ticker}:`, error)
          return {
            ticker,
            data: {
              currentPrice: 0,
              price30DaysAgo: null,
              price90DaysAgo: null,
              price365DaysAgo: null,
              maxDrawdown: null
            }
          }
        })
    )
    
    const historicalPricesResults = await Promise.all(historicalPricesPromises)
    const historicalPricesMap = new Map(
      historicalPricesResults.map(r => [r.ticker.toUpperCase(), r.data])
    )
    
    console.log(`Fetched historical prices for ${historicalPricesMap.size} tickers`)
    
    // 6. Extract individual metrics for all holdings
    console.log('Step 6: Extracting individual metrics...')
    const allMetrics = holdingsArray
      .map(holding => {
        const ticker = holding.stock_ticker.toUpperCase()
        const factset = factsetMap.get(ticker)
        const yahoo = historicalPricesMap.get(ticker)
        
        if (!factset || !yahoo) {
          console.warn(`Missing data for ${ticker}`)
          return null
        }
        
        return {
          ticker: holding.stock_ticker,
          ...extractIndividualMetrics(factset, yahoo)
        }
      })
      .filter(m => m !== null) as Array<{ ticker: string } & ReturnType<typeof extractIndividualMetrics>>
    
    console.log(`Extracted metrics for ${allMetrics.length} holdings`)
    
    // 7. Calculate percentile scores
    console.log('Step 7: Calculating percentile scores...')
    const metricsOnly = allMetrics.map(({ ticker, ...metrics }) => metrics)
    const scoredMetrics = calculatePercentileScores(metricsOnly)
    
    // 8. Calculate composite and total scores
    console.log('Step 8: Calculating composite and total scores...')
    const finalScores: StockScore[] = allMetrics.map((holding, index) => {
      const scored = scoredMetrics[index]
      const composites = calculateCompositeScores(scored, weights)
      const total = calculateTotalScore(composites, categoryWeights)
      
      return {
        ticker: holding.ticker,
        ...scored,
        ...composites,
        ...total
      }
    })
    
    // 9. Enrich with holding and benchmark data
    console.log('Step 9: Enriching with holding and benchmark data...')
    const enrichedScores = finalScores.map(score => {
      const holding = uniqueHoldings.get(score.ticker)
      const weighting = weightingsMap.get(score.ticker.toUpperCase())
      
      return {
        ...score,
        shares: holding?.shares || 0,
        marketValue: holding?.market_value || 0,
        spyWeight: weighting?.spy || null,
        qqqWeight: weighting?.qqq || null
      }
    })
    
    // Sort by total score (descending)
    enrichedScores.sort((a, b) => {
      if (a.totalScore === null) return 1
      if (b.totalScore === null) return -1
      return b.totalScore - a.totalScore
    })
    
    console.log(`=== Scoring API: Completed successfully ===`)
    
    return NextResponse.json({
      success: true,
      profile,
      data: enrichedScores,
      metadata: {
        holdingsCount: enrichedScores.length,
        holdingsDate: latestDate,
        calculatedAt: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('Scoring API error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to calculate scores'
      },
      { status: 500 }
    )
  }
}

