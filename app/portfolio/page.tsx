'use client'

import { useState, useEffect } from 'react'
import { setupSynchronizedRefresh } from '@/lib/utils/refreshSync'

interface NetWeightRow {
  ticker: string
  name: string
  shares: number
  market_value: number
  holding_weight: number
  shorts: number | null
  benchmark_weight: number | null
  net_weight: number | null
}

interface PortfolioData {
  date: string
  benchmark: string
  totalMarketValue: number
  rows: NetWeightRow[]
}

const BENCHMARKS = [
  { value: 'spy', label: 'SPY (S&P 500)' },
  { value: 'qqq', label: 'QQQ (Nasdaq 100)' },
  { value: 'xlk', label: 'XLK (Technology)' },
  { value: 'xlf', label: 'XLF (Financials)' },
  { value: 'xlc', label: 'XLC (Communications)' },
  { value: 'xly', label: 'XLY (Consumer Discretionary)' },
  { value: 'xlp', label: 'XLP (Consumer Staples)' },
  { value: 'xle', label: 'XLE (Energy)' },
  { value: 'xlv', label: 'XLV (Healthcare)' },
  { value: 'xli', label: 'XLI (Industrials)' },
  { value: 'xlb', label: 'XLB (Materials)' },
  { value: 'xlre', label: 'XLRE (Real Estate)' },
  { value: 'xlu', label: 'XLU (Utilities)' },
  { value: 'igv', label: 'IGV (Software)' },
  { value: 'ita', label: 'ITA (Aerospace/Defense)' },
  { value: 'soxx', label: 'SOXX (Semiconductors)' },
  { value: 'smh', label: 'SMH (Semiconductors)' },
  { value: 'arkk', label: 'ARKK (Innovation)' },
]

