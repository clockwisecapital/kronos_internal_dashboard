import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/app/utils/supabase/service-role'
import {
  extractIndividualMetrics,
  calculatePercentileScores,
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
import { fetchHistoricalPricesInBatches } from '@/lib/services/yahooFinance'
import { fetchHistoricalPricesWithCache } from '@/lib/services/yahooFinanceCache'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for complex calculations

/**
 * Hardcoded blacklist of tickers that consistently 404 on Yahoo Finance
 * These are filtered out before any API calls to save time
 */
const TICKER_BLACKLIST = new Set([
  // Class A shares that don't exist on Yahoo
  'GTN-A', 'HEI-A', 'TAP-A', 'MOG-A',
  // Class B shares that don't exist
  'LEN-B', 'MOG-B', 'WSO-B',
  // Other problematic suffixes
  'MKC-V',
  // Add more as they're discovered
])

/**
 * Validates and normalizes a ticker symbol for Yahoo Finance API
 * Returns null for invalid tickers
 */
function validateAndNormalizeTicker(ticker: string | null | undefined): string | null {
  if (!ticker || typeof ticker !== 'string') return null
  
  const trimmed = ticker.trim().toUpperCase()
  
  // Filter out obvious invalid tickers
  if (trimmed === '' || 
      trimmed === '-' || 
      trimmed.startsWith('#') ||
      trimmed === 'N/A' ||
      trimmed === 'NULL' ||
      trimmed.includes('CASH') ||
      trimmed.includes('FGXXX') ||
      trimmed.includes('OTHER')) {
    return null
  }
  
  // Remove common suffixes that Yahoo Finance doesn't recognize
  let normalized = trimmed
    .replace(/\s+UW$/, '')  // Remove " UW" suffix
    .replace(/\s+UN$/, '')  // Remove " UN" suffix  
    .replace(/\s+AS OF.*$/, '')  // Remove " AS OF date" comments
    .trim()
  
  // Handle Class A/B/V shares - convert dots to hyphens for Yahoo format
  normalized = normalized
    .replace(/\.A$/,'-A')
    .replace(/\.B$/, '-B')
    .replace(/\.V$/, '-V')
  
  // Check hardcoded blacklist AFTER normalization
  if (TICKER_BLACKLIST.has(normalized)) {
    return null
  }
  
  // Must have at least 1 character and only valid ticker characters
  if (normalized.length === 0) return null
  if (!/^[A-Z0-9.\-^]+$/.test(normalized)) return null
  
  return normalized
}

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
  // The table has columns: Ticker, Name, SPY, QQQ, SOXX, SMH, ARKK, etc.
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
      .map((ticker: string) => validateAndNormalizeTicker(ticker))
      .filter((ticker: string | null): ticker is string => ticker !== null)
    
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
    const benchmarkColumn = searchParams.get('benchmark') || 'BENCHMARK1'
    const mode = searchParams.get('mode') || 'portfolio' // 'portfolio' or 'universe'
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')
    
    console.log(`=== Scoring API: Starting calculation for profile ${profile}, benchmark ${benchmarkColumn}, mode ${mode} ===`)
    
    const supabase = createServiceRoleClient()
    
    let tickers: string[] = []
    let uniqueHoldings = new Map<string, HoldingData>()
    let latestDate: string | null = null
    let universeTotalCount = 0
    let universeTotalPages = 0
    
    if (mode === 'universe') {
      console.log('Step 1: Fetching universe data (paginated)...')
      
      // Get total count for pagination
      const { count: totalCount } = await supabase
        .from('factset_data_v2')
        .select('*', { count: 'exact', head: true })
      
      universeTotalCount = totalCount || 0
      universeTotalPages = Math.ceil(universeTotalCount / pageSize)
      console.log(`Total universe tickers: ${universeTotalCount}, Total pages: ${universeTotalPages}`)
      
      // Fetch paginated data
      const offset = (page - 1) * pageSize
      const { data: universeData, error: universeError } = await supabase
        .from('factset_data_v2')
        .select('Ticker')
        .range(offset, offset + pageSize - 1)
        .order('Ticker', { ascending: true })
      
      if (universeError || !universeData || universeData.length === 0) {
        throw new Error('Failed to fetch universe data')
      }
      
      tickers = universeData.map((row: any) => row.Ticker)
      console.log(`Loaded ${tickers.length} tickers for page ${page}`)
      
    } else {
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
      
      latestDate = holdingsDateData[0].date
      
      const { data: holdings, error: holdingsError } = await supabase
        .from('holdings')
        .select('stock_ticker, shares, market_value')
        .eq('date', latestDate)
      
      if (holdingsError || !holdings || holdings.length === 0) {
        throw new Error('Failed to fetch holdings')
      }
      
      // Deduplicate holdings
      holdings.forEach((h: HoldingData) => {
        if (!uniqueHoldings.has(h.stock_ticker)) {
          uniqueHoldings.set(h.stock_ticker, h)
        }
      })
      
      const holdingsArray = Array.from(uniqueHoldings.values())
      tickers = holdingsArray.map(h => h.stock_ticker)
      
      console.log(`Loaded ${holdingsArray.length} unique holdings`)
    }
    
    // FIX #2: Parallelize independent database queries for faster loading
    console.log('Step 2-4: Fetching data in parallel (FactSet, Weightings, GICS, Score Weightings)...')
    
    const [
      factsetResult,
      weightingsResult,
      gicsBenchmarkResult,
      scoreWeightingsResult
    ] = await Promise.all([
      // FactSet data for holdings
      supabase
        .from('factset_data_v2')
        .select(`
          "Ticker",
          "EPS EST NTM",
          "EPS EST NTM - 30 days ago",
          "EPS EST NTM - 90 days ago",
          "EPS surprise last qtr",
          "Sales LTM",
          "Sales EST NTM",
          "SALES EST NTM - 30 days ago",
          "SALES EST NTM - 90 days ago",
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
          "2 month vol",
          "3 yr beta",
          "ND",
          "EV/EBITDA - NTM",
          "EV/Sales - NTM",
          "P/E NTM",
          "52 week high"
        `)
        .in('Ticker', tickers),
      
      // Weightings from API
      fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/weightings`)
        .then(res => res.json())
        .catch(error => {
          console.warn('Error fetching weightings:', error)
          return { success: false, data: [] }
        }),
      
      // GICS benchmark data
      supabase
        .from('gics_yahoo_finance')
        .select('"Ticker", "BENCHMARK1", "BENCHMARK2", "BENCHMARK3", "BENCHMARK_CUSTOM"')
        .in('"Ticker"', tickers),
      
      // Score weightings
      supabase
        .from('score_weightings')
        .select('profile_name, category, metric_name, metric_weight, category_weight')
        .eq('profile_name', profile)
    ])
    
    // Process FactSet data
    const { data: factsetData, error: factsetError } = factsetResult
    if (factsetError) {
      console.error('FactSet fetch error:', factsetError)
    }
    
    const factsetMap = new Map<string, FactSetData>()
    factsetData?.forEach((row: any) => {
      factsetMap.set(row.Ticker.toUpperCase(), row as FactSetData)
    })
    console.log(`✅ Loaded FactSet data for ${factsetMap.size} tickers`)
    
    // Process Weightings data
    let weightingsData: any[] = []
    if (weightingsResult.success && weightingsResult.data) {
      weightingsData = weightingsResult.data
      console.log(`✅ Loaded ${weightingsData.length} weightings from weightings_universe`)
    }
    
    const weightingsMap = new Map<string, BenchmarkWeighting>()
    weightingsData.forEach((w: any) => {
      weightingsMap.set(w.ticker.toUpperCase(), {
        ticker: w.ticker,
        spy: w.spy,
        qqq: w.qqq
      })
    })
    
    // Process GICS benchmark data
    const { data: gicsBenchmarkData } = gicsBenchmarkResult
    const gicsBenchmarkMap = new Map<string, GicsBenchmarkData>()
    gicsBenchmarkData?.forEach((g: GicsBenchmarkData) => {
      gicsBenchmarkMap.set(g.Ticker.toUpperCase(), g)
    })
    console.log(`✅ Loaded GICS benchmark data for ${gicsBenchmarkMap.size} tickers`)
    
    // Process Score weightings
    const { data: scoreWeightingsData, error: scoreWeightingsError } = scoreWeightingsResult
    if (scoreWeightingsError || !scoreWeightingsData || scoreWeightingsData.length === 0) {
      throw new Error(`Failed to fetch score weightings for profile ${profile}`)
    }
    
    const { weights, categoryWeights } = parseScoreWeightings(
      scoreWeightingsData as ScoreWeights[],
      profile
    )
    console.log(`✅ Loaded weightings for profile ${profile}`)
    
    // Step 3c: Get unique benchmark tickers and fetch their FactSet data
    console.log('Step 3c: Fetching benchmark ETF data...')
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
    console.log(`Found ${benchmarkTickers.length} unique benchmark tickers:`, benchmarkTickers)
    
    const { data: benchmarkFactsetData } = await supabase
      .from('factset_data_v2')
      .select(`
        "Ticker",
        "P/E NTM",
        "EV/EBITDA - NTM",
        "EV/Sales - NTM",
        "PRICE",
        "2 month vol",
        "3 yr beta",
        "52 week high",
        "Consensus Price Target",
        "EPS surprise last qtr",
        "SALES surprise last qtr",
        "EPS EST NTM",
        "EPS EST NTM - 30 days ago",
        "EPS EST NTM - 90 days ago",
        "Sales EST NTM",
        "SALES EST NTM - 30 days ago",
        "SALES EST NTM - 90 days ago"
      `)
      .in('Ticker', benchmarkTickers)
    
    const benchmarkFactsetMap = new Map<string, any>()
    benchmarkFactsetData?.forEach((row: any) => {
      benchmarkFactsetMap.set(row.Ticker.toUpperCase(), row)
    })
    console.log(`✅ Loaded benchmark FactSet data for ${benchmarkFactsetMap.size} ETFs`)
    
    console.log('Step 5: Determining which tickers need Yahoo Finance historical prices...')
    
    // FIX #1: Only fetch Yahoo data for tickers we actually need
    // Collect holdings + benchmark ETFs (with validation)
    const allTickersForYahoo = new Set<string>()
    
    // Add validated holdings tickers
    tickers.forEach(ticker => {
      const validated = validateAndNormalizeTicker(ticker)
      if (validated) allTickersForYahoo.add(validated)
    })
    
    // Add validated benchmark tickers
    benchmarkTickers.forEach(ticker => {
      const validated = validateAndNormalizeTicker(ticker)
      if (validated) allTickersForYahoo.add(validated)
    })
    
    const initialCount = allTickersForYahoo.size
    
    // Get unique benchmarks from GICS data to fetch their constituents
    const uniqueGicsBenchmarks = new Set<string>()
    gicsBenchmarkData?.forEach((g: GicsBenchmarkData) => {
      const b1 = validateAndNormalizeTicker(g.BENCHMARK1)
      const b2 = validateAndNormalizeTicker(g.BENCHMARK2)
      const b3 = validateAndNormalizeTicker(g.BENCHMARK3)
      const bc = validateAndNormalizeTicker(g.BENCHMARK_CUSTOM)
      
      if (b1) uniqueGicsBenchmarks.add(b1)
      if (b2) uniqueGicsBenchmarks.add(b2)
      if (b3) uniqueGicsBenchmarks.add(b3)
      if (bc) uniqueGicsBenchmarks.add(bc)
    })
    
    console.log(`Step 5a: Fetching constituents for ${uniqueGicsBenchmarks.size} benchmarks...`)
    
    // Fetch constituent tickers for each benchmark (lightweight - just ticker lists)
    for (const benchmarkTicker of uniqueGicsBenchmarks) {
      const constituentTickers = await fetchBenchmarkConstituents(supabase, benchmarkTicker)
      constituentTickers.forEach(ticker => {
        const validated = validateAndNormalizeTicker(ticker)
        if (validated) allTickersForYahoo.add(validated)
      })
    }
    
    console.log(`📊 Optimized ticker fetch: ${allTickersForYahoo.size} tickers (holdings + benchmarks + constituents only)`)
    console.log(`   Previously would have fetched ~1,500 tickers from weightings_universe`)
    
    // FIX #4: Use cached Yahoo Finance data (24hr TTL) for massive speed improvement
    console.log('Step 5b: Fetching Yahoo Finance data with caching...')
    const historicalPricesMap = await fetchHistoricalPricesWithCache(
      Array.from(allTickersForYahoo)
    )
    
    console.log('Step 6: Extracting individual metrics...')
    const tickersWithMetrics = tickers
      .map(ticker => {
        const tickerUpper = ticker.toUpperCase()
        const factset = factsetMap.get(tickerUpper)
        const yahoo = historicalPricesMap.get(tickerUpper)
        const gicsBenchmark = gicsBenchmarkMap.get(tickerUpper)
        
        if (!factset || !yahoo) {
          console.warn(`Missing data for ${ticker}`)
          return null
        }
        
        const metrics = extractIndividualMetrics(factset, yahoo)
        
        return {
          ticker: ticker,
          metrics,
          gicsBenchmark
        }
      })
      .filter(m => m !== null) as Array<{ 
        ticker: string
        metrics: IndividualMetrics
        gicsBenchmark: GicsBenchmarkData | undefined
      }>
    
    console.log(`Extracted metrics for ${tickersWithMetrics.length} tickers`)
    
    console.log('Step 7: Fetching universe data for percentile calculations...')
    
    // Supabase has a hard 1000 row limit, so we need to fetch in batches
    const batchSize = 1000
    let universeData: any[] = []
    let start = 0
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabase
        .from('factset_data_v2')
        .select(`
          "Ticker",
          "EPS EST NTM",
          "EPS EST NTM - 30 days ago",
          "EPS EST NTM - 90 days ago",
          "EPS surprise last qtr",
          "Sales LTM",
          "Sales EST NTM",
          "SALES EST NTM - 30 days ago",
          "SALES EST NTM - 90 days ago",
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
          "2 month vol",
          "3 yr beta",
          "ND"
        `)
        .range(start, start + batchSize - 1)

      if (error) {
        console.error('Universe data fetch error:', error)
        return NextResponse.json({ error: 'Failed to fetch universe data' }, { status: 500 })
      }

      if (data && data.length > 0) {
        universeData = universeData.concat(data)
        start += batchSize
        hasMore = data.length === batchSize
      } else {
        hasMore = false
      }
    }
    
    console.log(`Loaded ${universeData.length} universe tickers for percentile calculation (fetched in batches of ${batchSize})`)
    
    // Extract metrics from all universe tickers (using dummy Yahoo data since we only need FactSet metrics)
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
    const universeVolatility60Days = universeMetrics.map(m => m.volatility60Day)
    const universeMaxDrawdowns = universeMetrics.map(m => m.maxDrawdown)
    
    // 7b. Calculate QUALITY scores using universe-wide percentile ranking
    console.log('Step 7b: Calculating QUALITY percentile scores across universe...')
    const qualityPercentileScores = tickersWithMetrics.map(ticker => ({
      roicTTMScore: calculatePercentileRank(ticker.metrics.roicTTM, universeRoicTTMs, false),
      grossProfitabilityScore: calculatePercentileRank(ticker.metrics.grossProfitability, universeGrossProfitabilities, false),
      accrualsScore: calculatePercentileRank(ticker.metrics.accruals, universeAccruals, true), // Lower is better
      fcfToAssetsScore: calculatePercentileRank(ticker.metrics.fcfToAssets, universeFcfToAssets, false),
      roic3YrScore: calculatePercentileRank(ticker.metrics.roic3Yr, universeRoic3Yrs, false),
      ebitdaMarginScore: calculatePercentileRank(ticker.metrics.ebitdaMargin, universeEbitdaMargins, false)
    }))
    
    // 7c. Calculate percentile scores for stock-specific metrics (using universe)
    console.log('Step 7c: Calculating stock-specific percentile scores across universe...')
    const stockSpecificScores = tickersWithMetrics.map(ticker => ({
      targetPriceUpsideScore: calculatePercentileRank(ticker.metrics.targetPriceUpside, universeTargetPrices, false),
      epsSurpriseScore: calculatePercentileRank(ticker.metrics.epsSurprise, universeEpsSurprises, false),
      revSurpriseScore: calculatePercentileRank(ticker.metrics.revSurprise, universeRevSurprises, false),
      ntmEpsChangeScore: calculatePercentileRank(ticker.metrics.ntmEpsChange, universeNtmEpsChanges, false),
      ntmRevChangeScore: calculatePercentileRank(ticker.metrics.ntmRevChange, universeNtmRevChanges, false)
    }))
    
    console.log(`Step 8: Calculating benchmark constituent-based scores using ${benchmarkColumn}...`)
    
    // Build a map of benchmark ticker -> constituent metrics
    const benchmarkConstituentsCache = new Map<string, IndividualMetrics[]>()
    
    // Get unique benchmark tickers from tickers
    const uniqueTickerBenchmarks = new Set<string>()
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
          uniqueTickerBenchmarks.add(benchmarkTicker.toUpperCase())
        }
      }
    })
    
    console.log(`Found ${uniqueTickerBenchmarks.size} unique benchmarks in tickers:`, Array.from(uniqueTickerBenchmarks))
    
    // Fetch constituents for each unique benchmark
    for (const benchmarkTicker of uniqueTickerBenchmarks) {
      console.log(`\n📊 Fetching constituents for benchmark: ${benchmarkTicker}`)
      const constituentTickers = await fetchBenchmarkConstituents(supabase, benchmarkTicker)
      
      if (constituentTickers.length >= 10) { // Minimum 10 constituents for meaningful ranking
        console.log(`✅ ${benchmarkTicker} has ${constituentTickers.length} constituents - using constituent-based ranking`)
        console.log(`   Sample constituents: ${constituentTickers.slice(0, 5).join(', ')}...`)
        
        // Fetch FactSet data for constituents (including QUALITY and MOMENTUM metrics)
        const { data: constituentFactsetData } = await supabase
          .from('factset_data_v2')
          .select(`
            "Ticker",
            "P/E NTM",
            "EV/EBITDA - NTM",
            "EV/Sales - NTM",
            "PRICE",
            "Consensus Price Target",
            "2 month vol",
            "3 yr beta",
            "52 week high",
            "EPS surprise last qtr",
            "SALES surprise last qtr",
            "EPS EST NTM",
            "EPS EST NTM - 90 days ago",
            "Sales EST NTM",
            "SALES EST NTM - 90 days ago",
            "ROIC 1 YR",
            "ROIC  3YR",
            "Gross Profit LTM",
            "Total assets",
            "acrcrurals %",
            "FCF",
            "EBITDA LTM",
            "Sales LTM",
            "ND"
          `)
          .in('Ticker', constituentTickers)
        
        // Extract metrics for each constituent (ONLY those with real Yahoo data)
        const constituentMetrics: IndividualMetrics[] = []
        
        constituentFactsetData?.forEach((factset: any) => {
          const yahoo = historicalPricesMap.get(factset.Ticker.toUpperCase())
          if (yahoo) {
            // Only include constituents with real Yahoo Finance data for accurate comparisons
            constituentMetrics.push(extractIndividualMetrics(factset as FactSetData, yahoo))
          }
        })
        
        benchmarkConstituentsCache.set(benchmarkTicker, constituentMetrics)
        console.log(`✅ Successfully loaded ${constituentMetrics.length} constituent metrics for ${benchmarkTicker}`)
        console.log(`   (${constituentTickers.length} total constituents → ${constituentFactsetData?.length || 0} in FactSet → ${constituentMetrics.length} with metrics)`)
      } else {
        console.warn(`⚠️  Benchmark ${benchmarkTicker} has only ${constituentTickers.length} constituents, falling back to universe percentile`)
      }
    }
    
    const finalScores: StockScore[] = tickersWithMetrics.map((ticker, index) => {
      const gicsBenchmark = ticker.gicsBenchmark
      
      // Get benchmark ticker based on selected benchmark column
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
            console.log(`\n🎯 SCORING METHOD VERIFICATION (First Ticker: ${ticker.ticker})`)
            console.log(`   Benchmark: ${benchmarkTicker}`)
            console.log(`   Method: CONSTITUENT-BASED PERCENTILE RANKING`)
            console.log(`   Constituents used: ${constituentMetrics.length}`)
            console.log(`   Sample scores:`)
            console.log(`     - P/E Score: ${benchmarkRelativeScores.peRatioScore}`)
            console.log(`     - 3M Return Score: ${benchmarkRelativeScores.return3MScore}`)
            console.log(`     - Beta Score: ${benchmarkRelativeScores.beta3YrScore}`)
          }
        } else {
          // No valid benchmark constituents - return null for VALUE/MOMENTUM/RISK
          console.warn(`⚠️  Benchmark ${benchmarkTicker} has insufficient constituents (<10), no scores for ${ticker.ticker}`)
          benchmarkRelativeScores = {
            // All VALUE/MOMENTUM/RISK scores will be null
            peRatioScore: null,
            evEbitdaScore: null,
            evSalesScore: null,
            targetPriceUpsideScore: null,
            return12MEx1MScore: null,
            return3MScore: null,
            pct52WeekHighScore: null,
            beta3YrScore: null,
            volatility60DayScore: null,
            maxDrawdownScore: null
          }
        }
      } else {
        // No benchmark assigned - return null for VALUE/MOMENTUM/RISK
        console.warn(`⚠️  No benchmark ticker found for ${ticker.ticker} in ${benchmarkColumn}`)
        benchmarkRelativeScores = {
          peRatioScore: null,
          evEbitdaScore: null,
          evSalesScore: null,
          targetPriceUpsideScore: null,
          return12MEx1MScore: null,
          return3MScore: null,
          pct52WeekHighScore: null,
          beta3YrScore: null,
          volatility60DayScore: null,
          maxDrawdownScore: null
        }
      }
      
      // Combine benchmark-relative scores with QUALITY percentile scores
      const qualityScores = qualityPercentileScores[index]
      
      // Debug: Log quality scores for first holding
      if (index === 0) {
        console.log('Sample quality scores:', {
          roicTTM: qualityScores.roicTTMScore,
          grossProf: qualityScores.grossProfitabilityScore,
          accruals: qualityScores.accrualsScore
        })
      }
      
      const stockSpecific = stockSpecificScores[index]
      
      // Use benchmark scores for VALUE/MOMENTUM/RISK, universe percentile for QUALITY
      const scored = {
        ...ticker.metrics,
        // VALUE from benchmark (null if no benchmark)
        peRatioScore: benchmarkRelativeScores.peRatioScore ?? null,
        evEbitdaScore: benchmarkRelativeScores.evEbitdaScore ?? null,
        evSalesScore: benchmarkRelativeScores.evSalesScore ?? null,
        targetPriceUpsideScore: benchmarkRelativeScores.targetPriceUpsideScore ?? null,
        // MOMENTUM from benchmark (null if no benchmark)
        return12MEx1MScore: benchmarkRelativeScores.return12MEx1MScore ?? null,
        return3MScore: benchmarkRelativeScores.return3MScore ?? null,
        pct52WeekHighScore: benchmarkRelativeScores.pct52WeekHighScore ?? null,
        // MOMENTUM metrics - use benchmark constituents when available, fallback to universe percentile
        epsSurpriseScore: benchmarkRelativeScores.epsSurpriseScore ?? stockSpecific.epsSurpriseScore,
        revSurpriseScore: benchmarkRelativeScores.revSurpriseScore ?? stockSpecific.revSurpriseScore,
        ntmEpsChangeScore: benchmarkRelativeScores.ntmEpsChangeScore ?? stockSpecific.ntmEpsChangeScore,
        ntmRevChangeScore: benchmarkRelativeScores.ntmRevChangeScore ?? stockSpecific.ntmRevChangeScore,
        // QUALITY from benchmark if available, else universe percentile (always available)
        roicTTMScore: benchmarkRelativeScores.roicTTMScore ?? qualityScores.roicTTMScore,
        grossProfitabilityScore: benchmarkRelativeScores.grossProfitabilityScore ?? qualityScores.grossProfitabilityScore,
        accrualsScore: benchmarkRelativeScores.accrualsScore ?? qualityScores.accrualsScore,
        fcfToAssetsScore: benchmarkRelativeScores.fcfToAssetsScore ?? qualityScores.fcfToAssetsScore,
        roic3YrScore: benchmarkRelativeScores.roic3YrScore ?? qualityScores.roic3YrScore,
        ebitdaMarginScore: benchmarkRelativeScores.ebitdaMarginScore ?? qualityScores.ebitdaMarginScore,
        // RISK from benchmark (null if no benchmark)
        beta3YrScore: benchmarkRelativeScores.beta3YrScore ?? null,
        volatility60DayScore: benchmarkRelativeScores.volatility60DayScore ?? null,
        maxDrawdownScore: benchmarkRelativeScores.maxDrawdownScore ?? null,
        financialLeverageScore: benchmarkRelativeScores.financialLeverageScore ?? null
      }
      
      const composites = calculateCompositeScores(scored, weights)
      const total = calculateTotalScore(composites, categoryWeights)
      
      // Debug: Log composites for first holding
      if (index === 0) {
        console.log('Sample composite scores:', {
          value: composites.valueScore,
          momentum: composites.momentumScore,
          quality: composites.qualityScore,
          risk: composites.riskScore,
          total: total.totalScore
        })
        console.log('Sample weights check:', {
          hasValueWeights: weights.has('VALUE'),
          hasQualityWeights: weights.has('QUALITY'),
          qualityMetricWeights: weights.get('QUALITY')?.metricWeights.size
        })
      }
      
      return {
        ticker: ticker.ticker,
        ...scored,
        ...composites,
        ...total
      }
    })
    
    console.log('Step 9: Enriching with holding and benchmark data...')
    const enrichedScores = finalScores.map(score => {
      const holding = uniqueHoldings.get(score.ticker)
      const weighting = weightingsMap.get(score.ticker.toUpperCase())
      const gicsBenchmark = gicsBenchmarkMap.get(score.ticker.toUpperCase())
      
      return {
        ...score,
        shares: holding?.shares || 0,
        marketValue: holding?.market_value || 0,
        spyWeight: weighting?.spy || null,
        qqqWeight: weighting?.qqq || null,
        benchmark1: gicsBenchmark?.BENCHMARK1 || null,
        benchmark2: gicsBenchmark?.BENCHMARK2 || null,
        benchmark3: gicsBenchmark?.BENCHMARK3 || null,
        benchmarkCustom: gicsBenchmark?.BENCHMARK_CUSTOM || null
      }
    })
    
    // Sort by total score (descending)
    enrichedScores.sort((a, b) => {
      if (a.totalScore === null) return 1
      if (b.totalScore === null) return -1
      return b.totalScore - a.totalScore
    })
    
    console.log(`=== Scoring API: Completed successfully ===`)
    
    // Return format depends on mode
    if (mode === 'universe') {
      return NextResponse.json({
        success: true,
        scores: enrichedScores,
        pagination: {
          page,
          pageSize,
          totalCount: universeTotalCount,
          totalPages: universeTotalPages
        }
      })
    } else {
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
    }
    
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

