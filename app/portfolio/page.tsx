'use client'

import { useState, useEffect } from 'react'
import { setupSynchronizedRefresh } from '@/lib/utils/refreshSync'

interface NetWeightRow {
  ticker: string
  name: string
  shares: number
  market_value: number
  holding_weight: number
  // Individual inverse ETF contributions
  sqqq: number
  qid: number
  psq: number
  short_qqq: number
  weight_in_qqq: number | null
  spxu: number
  sds: number
  sh: number
  short_spy: number
  weight_in_spy: number | null
  sdow: number
  dxd: number
  dog: number
  short_dow: number
  weight_in_dow: number | null
  soxs: number
  weight_in_soxx: number | null
  sark: number
  weight_in_sark: number | null
  effective_short: number
  net_weight: number
}

interface IndexShortTotals {
  qqq: number
  spy: number
  dow: number
  soxx: number
  arkk: number
}

interface PortfolioData {
  date: string
  totalMarketValue: number
  indexShortTotals: IndexShortTotals
  rows: NetWeightRow[]
}

export default function NetWeightCalculationsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Fetch portfolio data
  const fetchPortfolioData = async (isInitialLoad: boolean = false) => {
    try {
      if (isInitialLoad) {
        setLoading(true)
        setPortfolioData(null)
      } else {
        setIsRefreshing(true)
      }
      
      const response = await fetch(`/api/portfolio?t=${Date.now()}`, {
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

  const { date, totalMarketValue, indexShortTotals, rows } = portfolioData

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`

  const formatShort = (value: number) => (value > 0 ? `${value.toFixed(4)}%` : '-')

  const getNetWeightColor = (value: number) => {
    if (value > 0) return 'text-green-400'
    if (value < 0) return 'text-red-400'
    return 'text-slate-300'
  }

  // Calculate total effective hedge (sum of all index shorts)
  const totalEffectiveHedge = indexShortTotals.qqq + indexShortTotals.spy + 
    indexShortTotals.dow + indexShortTotals.soxx + indexShortTotals.arkk

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Net Weight Calculations
          </h1>
          <p className="text-slate-400 mt-1">
            Portfolio exposure after accounting for inverse ETF hedges • Date: {date}
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

      {/* Summary Cards - Portfolio Value + Index Short Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {/* Portfolio Value */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-xl">
          <p className="text-xs font-medium text-slate-400 mb-1">Portfolio Value</p>
          <p className="text-xl font-bold text-white">{formatCurrency(totalMarketValue)}</p>
        </div>

        {/* Total Effective Hedge */}
        <div className="bg-slate-800 rounded-xl border border-orange-500/30 p-4 shadow-xl">
          <p className="text-xs font-medium text-slate-400 mb-1">Total Hedge</p>
          <p className="text-xl font-bold text-orange-400">{totalEffectiveHedge.toFixed(2)}%</p>
        </div>
        
        {/* QQQ Shorts */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-xl">
          <p className="text-xs font-medium text-slate-400 mb-1">QQQ Shorts</p>
          <p className="text-xl font-bold text-orange-400">{indexShortTotals.qqq.toFixed(2)}%</p>
        </div>

        {/* SPY Shorts */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-xl">
          <p className="text-xs font-medium text-slate-400 mb-1">SPY Shorts</p>
          <p className="text-xl font-bold text-orange-400">{indexShortTotals.spy.toFixed(2)}%</p>
        </div>

        {/* DOW Shorts */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-xl">
          <p className="text-xs font-medium text-slate-400 mb-1">DOW Shorts</p>
          <p className="text-xl font-bold text-orange-400">{indexShortTotals.dow.toFixed(2)}%</p>
        </div>

        {/* SOXX Shorts */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-xl">
          <p className="text-xs font-medium text-slate-400 mb-1">SOXX Shorts</p>
          <p className="text-xl font-bold text-orange-400">{indexShortTotals.soxx.toFixed(2)}%</p>
        </div>

        {/* ARKK Shorts */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-xl">
          <p className="text-xs font-medium text-slate-400 mb-1">ARKK Shorts</p>
          <p className="text-xl font-bold text-orange-400">{indexShortTotals.arkk.toFixed(2)}%</p>
        </div>
      </div>

      {/* Net Weight Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[800px] overflow-y-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-900 border-b border-slate-700 sticky top-0 z-10">
              <tr>
              <th className="sticky left-0 z-10 bg-slate-900 text-left py-3 px-3 font-semibold text-white border-r border-slate-700">Ticker</th>
              <th className="text-left py-3 px-3 font-semibold text-white">Name</th>
              <th className="text-right py-3 px-2 font-semibold text-white">Holding Wt%</th>
              {/* QQQ Inverse ETFs */}
              <th className="text-right py-3 px-2 font-semibold text-orange-400 text-[10px]">SQQQ</th>
              <th className="text-right py-3 px-2 font-semibold text-orange-400 text-[10px]">QID</th>
              <th className="text-right py-3 px-2 font-semibold text-orange-400 text-[10px]">PSQ</th>
              <th className="text-right py-3 px-2 font-semibold text-orange-400 bg-orange-900/20">SHORT QQQs</th>
              <th className="text-right py-3 px-2 font-semibold text-slate-400 text-[10px]">Wt in QQQ</th>
              {/* SPY Inverse ETFs */}
              <th className="text-right py-3 px-2 font-semibold text-orange-400 text-[10px]">SPXU</th>
              <th className="text-right py-3 px-2 font-semibold text-orange-400 text-[10px]">SDS</th>
              <th className="text-right py-3 px-2 font-semibold text-orange-400 text-[10px]">SH</th>
              <th className="text-right py-3 px-2 font-semibold text-orange-400 bg-orange-900/20">SHORT SPYs</th>
              <th className="text-right py-3 px-2 font-semibold text-slate-400 text-[10px]">Wt in SPY</th>
              {/* DOW Inverse ETFs */}
              <th className="text-right py-3 px-2 font-semibold text-orange-400 text-[10px]">SDOW</th>
              <th className="text-right py-3 px-2 font-semibold text-orange-400 text-[10px]">DXD</th>
              <th className="text-right py-3 px-2 font-semibold text-orange-400 text-[10px]">DOG</th>
              <th className="text-right py-3 px-2 font-semibold text-orange-400 bg-orange-900/20">Short DOW</th>
              <th className="text-right py-3 px-2 font-semibold text-slate-400 text-[10px]">Wt in DOW</th>
              {/* SOXS */}
              <th className="text-right py-3 px-2 font-semibold text-orange-400 text-[10px]">SOXS</th>
              <th className="text-right py-3 px-2 font-semibold text-slate-400 text-[10px]">Wt in SOXX</th>
              {/* SARK */}
              <th className="text-right py-3 px-2 font-semibold text-orange-400 text-[10px]">SARK</th>
              <th className="text-right py-3 px-2 font-semibold text-slate-400 text-[10px]">Wt in SARK</th>
              {/* Totals */}
              <th className="text-right py-3 px-3 font-semibold text-orange-400 bg-orange-900/30">EFFECTIVE SHORT</th>
              <th className="text-right py-3 px-3 font-semibold text-white bg-slate-800">NET</th>
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
                <td className="sticky left-0 z-10 bg-slate-800 py-2 px-3 font-mono font-semibold text-blue-400 border-r border-slate-700">
                  {row.ticker}
                </td>
                <td className="py-2 px-3 text-slate-300 max-w-[150px] truncate">
                  {row.name}
                </td>
                <td className="py-2 px-2 text-right text-white font-semibold">
                  {row.holding_weight.toFixed(2)}%
                </td>
                {/* QQQ Inverse ETFs */}
                <td className="py-2 px-2 text-right text-orange-300 font-mono">
                  {row.sqqq > 0 ? row.sqqq.toFixed(4) + '%' : '-'}
                </td>
                <td className="py-2 px-2 text-right text-orange-300 font-mono">
                  {row.qid > 0 ? row.qid.toFixed(4) + '%' : '-'}
                </td>
                <td className="py-2 px-2 text-right text-orange-300 font-mono">
                  {row.psq > 0 ? row.psq.toFixed(4) + '%' : '-'}
                </td>
                <td className="py-2 px-2 text-right text-orange-400 font-mono font-semibold bg-orange-900/10">
                  {row.short_qqq > 0 ? row.short_qqq.toFixed(4) + '%' : '-'}
                </td>
                <td className="py-2 px-2 text-right text-slate-400 text-[10px]">
                  {row.weight_in_qqq !== null ? row.weight_in_qqq.toFixed(2) + '%' : '-'}
                </td>
                {/* SPY Inverse ETFs */}
                <td className="py-2 px-2 text-right text-orange-300 font-mono">
                  {row.spxu > 0 ? row.spxu.toFixed(4) + '%' : '-'}
                </td>
                <td className="py-2 px-2 text-right text-orange-300 font-mono">
                  {row.sds > 0 ? row.sds.toFixed(4) + '%' : '-'}
                </td>
                <td className="py-2 px-2 text-right text-orange-300 font-mono">
                  {row.sh > 0 ? row.sh.toFixed(4) + '%' : '-'}
                </td>
                <td className="py-2 px-2 text-right text-orange-400 font-mono font-semibold bg-orange-900/10">
                  {row.short_spy > 0 ? row.short_spy.toFixed(4) + '%' : '-'}
                </td>
                <td className="py-2 px-2 text-right text-slate-400 text-[10px]">
                  {row.weight_in_spy !== null ? row.weight_in_spy.toFixed(2) + '%' : '-'}
                </td>
                {/* DOW Inverse ETFs */}
                <td className="py-2 px-2 text-right text-orange-300 font-mono">
                  {row.sdow > 0 ? row.sdow.toFixed(4) + '%' : '-'}
                </td>
                <td className="py-2 px-2 text-right text-orange-300 font-mono">
                  {row.dxd > 0 ? row.dxd.toFixed(4) + '%' : '-'}
                </td>
                <td className="py-2 px-2 text-right text-orange-300 font-mono">
                  {row.dog > 0 ? row.dog.toFixed(4) + '%' : '-'}
                </td>
                <td className="py-2 px-2 text-right text-orange-400 font-mono font-semibold bg-orange-900/10">
                  {row.short_dow > 0 ? row.short_dow.toFixed(4) + '%' : '-'}
                </td>
                <td className="py-2 px-2 text-right text-slate-400 text-[10px]">
                  {row.weight_in_dow !== null ? row.weight_in_dow.toFixed(2) + '%' : '-'}
                </td>
                {/* SOXS */}
                <td className="py-2 px-2 text-right text-orange-300 font-mono">
                  {row.soxs > 0 ? row.soxs.toFixed(4) + '%' : '-'}
                </td>
                <td className="py-2 px-2 text-right text-slate-400 text-[10px]">
                  {row.weight_in_soxx !== null ? row.weight_in_soxx.toFixed(2) + '%' : '-'}
                </td>
                {/* SARK */}
                <td className="py-2 px-2 text-right text-orange-300 font-mono">
                  {row.sark > 0 ? row.sark.toFixed(4) + '%' : '-'}
                </td>
                <td className="py-2 px-2 text-right text-slate-400 text-[10px]">
                  {row.weight_in_sark !== null ? row.weight_in_sark.toFixed(2) + '%' : '-'}
                </td>
                {/* Totals */}
                <td className="py-2 px-3 text-right text-orange-400 font-mono font-bold bg-orange-900/20">
                  {row.effective_short > 0 ? row.effective_short.toFixed(4) + '%' : '-'}
                </td>
                <td className={`py-2 px-3 text-right font-bold ${getNetWeightColor(row.net_weight)} bg-slate-700/30`}>
                  {row.net_weight.toFixed(2)}%
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
