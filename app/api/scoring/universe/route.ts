import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/app/utils/supabase/service-role'
import {
  extractIndividualMetrics,
  calculatePercentileRank,
  calculateCompositeScores,
  calculateTotalScore,
  parseScoreWeightings,
  calculateBenchmarkRelativeScores,
  calculateBenchmarkConstituentScores,
  type FactSetData,
  type ScoreWeights,
  type StockScore,
  type IndividualMetrics
} from '@/lib/calculators/scoring'
import { fetchHistoricalPricesForScoring } from '@/lib/services/yahooFinance'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for complex calculations

interface GicsBenchmarkData {
  Ticker: string
  BENCHMARK1: string | null
  BENCHMARK2: string | null
  BENCHMARK3: string | null
  BENCHMARK_CUSTOM: string | null
}

/**
 * Fetch benchmark constituents from weightings_universe table
 * Returns tickers that have a non-null weight in the specified benchmark
 */
async function fetchBenchmarkConstituents(
  supabase: any,
  benchmarkTicker: string
): Promise<string[]> {
  // Normalize to uppercase for consistency
  const normalizedTicker = benchmarkTicker.toUpperCase()
  
  // Map benchmark ticker to column name in weightings_universe
  const columnMap: Record<string, string> = {
    'SPY': 'SPY',
    'QQQ': 'QQQ',
    'SOXX': 'SOXX',
    'SMH': 'SMH',
    'ARKK': 'ARKK',
    'XLK': 'XLK',
    'XLF': 'XLF',
    'XLC': 'XLC',
    'XLY': 'XLY',
    'XLP': 'XLP',
    'XLE': 'XLE',
    'XLV': 'XLV',
    'XLI': 'XLI',
    'XLB': 'XLB',
    'XLRE': 'XLRE',
    'XLU': 'XLU',
    'IGV': 'IGV',
    'ITA': 'ITA'
  }
  
  const columnName = columnMap[normalizedTicker]
  
  if (!columnName) {
    console.warn(`Benchmark ${normalizedTicker} not found in weightings_universe columns`)
    return []
  }
  
  try {
    const { data, error } = await supabase
      .from('weightings_universe')
      .select(`"Ticker", "${columnName}"`)
      .not(columnName, 'is', null)
    
    if (error) {
      console.error(`Error fetching constituents for ${normalizedTicker}:`, error)
      return []
    }
    
    const constituents = (data || [])
      .filter((row: any) => row[columnName] && row[columnName] !== '-')
      .map((row: any) => row.Ticker)
    
    console.log(`Found ${constituents.length} constituents for ${normalizedTicker}`)
    return constituents
  } catch (error) {
    console.error(`Exception fetching constituents for ${normalizedTicker}:`, error)
    return []
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const profile = searchParams.get('profile') || 'BASE'
    const benchmarkColumn = (searchParams.get('benchmark') || 'BENCHMARK1') as 'BENCHMARK1' | 'BENCHMARK2' | 'BENCHMARK3' | 'BENCHMARK_CUSTOM'
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')
    
    console.log('=== Universe Scoring API: Starting ===')
    console.log(`Profile: ${profile}, Benchmark: ${benchmarkColumn}, Page: ${page}, PageSize: ${pageSize}`)
    
    const supabase = createServiceRoleClient()
    
    console.log('Getting total universe count...')
    const { count: totalCount } = await supabase
      .from('factset_data_v2')
      .select('*', { count: 'exact', head: true })
    
    const totalPages = Math.ceil((totalCount || 0) / pageSize)
    console.log(`Total universe tickers: ${totalCount}, Total pages: ${totalPages}`)
    
    console.log('Fetching all universe data for percentile calculations...')
    const { data: universeData, error: universeError } = await supabase
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
        "3 yr beta"
      `)
    
    if (universeError) {
      console.error('Universe data fetch error:', universeError)
      return NextResponse.json({ error: 'Failed to fetch universe data' }, { status: 500 })
    }
    
    console.log(`Loaded ${universeData?.length || 0} universe tickers for percentile calculation`)
    
    // Extract metrics from all universe tickers
    const dummyYahoo = { currentPrice: 0, price30DaysAgo: null, price90DaysAgo: null, price365DaysAgo: null, maxDrawdown: null }
    const universeMetrics = (universeData || []).map(ticker => 
      extractIndividualMetrics(ticker as FactSetData, dummyYahoo)
    )
    
    // Extract universe-wide metric arrays for percentile calculation
    const universeTargetPrices = universeMetrics.map(m => m.targetPriceUpside)
    const universeEpsSurprises = universeMetrics.map(m => m.epsSurprise)
    const universeRevSurprises = universeMetrics.map(m => m.revSurprise)
    const universeNtmEpsChanges = universeMetrics.map(m => m.ntmEpsChange)
    const universeNtmRevChanges = universeMetrics.map(m => m.ntmRevChange)
    const universeRoicTTMs = universeMetrics.map(m => m.roicTTM)
    const universeGrossProfitabilities = universeMetrics.map(m => m.grossProfitability)
    const universeAccruals = universeMetrics.map(m => m.accruals)
    const universeFcfToAssets = universeMetrics.map(m => m.fcfToAssets)
    const universeRoic3Yrs = universeMetrics.map(m => m.roic3Yr)
    const universeEbitdaMargins = universeMetrics.map(m => m.ebitdaMargin)
    
    // Also extract VALUE, MOMENTUM, RISK metrics for fallback
    const universePeRatios = universeMetrics.map(m => m.peRatio)
    const universeEvEbitdas = universeMetrics.map(m => m.evEbitda)
    const universeEvSales = universeMetrics.map(m => m.evSales)
    const universeReturn12MEx1Ms = universeMetrics.map(m => m.return12MEx1M)
    const universeReturn3Ms = universeMetrics.map(m => m.return3M)
    const universePct52WeekHighs = universeMetrics.map(m => m.pct52WeekHigh)
    const universeBeta3Yrs = universeMetrics.map(m => m.beta3Yr)
    const universeVolatility30Days = universeMetrics.map(m => m.volatility30Day)
    const universeMaxDrawdowns = universeMetrics.map(m => m.maxDrawdown)
    
    console.log(`Step 3: Fetching page ${page} tickers...`)
    const offset = (page - 1) * pageSize
    const { data: pageData, error: pageError } = await supabase
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
      .range(offset, offset + pageSize - 1)
      .order('Ticker', { ascending: true })
    
    if (pageError) {
      console.error('Page data fetch error:', pageError)
      return NextResponse.json({ error: 'Failed to fetch page data' }, { status: 500 })
    }
    
    console.log(`Loaded ${pageData?.length || 0} tickers for page ${page}`)
    
    const pageTickers = pageData?.map(row => row.Ticker) || []
    
    console.log('Fetching GICS benchmark data for page tickers...')
    const { data: gicsBenchmarkData } = await supabase
      .from('gics_yahoo_finance')
      .select('"Ticker", "BENCHMARK1", "BENCHMARK2", "BENCHMARK3", "BENCHMARK_CUSTOM"')
      .in('"Ticker"', pageTickers)
    
    const gicsBenchmarkMap = new Map<string, GicsBenchmarkData>()
    gicsBenchmarkData?.forEach((g: GicsBenchmarkData) => {
      gicsBenchmarkMap.set(g.Ticker.toUpperCase(), g)
    })
    
    console.log(`Loaded GICS benchmark data for ${gicsBenchmarkMap.size} tickers`)
    
    console.log('Fetching benchmark ETF data...')
    const uniqueBenchmarks = new Set<string>()
    gicsBenchmarkData?.forEach((g: GicsBenchmarkData) => {
      if (g.BENCHMARK1) uniqueBenchmarks.add(g.BENCHMARK1)
      if (g.BENCHMARK2) uniqueBenchmarks.add(g.BENCHMARK2)
      if (g.BENCHMARK3) uniqueBenchmarks.add(g.BENCHMARK3)
      if (g.BENCHMARK_CUSTOM) uniqueBenchmarks.add(g.BENCHMARK_CUSTOM)
    })
    
    const benchmarkTickers = Array.from(uniqueBenchmarks)
      .filter(t => t && t.trim() !== '')
      .map(t => t.toUpperCase())
    
    const { data: benchmarkFactsetData } = await supabase
      .from('factset_data_v2')
      .select(`
        "Ticker",
        "P/E NTM",
        "EV/EBITDA - NTM",
        "EV/Sales - NTM",
        "PRICE",
        "1 month volatility",
        "3 yr beta",
        "52 week high"
      `)
      .in('Ticker', benchmarkTickers)
    
    const benchmarkFactsetMap = new Map<string, any>()
    benchmarkFactsetData?.forEach((row: any) => {
      benchmarkFactsetMap.set(row.Ticker.toUpperCase(), row)
    })
    
    console.log(`Loaded benchmark FactSet data for ${benchmarkFactsetMap.size} ETFs`)
    
    console.log('Fetching score weightings...')
    const { data: scoreWeightingsData, error: scoreWeightingsError } = await supabase
      .from('score_weightings')
      .select('profile_name, category, metric_name, metric_weight, category_weight')
      .eq('profile_name', profile)
    
    if (scoreWeightingsError || !scoreWeightingsData) {
      console.error('Score weightings fetch error:', scoreWeightingsError)
      return NextResponse.json({ error: 'Failed to fetch score weightings' }, { status: 500 })
    }
    
    const { weights, categoryWeights } = parseScoreWeightings(scoreWeightingsData as ScoreWeights[], profile)
    console.log(`Loaded weightings for profile ${profile}`)
    
    console.log('Fetching historical prices from Yahoo Finance...')
    const allTickersForYahoo = [...pageTickers, ...benchmarkTickers]
    const historicalPricesPromises = allTickersForYahoo.map(ticker =>
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
    
    console.log(`Fetched historical prices for ${historicalPricesMap.size} tickers (page + benchmarks)`)
    
    console.log('Extracting individual metrics...')
    const tickersWithMetrics = pageData
      ?.filter(ticker => {
        const yahoo = historicalPricesMap.get(ticker.Ticker.toUpperCase())
        if (!yahoo) {
          console.warn(`Missing Yahoo data for ${ticker.Ticker}`)
          return false
        }
        return true
      })
      .map(ticker => ({
        ticker: ticker.Ticker,
        metrics: extractIndividualMetrics(ticker as FactSetData, historicalPricesMap.get(ticker.Ticker.toUpperCase())!),
        gicsBenchmark: gicsBenchmarkMap.get(ticker.Ticker.toUpperCase())
      })) || []
    
    console.log(`Extracted metrics for ${tickersWithMetrics.length} tickers`)
    
    console.log('Calculating QUALITY percentile scores...')
    const qualityPercentileScores = tickersWithMetrics.map(ticker => ({
      roicTTMScore: calculatePercentileRank(ticker.metrics.roicTTM, universeRoicTTMs, false),
      grossProfitabilityScore: calculatePercentileRank(ticker.metrics.grossProfitability, universeGrossProfitabilities, false),
      accrualsScore: calculatePercentileRank(ticker.metrics.accruals, universeAccruals, true),
      fcfToAssetsScore: calculatePercentileRank(ticker.metrics.fcfToAssets, universeFcfToAssets, false),
      roic3YrScore: calculatePercentileRank(ticker.metrics.roic3Yr, universeRoic3Yrs, false),
      ebitdaMarginScore: calculatePercentileRank(ticker.metrics.ebitdaMargin, universeEbitdaMargins, false)
    }))
    
    console.log('Calculating stock-specific percentile scores...')
    const stockSpecificScores = tickersWithMetrics.map(ticker => ({
      targetPriceUpsideScore: calculatePercentileRank(ticker.metrics.targetPriceUpside, universeTargetPrices, false),
      epsSurpriseScore: calculatePercentileRank(ticker.metrics.epsSurprise, universeEpsSurprises, false),
      revSurpriseScore: calculatePercentileRank(ticker.metrics.revSurprise, universeRevSurprises, false),
      ntmEpsChangeScore: calculatePercentileRank(ticker.metrics.ntmEpsChange, universeNtmEpsChanges, false),
      ntmRevChangeScore: calculatePercentileRank(ticker.metrics.ntmRevChange, universeNtmRevChanges, false)
    }))
    
    console.log(`Calculating benchmark constituent-based scores using ${benchmarkColumn}...`)
    
    // Build a map of benchmark ticker -> constituent metrics
    const benchmarkConstituentsCache = new Map<string, IndividualMetrics[]>()
    
    // Get unique benchmark tickers from page tickers
    const uniquePageBenchmarks = new Set<string>()
    tickersWithMetrics.forEach(ticker => {
      const gicsBenchmark = ticker.gicsBenchmark
      if (gicsBenchmark) {
        let benchmarkTicker: string | null = null
        switch (benchmarkColumn) {
          case 'BENCHMARK1':
            benchmarkTicker = gicsBenchmark.BENCHMARK1
            break
          case 'BENCHMARK2':
            benchmarkTicker = gicsBenchmark.BENCHMARK2
            break
          case 'BENCHMARK3':
            benchmarkTicker = gicsBenchmark.BENCHMARK3
            break
          case 'BENCHMARK_CUSTOM':
            benchmarkTicker = gicsBenchmark.BENCHMARK_CUSTOM
            break
        }
        if (benchmarkTicker) {
          uniquePageBenchmarks.add(benchmarkTicker.toUpperCase())
        }
      }
    })
    
    console.log(`Found ${uniquePageBenchmarks.size} unique benchmarks in page:`, Array.from(uniquePageBenchmarks))
    
    // Fetch constituents for each unique benchmark
    for (const benchmarkTicker of uniquePageBenchmarks) {
      console.log(`\n📊 [Universe] Fetching constituents for benchmark: ${benchmarkTicker}`)
      const constituentTickers = await fetchBenchmarkConstituents(supabase, benchmarkTicker)
      
      if (constituentTickers.length >= 10) {
        console.log(`✅ [Universe] ${benchmarkTicker} has ${constituentTickers.length} constituents - using constituent-based ranking`)
        
        // Fetch FactSet data for constituents
        const { data: constituentFactsetData } = await supabase
          .from('factset_data_v2')
          .select(`
            "Ticker",
            "P/E NTM",
            "EV/EBITDA - NTM",
            "EV/Sales - NTM",
            "PRICE",
            "1 month volatility",
            "3 yr beta",
            "52 week high"
          `)
          .in('Ticker', constituentTickers)
        
        // Extract metrics for each constituent
        const constituentMetrics: IndividualMetrics[] = []
        constituentFactsetData?.forEach((factset: any) => {
          const yahoo = historicalPricesMap.get(factset.Ticker.toUpperCase())
          if (yahoo) {
            constituentMetrics.push(extractIndividualMetrics(factset as FactSetData, yahoo))
          }
        })
        
        benchmarkConstituentsCache.set(benchmarkTicker, constituentMetrics)
        console.log(`✅ [Universe] Successfully loaded ${constituentMetrics.length} constituent metrics for ${benchmarkTicker}`)
      } else {
        console.warn(`⚠️  [Universe] Benchmark ${benchmarkTicker} has only ${constituentTickers.length} constituents, falling back to universe percentile`)
      }
    }
    
    const finalScores: StockScore[] = tickersWithMetrics.map((ticker, index) => {
      const gicsBenchmark = ticker.gicsBenchmark
      
      let benchmarkTicker: string | null = null
      if (gicsBenchmark) {
        switch (benchmarkColumn) {
          case 'BENCHMARK1':
            benchmarkTicker = gicsBenchmark.BENCHMARK1
            break
          case 'BENCHMARK2':
            benchmarkTicker = gicsBenchmark.BENCHMARK2
            break
          case 'BENCHMARK3':
            benchmarkTicker = gicsBenchmark.BENCHMARK3
            break
          case 'BENCHMARK_CUSTOM':
            benchmarkTicker = gicsBenchmark.BENCHMARK_CUSTOM
            break
        }
      }
      
      let benchmarkRelativeScores: Partial<ReturnType<typeof calculateBenchmarkConstituentScores>> = {}
      
      if (benchmarkTicker) {
        const constituentMetrics = benchmarkConstituentsCache.get(benchmarkTicker.toUpperCase())
        
        if (constituentMetrics && constituentMetrics.length >= 10) {
          // Use constituent-based percentile ranking
          benchmarkRelativeScores = calculateBenchmarkConstituentScores(ticker.metrics, constituentMetrics)
          
          // Log first ticker for verification
          if (index === 0) {
            console.log(`\n🎯 [Universe] SCORING METHOD VERIFICATION (First Ticker: ${ticker.ticker})`)
            console.log(`   Benchmark: ${benchmarkTicker}`)
            console.log(`   Method: CONSTITUENT-BASED PERCENTILE RANKING`)
            console.log(`   Constituents used: ${constituentMetrics.length}`)
          }
        } else {
          // Fall back to universe-wide percentile for VALUE, MOMENTUM, RISK
          console.warn(`⚠️  [Universe] No constituents found for ${benchmarkTicker}, using universe percentile for ${ticker.ticker}`)
          
          benchmarkRelativeScores = {
            peRatioScore: calculatePercentileRank(ticker.metrics.peRatio, universePeRatios, true),
            evEbitdaScore: calculatePercentileRank(ticker.metrics.evEbitda, universeEvEbitdas, true),
            evSalesScore: calculatePercentileRank(ticker.metrics.evSales, universeEvSales, true),
            return12MEx1MScore: calculatePercentileRank(ticker.metrics.return12MEx1M, universeReturn12MEx1Ms, false),
            return3MScore: calculatePercentileRank(ticker.metrics.return3M, universeReturn3Ms, false),
            pct52WeekHighScore: calculatePercentileRank(ticker.metrics.pct52WeekHigh, universePct52WeekHighs, false),
            beta3YrScore: calculatePercentileRank(ticker.metrics.beta3Yr, universeBeta3Yrs, true),
            volatility30DayScore: calculatePercentileRank(ticker.metrics.volatility30Day, universeVolatility30Days, true),
            maxDrawdownScore: calculatePercentileRank(ticker.metrics.maxDrawdown, universeMaxDrawdowns, true)
          }
          
          if (index === 0) {
            console.log(`\n🎯 [Universe] SCORING METHOD VERIFICATION (First Ticker: ${ticker.ticker})`)
            console.log(`   Benchmark: ${benchmarkTicker}`)
            console.log(`   Method: UNIVERSE-WIDE PERCENTILE RANKING (FALLBACK)`)
          }
        }
      }
      
      const qualityScores = qualityPercentileScores[index]
      const stockSpecific = stockSpecificScores[index]
      
      const scored = {
        ...ticker.metrics,
        // VALUE from benchmark-relative (except Target Price which is percentile)
        peRatioScore: benchmarkRelativeScores.peRatioScore ?? null,
        evEbitdaScore: benchmarkRelativeScores.evEbitdaScore ?? null,
        evSalesScore: benchmarkRelativeScores.evSalesScore ?? null,
        targetPriceUpsideScore: stockSpecific.targetPriceUpsideScore,
        // MOMENTUM from benchmark-relative (except EPS/Rev which are percentile)
        return12MEx1MScore: benchmarkRelativeScores.return12MEx1MScore ?? null,
        return3MScore: benchmarkRelativeScores.return3MScore ?? null,
        pct52WeekHighScore: benchmarkRelativeScores.pct52WeekHighScore ?? null,
        epsSurpriseScore: stockSpecific.epsSurpriseScore,
        revSurpriseScore: stockSpecific.revSurpriseScore,
        ntmEpsChangeScore: stockSpecific.ntmEpsChangeScore,
        ntmRevChangeScore: stockSpecific.ntmRevChangeScore,
        // QUALITY from percentile ranking
        roicTTMScore: qualityScores.roicTTMScore,
        grossProfitabilityScore: qualityScores.grossProfitabilityScore,
        accrualsScore: qualityScores.accrualsScore,
        fcfToAssetsScore: qualityScores.fcfToAssetsScore,
        roic3YrScore: qualityScores.roic3YrScore,
        ebitdaMarginScore: qualityScores.ebitdaMarginScore,
        // RISK from benchmark-relative
        beta3YrScore: benchmarkRelativeScores.beta3YrScore ?? null,
        volatility30DayScore: benchmarkRelativeScores.volatility30DayScore ?? null,
        maxDrawdownScore: benchmarkRelativeScores.maxDrawdownScore ?? null,
        financialLeverageScore: null
      }
      
      const composites = calculateCompositeScores(scored, weights)
      const total = calculateTotalScore(composites, categoryWeights)
      
      return {
        ticker: ticker.ticker,
        ...scored,
        ...composites,
        ...total
      }
    })
    
    console.log('Enriching with benchmark data...')
    const enrichedScores = finalScores.map(score => {
      const gicsBenchmark = gicsBenchmarkMap.get(score.ticker.toUpperCase())
      
      return {
        ...score,
        benchmark1: gicsBenchmark?.BENCHMARK1 || null,
        benchmark2: gicsBenchmark?.BENCHMARK2 || null,
        benchmark3: gicsBenchmark?.BENCHMARK3 || null,
        benchmarkCustom: gicsBenchmark?.BENCHMARK_CUSTOM || null
      }
    })
    
    console.log('=== Universe Scoring API: Completed successfully ===')
    
    return NextResponse.json({
      scores: enrichedScores,
      pagination: {
        page,
        pageSize,
        totalCount: totalCount || 0,
        totalPages
      }
    })
    
  } catch (error) {
    console.error('Universe scoring API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