export default function NetWeightCalculationsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedBenchmark, setSelectedBenchmark] = useState('spy')

  // Fetch portfolio data with selected benchmark
  const fetchPortfolioData = async (isInitialLoad: boolean = false, benchmark: string = selectedBenchmark) => {
    try {
      if (isInitialLoad) {
        setLoading(true)
        setPortfolioData(null)
      } else {
        setIsRefreshing(true)
      }
      
      const response = await fetch(`/api/portfolio?benchmark=${benchmark}&t=${Date.now()}`, {
        cache: 'no-store'
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch net weight calculations')
      }
      
      const result = await response.json()
      
      if (result.success && result.data) {
        setPortfolioData(result.data)
        setError(null)
      } else {
        throw new Error(result.message || 'Failed to load net weight calculations')
      }
    } catch (err) {
      console.error('Error fetching net weight calculations:', err)
      if (isInitialLoad) {
        setError(err instanceof Error ? err.message : 'Failed to load net weight calculations')
      }
    } finally {
      if (isInitialLoad) {
        setLoading(false)
      } else {
        setIsRefreshing(false)
      }
    }
  }

  // Initial fetch and synchronized auto-refresh
  useEffect(() => {
    fetchPortfolioData(true)
    
    const cleanup = setupSynchronizedRefresh(() => {
      console.log('Auto-refreshing net weight calculations (synchronized)...')
      fetchPortfolioData(false)
    }, 60000)
    
    return cleanup
  }, [])

  // Refetch when benchmark changes
  useEffect(() => {
    if (!loading && portfolioData) {
      fetchPortfolioData(false, selectedBenchmark)
    }
  }, [selectedBenchmark])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-300">Loading net weight calculations...</p>
        </div>
      </div>
    )
  }

  if (error || !portfolioData) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center max-w-md">
          <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-white mb-2">
            Unable to Load Data
          </h3>
          <p className="text-slate-400 mb-4">
            {error || 'No data available'}
          </p>
          <button
            onClick={() => fetchPortfolioData(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors shadow-lg shadow-blue-500/20"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const { date, totalMarketValue, rows } = portfolioData

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  // Format percentage
  const formatPercent = (value: number | null, decimals: number = 2) => {
    if (value === null) return 'N/A'
    return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
  }

  // Format decimal (for shorts column)
  const formatDecimal = (value: number | null, decimals: number = 4) => {
    if (value === null) return ''
    return (value / 100).toFixed(decimals)
  }

  // Color class for net weight
  const getNetWeightColor = (value: number | null) => {
    if (value === null) return 'text-slate-400'
    if (value > 1) return 'text-green-400'
    if (value < -1) return 'text-red-400'
    return 'text-slate-300'
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Net Weight Calculations
          </h1>
          <p className="text-slate-400 mt-1">
            Holdings vs. Benchmark Weightings • Date: {date}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isRefreshing && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span>Updating...</span>
            </div>
          )}
          <button
            onClick={() => fetchPortfolioData(false)}
            disabled={loading || isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors shadow-lg shadow-blue-500/20"
          >
            <svg className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
          <p className="text-sm font-medium text-slate-400 mb-2">Total Market Value</p>
          <p className="text-3xl font-bold text-white">{formatCurrency(totalMarketValue)}</p>
        </div>
        
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
          <p className="text-sm font-medium text-slate-400 mb-2">Total Holdings</p>
          <p className="text-3xl font-bold text-white">{rows.length}</p>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
          <label className="text-sm font-medium text-slate-400 block mb-2">
            Benchmark Index
          </label>
          <select
            value={selectedBenchmark}
            onChange={(e) => setSelectedBenchmark(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {BENCHMARKS.map((benchmark) => (
              <option key={benchmark.value} value={benchmark.value}>
                {benchmark.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Net Weight Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 border-b border-slate-700">
              <tr>
                <th className="text-left py-4 px-4 font-semibold text-white">Ticker</th>
                <th className="text-left py-4 px-4 font-semibold text-white">Name</th>
                <th className="text-right py-4 px-4 font-semibold text-white">Shares</th>
                <th className="text-right py-4 px-4 font-semibold text-white">Market Value</th>
                <th className="text-right py-4 px-4 font-semibold text-white">Holding Wt%</th>
                <th className="text-right py-4 px-4 font-semibold text-white">Shorts</th>
                <th className="text-right py-4 px-4 font-semibold text-white">Benchmark Wt%</th>
                <th className="text-right py-4 px-4 font-semibold text-white">Net Weight</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={row.ticker}
                  className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${
                    idx % 2 === 0 ? 'bg-slate-800/50' : 'bg-slate-800'
                  }`}
                >
                  <td className="py-3 px-4 font-mono font-semibold text-blue-400">
                    {row.ticker}
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {row.name}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-300 font-mono">
                    {row.shares.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-300 font-mono">
                    {formatCurrency(row.market_value)}
                  </td>
                  <td className="py-3 px-4 text-right text-white font-semibold">
                    {row.holding_weight.toFixed(2)}%
                  </td>
                  <td className="py-3 px-4 text-right text-red-400 font-mono">
                    {formatDecimal(row.shorts)}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-400">
                    {row.benchmark_weight !== null ? `${row.benchmark_weight.toFixed(2)}%` : 'N/A'}
                  </td>
                  <td className={`py-3 px-4 text-right font-bold ${getNetWeightColor(row.net_weight)}`}>
                    {formatPercent(row.net_weight)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-lg">
        <h3 className="text-sm font-semibold text-white mb-3">Legend</h3>
        
        {/* Net Weight Colors */}
        <div className="mb-3">
          <p className="text-xs font-medium text-slate-300 mb-2">Net Weight Colors:</p>
          <div className="flex flex-wrap gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-400 rounded"></div>
              <span>Overweight (&gt;1%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-400 rounded"></div>
              <span>Underweight (&lt;-1%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-slate-300 rounded"></div>
              <span>Neutral (-1% to 1%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-slate-400 rounded"></div>
              <span>Not in benchmark (N/A)</span>
            </div>
          </div>
        </div>

        {/* Shorts Explanation */}
        <div>
          <p className="text-xs font-medium text-slate-300 mb-2">Shorts Column:</p>
          <div className="text-xs text-slate-400 space-y-1">
            <p>• Shows leverage-adjusted short exposure for inverse ETFs (as decimal)</p>
            <p>• 3x inverse: SPXU, SQQQ, SDOW, SOXS (holding weight × 3)</p>
            <p>• 2x inverse: QID, SDS (holding weight × 2)</p>
            <p>• 1x inverse: SARK, PSQ, SH (holding weight × 1)</p>
            <p>• Blank for regular long positions</p>
          </div>
        </div>
      </div>
    </div>
  )
}
