'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/app/utils/supabase/client'

interface Holding {
  date: string
  account: string
  stock_ticker: string
  cusip: string
  security_name: string
  shares: number
  close_price: number  // Close price from CSV
  market_value: number  // Market value from CSV
  weightings: number
  net_assets: number
  shares_outstand: number
  creation_units: number
  current_price?: number
  pct_change?: number
  avg_index_weight?: number
  index_ratio?: number
  qqq_weight?: number
  sp_weight?: number
  earnings_date?: string
  earnings_time?: string
}

interface HoldingWithCalculations extends Holding {
  calculated_weight: number  // Formula: (Market Value / sum of all Market Value) * 100
  calculated_market_value: number  // Formula: current_price * shares (use close_price if current_price null)
  calculated_pct_change: number  // Formula: (current_price/close_price - 1) * 100
}

export default function HoldingsPage() {
  const [holdings, setHoldings] = useState<HoldingWithCalculations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortColumn, setSortColumn] = useState<keyof HoldingWithCalculations>('stock_ticker')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    fetchHoldings()
  }, [])

  const fetchHoldings = async () => {
    try {
      const supabase = createClient()
      
      // Get the most recent date first
      const { data: dateData, error: dateError } = await supabase
        .from('holdings')
        .select('date')
        .order('date', { ascending: false })
        .limit(1)
      
      if (dateError) {
        throw new Error(`Failed to fetch holdings date: ${dateError.message}`)
      }
      
      if (!dateData || dateData.length === 0) {
        setError('No holdings data available. Please upload holdings.csv in the Data Upload tab.')
        setLoading(false)
        return
      }
      
      const latestDate = dateData[0].date
      
      // Fetch only holdings from the most recent date
      const { data: holdingsData, error: fetchError } = await supabase
        .from('holdings')
        .select('*')
        .eq('date', latestDate)
        .order('market_value', { ascending: false })
      
      if (fetchError) {
        throw new Error(`Failed to fetch holdings: ${fetchError.message}`)
      }
      
      if (!holdingsData || holdingsData.length === 0) {
        setError('No holdings data available. Please upload holdings.csv in the Data Upload tab.')
        setLoading(false)
        return
      }
      
      console.log(`Holdings: Loaded ${holdingsData.length} holdings from date: ${latestDate}`)
      
      // Check for and remove duplicates
      const tickerCounts = new Map<string, number>()
      holdingsData.forEach(h => {
        const count = tickerCounts.get(h.stock_ticker) || 0
        tickerCounts.set(h.stock_ticker, count + 1)
      })
      
      const duplicates = Array.from(tickerCounts.entries()).filter(([_, count]) => count > 1)
      if (duplicates.length > 0) {
        console.error('❌ DUPLICATE TICKERS IN HOLDINGS:', duplicates.map(([ticker, count]) => `${ticker} (${count}x)`).join(', '))
      }
      
      // De-duplicate: Keep only first occurrence of each ticker
      const uniqueHoldingsMap = new Map()
      holdingsData.forEach(h => {
        if (!uniqueHoldingsMap.has(h.stock_ticker)) {
          uniqueHoldingsMap.set(h.stock_ticker, h)
        }
      })
      
      const deduplicatedHoldings = Array.from(uniqueHoldingsMap.values())
      console.log(`Holdings: De-duplicated ${holdingsData.length} → ${deduplicatedHoldings.length}`)
      
      // Fetch weightings data
      const { data: weightingsData, error: weightingsError } = await supabase
        .from('weightings')
        .select('ticker, spy, qqq')
      
      if (weightingsError) {
        console.warn('Failed to fetch weightings:', weightingsError.message)
      }
      
      // Create lookup map for weightings
      const weightingsMap = new Map(
        weightingsData?.map(w => [w.ticker, { spy: w.spy, qqq: w.qqq }]) || []
      )
      
      // Fetch real-time prices from Yahoo Finance
      let pricesMap = new Map<string, number>()
      try {
        console.log('Fetching real-time prices...')
        const pricesResponse = await fetch('/api/prices')
        if (pricesResponse.ok) {
          const pricesData = await pricesResponse.json()
          if (pricesData.success && pricesData.prices) {
            pricesMap = new Map(
              pricesData.prices.map((p: { ticker: string; currentPrice: number }) => [p.ticker, p.currentPrice])
            )
            console.log(`Loaded ${pricesMap.size} real-time prices`)
          }
        } else {
          console.warn('Failed to fetch prices:', pricesResponse.statusText)
        }
      } catch (priceError) {
        console.error('Error fetching real-time prices:', priceError)
        // Continue without real-time prices - will use close_price
      }
      
      // Calculate derived fields per client requirements (use deduplicated data)
      const totalMarketValue = deduplicatedHoldings.reduce((sum, h) => sum + h.market_value, 0)
      
      const holdingsWithCalcs: HoldingWithCalculations[] = deduplicatedHoldings.map(h => {
        // Get real-time price from Yahoo Finance, fallback to current_price, then close_price
        const realtimePrice = pricesMap.get(h.stock_ticker)
        const effectivePrice = realtimePrice || h.current_price || h.close_price
        
        // Get weightings for this ticker
        const weights = weightingsMap.get(h.stock_ticker)
        const spyWeight = weights?.spy || null
        const qqqWeight = weights?.qqq || null
        
        // Calculate portfolio weight percentage
        const calculatedWeight = totalMarketValue > 0 ? (h.market_value / totalMarketValue) * 100 : 0
        
        // Calculate Average Index Weight: (SPY + QQQ) / 2
        const avgIndexWeight = (spyWeight !== null && qqqWeight !== null) 
          ? (spyWeight + qqqWeight) / 2 
          : null
        
        // Calculate Index Ratio: Portfolio Weight / QQQ Weight
        const indexRatio = (qqqWeight !== null && qqqWeight > 0) 
          ? calculatedWeight / qqqWeight 
          : null
        
        return {
          ...h,
          // Store real-time price for display
          current_price: realtimePrice || h.current_price,
          sp_weight: spyWeight,
          qqq_weight: qqqWeight,
          avg_index_weight: avgIndexWeight,
          index_ratio: indexRatio,
          // Weight: (Market Value / sum of all Market Value) * 100
          calculated_weight: calculatedWeight,
          // Market Value: Use real-time price if available, otherwise CSV market_value
          calculated_market_value: realtimePrice ? (realtimePrice * h.shares) : 
                                   h.current_price ? (h.current_price * h.shares) : 
                                   h.market_value,
          // % Change: (current_price/close_price - 1) * 100
          calculated_pct_change: realtimePrice ? ((realtimePrice / h.close_price - 1) * 100) :
                                 h.current_price ? ((h.current_price / h.close_price - 1) * 100) : 
                                 0
        }
      })
      
      setHoldings(holdingsWithCalcs)
      setError(null)
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load holdings')
      setLoading(false)
    }
  }

  const handleSort = (column: keyof HoldingWithCalculations) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const sortedHoldings = [...holdings].sort((a, b) => {
    const aVal = a[sortColumn]
    const bVal = b[sortColumn]
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc' 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal)
    }
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    }
    
    return 0
  })

  const totalValue = holdings.reduce((sum, h) => sum + h.calculated_market_value, 0)
  const totalShares = holdings.reduce((sum, h) => sum + h.shares, 0)
  const avgWeight = holdings.length > 0 ? holdings.reduce((sum, h) => sum + h.calculated_weight, 0) / holdings.length : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-300">Loading holdings...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center max-w-md">
          <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <h2 className="text-xl font-semibold text-white mb-2">
            No Holdings Data
          </h2>
          <p className="text-slate-400 mb-4">
            {error}
          </p>
          <a
            href="/data-upload"
            className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors shadow-lg shadow-blue-500/20"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload Holdings Data
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Master Holdings
          </h1>
          <p className="text-slate-400 mt-1">
            Comprehensive view of all portfolio positions
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setLoading(true)
              fetchHoldings()
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors shadow-lg shadow-blue-500/20"
            disabled={loading}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Prices
          </button>
          <div className="text-right">
            <p className="text-sm text-slate-400">Total Portfolio Value</p>
            <p className="text-2xl font-bold text-white">
              ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 shadow-lg">
          <p className="text-sm text-slate-400 mb-1">Total Holdings</p>
          <p className="text-2xl font-bold text-white">{holdings.length}</p>
        </div>
        
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 shadow-lg">
          <p className="text-sm text-slate-400 mb-1">Market Value</p>
          <p className="text-2xl font-bold text-white">
            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 shadow-lg">
          <p className="text-sm text-slate-400 mb-1">Total Shares</p>
          <p className="text-2xl font-bold text-white">
            {totalShares.toLocaleString()}
          </p>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 shadow-lg">
          <p className="text-sm text-slate-400 mb-1">Average Weight</p>
          <p className="text-2xl font-bold text-white">
            {avgWeight.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700 border-b border-slate-600">
              <tr>
                {/* 1. Ticker */}
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('stock_ticker')}
                    className="flex items-center gap-1 text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    Ticker
                    {sortColumn === 'stock_ticker' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 2. Name */}
                <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Name
                </th>
                {/* 3. Weight */}
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('calculated_weight')}
                    className="flex items-center gap-1 ml-auto text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    Weight
                    {sortColumn === 'calculated_weight' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 4. Shares */}
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('shares')}
                    className="flex items-center gap-1 ml-auto text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    Shares
                    {sortColumn === 'shares' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 5. Current Price */}
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('current_price')}
                    className="flex items-center gap-1 ml-auto text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    Current Price
                    {sortColumn === 'current_price' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 6. % Change */}
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('calculated_pct_change')}
                    className="flex items-center gap-1 ml-auto text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    % Change
                    {sortColumn === 'calculated_pct_change' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 7. Market Value */}
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('calculated_market_value')}
                    className="flex items-center gap-1 ml-auto text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    Market Value
                    {sortColumn === 'calculated_market_value' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 8. Avg Index Weight */}
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('avg_index_weight')}
                    className="flex items-center gap-1 ml-auto text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    Avg Index Weight
                    {sortColumn === 'avg_index_weight' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 9. Index Ratio */}
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('index_ratio')}
                    className="flex items-center gap-1 ml-auto text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    Index Ratio
                    {sortColumn === 'index_ratio' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 10. QQQ Weight */}
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('qqq_weight')}
                    className="flex items-center gap-1 ml-auto text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    QQQ Weight
                    {sortColumn === 'qqq_weight' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 11. S&P Weight */}
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('sp_weight')}
                    className="flex items-center gap-1 ml-auto text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    S&P Weight
                    {sortColumn === 'sp_weight' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 12. Earnings Date */}
                <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Earnings Date
                </th>
                {/* 13. Earnings Time */}
                <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Earnings Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {sortedHoldings.map((holding) => (
                <tr key={holding.stock_ticker} className="hover:bg-slate-700/50 transition-colors">
                  {/* 1. Ticker */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-300">{holding.stock_ticker}</span>
                  </td>
                  {/* 2. Name */}
                  <td className="px-4 py-3 text-sm text-slate-300">
                    {holding.security_name}
                  </td>
                  {/* 3. Weight (calculated) */}
                  <td className="px-4 py-3 text-right text-sm font-medium text-white">
                    {holding.calculated_weight.toFixed(2)}%
                  </td>
                  {/* 4. Shares */}
                  <td className="px-4 py-3 text-right text-sm text-white">
                    {holding.shares.toLocaleString()}
                  </td>
                  {/* 5. Current Price (use close_price as fallback) */}
                  <td className="px-4 py-3 text-right text-sm text-white">
                    ${(holding.current_price || holding.close_price).toFixed(2)}
                    {!holding.current_price && <span className="text-xs text-zinc-400 ml-1">(close)</span>}
                  </td>
                  {/* 6. % Change (calculated) */}
                  <td className={`px-4 py-3 text-right text-sm font-medium ${holding.calculated_pct_change > 0 ? 'text-green-400' : holding.calculated_pct_change < 0 ? 'text-red-400' : 'text-white'}`}>
                    {holding.current_price ? (
                      `${holding.calculated_pct_change >= 0 ? '+' : ''}${holding.calculated_pct_change.toFixed(2)}%`
                    ) : (
                      <span className="text-zinc-400">-</span>
                    )}
                  </td>
                  {/* 7. Market Value (calculated) */}
                  <td className="px-4 py-3 text-right text-sm font-medium text-white">
                    ${holding.calculated_market_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  {/* 8. Avg Index Weight (calculated from SPY + QQQ) */}
                  <td className={`px-4 py-3 text-right text-sm ${holding.avg_index_weight ? 'text-white' : 'text-slate-500 italic'}`}>
                    {holding.avg_index_weight ? `${holding.avg_index_weight.toFixed(2)}%` : '-'}
                  </td>
                  {/* 9. Index Ratio (Portfolio Weight / QQQ Weight) */}
                  <td className={`px-4 py-3 text-right text-sm ${holding.index_ratio ? 'text-white' : 'text-slate-500 italic'}`}>
                    {holding.index_ratio ? `${holding.index_ratio.toFixed(2)}x` : '-'}
                  </td>
                  {/* 10. QQQ Weight (from weightings table) */}
                  <td className={`px-4 py-3 text-right text-sm ${holding.qqq_weight ? 'text-white' : 'text-slate-500 italic'}`}>
                    {holding.qqq_weight ? `${holding.qqq_weight.toFixed(2)}%` : '-'}
                  </td>
                  {/* 11. S&P Weight (from weightings table) */}
                  <td className={`px-4 py-3 text-right text-sm ${holding.sp_weight ? 'text-white' : 'text-slate-500 italic'}`}>
                    {holding.sp_weight ? `${holding.sp_weight.toFixed(2)}%` : '-'}
                  </td>
                  {/* 12. Earnings Date (placeholder) */}
                  <td className="px-4 py-3 text-sm text-slate-500 italic">
                    {holding.earnings_date || '-'}
                  </td>
                  {/* 13. Earnings Time (placeholder) */}
                  <td className="px-4 py-3 text-sm text-slate-500 italic">
                    {holding.earnings_time || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
