'use client'

import { useState, useEffect } from 'react'

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

  useEffect(() => {
    fetchPortfolioData()
  }, [])

  const fetchPortfolioData = async () => {
    try {
      setLoading(true)
      setPortfolioData(null) // Clear existing data before fetching
      
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
      setError(err instanceof Error ? err.message : 'Failed to load portfolio data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-zinc-600 dark:text-zinc-400">Loading portfolio data...</p>
        </div>
      </div>
    )
  }

  if (error || !portfolioData) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center max-w-md">
          <svg className="w-16 h-16 text-zinc-400 dark:text-zinc-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
            Unable to Load Portfolio
          </h3>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            {error || 'No portfolio data available'}
          </p>
          <button
            onClick={fetchPortfolioData}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
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
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
            Portfolio Overview
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            Current portfolio holdings and performance metrics
          </p>
        </div>
        <button
          onClick={fetchPortfolioData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-400 text-white font-medium rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Data
        </button>
      </div>

      {/* Top Section: NAV + Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* NAV Card */}
        <div className="lg:col-span-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 h-full flex flex-col justify-center">
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
              Net Asset Value
            </p>
            <p className="text-4xl font-bold text-zinc-900 dark:text-white">
              ${nav.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Performance Grid */}
        <div className="lg:col-span-8">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 overflow-x-auto">
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-4">
              Performance Metrics
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="text-left py-3 px-4 font-medium text-zinc-900 dark:text-white">
                    Index
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-zinc-900 dark:text-white">
                    Daily
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-zinc-900 dark:text-white">
                    WTD
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-zinc-900 dark:text-white">
                    MTD
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-zinc-900 dark:text-white">
                    YTD
                  </th>
                </tr>
              </thead>
              <tbody>
                {performanceData.map((row, idx) => (
                  <tr
                    key={row.name}
                    className={`${
                      idx === 0 ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                    } border-b border-zinc-100 dark:border-zinc-800/50`}
                  >
                    <td className="py-3 px-4 font-medium text-zinc-900 dark:text-white">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {keyMetrics.map((metric) => (
          <div
            key={metric.label}
            className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6"
          >
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
              {metric.label}
            </p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-white">
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      {/* Holdings Grid */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
          Current Holdings
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {holdings.map((holding) => (
            <div
              key={holding.ticker}
              className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors cursor-pointer"
            >
              <p className="font-semibold text-zinc-900 dark:text-white text-sm mb-1">
                {holding.ticker}
              </p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {holding.weight.toFixed(1)}%
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
