'use client'

import { useState, useEffect } from 'react'
import { setupSynchronizedRefresh } from '@/lib/utils/refreshSync'

interface PerformanceData {
  name: string
  daily: number
  wtd: number
  mtd: number
  ytd: number
}

interface KeyMetric {
  label: string
  value: string
}

interface Holding {
  ticker: string
  weight: number
}

interface PortfolioData {
  nav: number
  performance: PerformanceData[]
  keyMetrics: KeyMetric[]
  holdings: Holding[]
}

export default function PortfolioPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Initial fetch and synchronized auto-refresh
  useEffect(() => {
    fetchPortfolioData(true) // Initial load
    
    // Setup synchronized refresh (fires at top of each minute)
    const cleanup = setupSynchronizedRefresh(() => {
      console.log('Auto-refreshing portfolio data in background (synchronized)...')
      fetchPortfolioData(false) // Background refresh
    }, 60000) // 60 seconds
    
    return cleanup
  }, [])

  const fetchPortfolioData = async (isInitialLoad: boolean = false) => {
    try {
      // Only show full loading state on initial load
      if (isInitialLoad) {
        setLoading(true)
        setPortfolioData(null)
      } else {
        setIsRefreshing(true)
      }
      
      // Add cache-busting timestamp
      const response = await fetch(`/api/portfolio?t=${Date.now()}`, {
        cache: 'no-store'
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch portfolio data')
      }
      
      const result = await response.json()
      
      console.log('Portfolio API Response:', result)
      
      if (result.success && result.data) {
        console.log('Setting NAV:', result.data.nav)
        setPortfolioData(result.data)
        setError(null)
      } else {
        throw new Error(result.message || 'Failed to load portfolio data')
      }
    } catch (err) {
      console.error('Error fetching portfolio:', err)
      // Only set error on initial load, ignore errors during background refresh
      if (isInitialLoad) {
        setError(err instanceof Error ? err.message : 'Failed to load portfolio data')
      }
    } finally {
      if (isInitialLoad) {
        setLoading(false)
      } else {
        setIsRefreshing(false)
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-300">Loading portfolio data...</p>
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
            Unable to Load Portfolio
          </h3>
          <p className="text-slate-400 mb-4">
            {error || 'No portfolio data available'}
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

  const { nav, performance: performanceData, keyMetrics, holdings } = portfolioData

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Portfolio Overview
          </h1>
          <p className="text-slate-400 mt-1">
            Current portfolio holdings and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Subtle refresh indicator */}
          {isRefreshing && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span>Updating...</span>
            </div>
          )}
          {!isRefreshing && (
            <span className="text-sm text-slate-400">
              Auto-refresh synced (top of each minute)
            </span>
          )}
          <button
            onClick={() => fetchPortfolioData(false)}
            disabled={loading || isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors shadow-lg shadow-blue-500/20"
          >
            <svg className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isRefreshing ? 'Refreshing...' : 'Refresh Now'}
          </button>
        </div>
      </div>

      {/* Top Section: NAV + Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* NAV Card */}
        <div className="lg:col-span-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 h-full flex flex-col justify-center shadow-xl">
            <p className="text-sm font-medium text-slate-400 mb-2">
              Net Asset Value
            </p>
            <p className="text-4xl font-bold text-white">
              ${nav.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Performance Grid */}
        <div className="lg:col-span-8">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 overflow-x-auto shadow-xl">
            <p className="text-sm font-medium text-slate-400 mb-4">
              Performance Metrics
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left py-3 px-4 font-medium text-white">
                    Index
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-white">
                    Daily
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-white">
                    Week
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-white">
                    MTD
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-white">
                    YTD
                  </th>
                </tr>
              </thead>
              <tbody>
                {performanceData.map((row, idx) => (
                  <tr
                    key={row.name}
                    className={`${
                      idx === 0 ? 'bg-blue-900/30' : ''
                    } border-b border-slate-700/50`}
                  >
                    <td className="py-3 px-4 font-medium text-white">
                      {row.name}
                    </td>
                    <td className={`text-right py-3 px-4 ${row.daily >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {row.daily > 0 ? '+' : ''}{row.daily.toFixed(1)}%
                    </td>
                    <td className={`text-right py-3 px-4 ${row.wtd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {row.wtd > 0 ? '+' : ''}{row.wtd.toFixed(1)}%
                    </td>
                    <td className={`text-right py-3 px-4 ${row.mtd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {row.mtd > 0 ? '+' : ''}{row.mtd.toFixed(1)}%
                    </td>
                    <td className={`text-right py-3 px-4 ${row.ytd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {row.ytd > 0 ? '+' : ''}{row.ytd.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {keyMetrics.map((metric) => (
          <div
            key={metric.label}
            className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-lg"
          >
            <p className="text-xs font-medium text-slate-400 mb-2">
              {metric.label}
            </p>
            <p className="text-2xl font-bold text-white">
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      {/* Holdings Grid */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-white mb-4">
          Current Holdings
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {holdings.map((holding) => (
            <div
              key={holding.ticker}
              className="bg-slate-700 rounded-lg p-4 border border-slate-600 hover:border-blue-400 hover:bg-slate-600 transition-colors cursor-pointer"
            >
              <p className="font-semibold text-white text-sm mb-1">
                {holding.ticker}
              </p>
              <p className="text-lg font-bold text-blue-400">
                {holding.weight.toFixed(1)}%
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
