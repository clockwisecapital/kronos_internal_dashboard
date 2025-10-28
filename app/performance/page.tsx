'use client'

import { useEffect, useState } from 'react'

interface HoldingPerformance {
  ticker: string
  weight: number
  return_1d: number
  return_5d: number
  return_30d: number
  return_qtd: number
  return_ytd: number
  contribution_1d: number
  contribution_5d: number
  contribution_30d: number
  contribution_qtd: number
  contribution_ytd: number
}

interface PortfolioTotals {
  total_contribution_1d: number
  total_contribution_5d: number
  total_contribution_30d: number
  total_contribution_qtd: number
  total_contribution_ytd: number
}

export default function PerformancePage() {
  const [performanceData, setPerformanceData] = useState<HoldingPerformance[]>([])
  const [totals, setTotals] = useState<PortfolioTotals | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPerformanceData() {
      try {
        setLoading(true)
        setError(null)
        
        console.log('Fetching performance data...')
        const response = await fetch('/api/performance')
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const json = await response.json()
        
        if (!json.success) {
          throw new Error(json.message || 'Failed to fetch performance data')
        }
        
        console.log('Performance data loaded:', json.data)
        setPerformanceData(json.data.holdings)
        setTotals(json.data.totals)
      } catch (err) {
        console.error('Error fetching performance data:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchPerformanceData()
  }, [])

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">
            Performance Attribution
          </h1>
          <p className="text-slate-400 mt-1">
            Loading performance data...
          </p>
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
          <p className="text-slate-400 mt-4">Calculating returns and contributions...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">
            Performance Attribution
          </h1>
          <p className="text-slate-400 mt-1">
            Individual holding performance and portfolio contribution analysis
          </p>
        </div>
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-6">
          <p className="text-red-400 font-semibold">Error loading performance data</p>
          <p className="text-red-300 text-sm mt-2">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          Performance Attribution
        </h1>
        <p className="text-slate-400 mt-1">
          Individual holding performance and portfolio contribution analysis
        </p>
      </div>

      {/* Combined Performance Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">
            Complete Performance Analysis
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Holdings returns and portfolio contribution across all time periods
          </p>
        </div>
        <div className="overflow-x-auto max-h-[800px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-700 border-b border-slate-600">
                <th className="text-left py-3 px-6 font-semibold text-white sticky left-0 bg-slate-700 z-20">
                  Ticker
                </th>
                <th className="text-right py-3 px-6 font-semibold text-white">
                  Weight
                </th>
                <th className="text-right py-3 px-6 font-semibold text-white bg-blue-900/30">
                  1-Day Return
                </th>
                <th className="text-right py-3 px-6 font-semibold text-white bg-blue-900/30">
                  1-Day Contrib
                </th>
                <th className="text-right py-3 px-6 font-semibold text-white bg-purple-900/30">
                  5-Day Return
                </th>
                <th className="text-right py-3 px-6 font-semibold text-white bg-purple-900/30">
                  5-Day Contrib
                </th>
                <th className="text-right py-3 px-6 font-semibold text-white bg-indigo-900/30">
                  30-Day Return
                </th>
                <th className="text-right py-3 px-6 font-semibold text-white bg-indigo-900/30">
                  30-Day Contrib
                </th>
                <th className="text-right py-3 px-6 font-semibold text-white bg-cyan-900/30">
                  QTD Return
                </th>
                <th className="text-right py-3 px-6 font-semibold text-white bg-cyan-900/30">
                  QTD Contrib
                </th>
                <th className="text-right py-3 px-6 font-semibold text-white bg-emerald-900/30">
                  YTD Return
                </th>
                <th className="text-right py-3 px-6 font-semibold text-white bg-emerald-900/30">
                  YTD Contrib
                </th>
              </tr>
            </thead>
            <tbody>
              {performanceData.map((stock) => (
                <tr
                  key={stock.ticker}
                  className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors"
                >
                  <td className="py-4 px-6 font-semibold text-white sticky left-0 bg-slate-800 hover:bg-slate-700/50">
                    {stock.ticker}
                  </td>
                  <td className="text-right py-4 px-6 text-slate-300">
                    {stock.weight.toFixed(1)}%
                  </td>
                  {/* 1-Day */}
                  <td className={`text-right py-4 px-6 font-medium bg-blue-900/10 ${stock.return_1d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.return_1d > 0 ? '+' : ''}{stock.return_1d.toFixed(1)}%
                  </td>
                  <td className={`text-right py-4 px-6 font-medium bg-blue-900/10 ${stock.contribution_1d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.contribution_1d > 0 ? '+' : ''}{stock.contribution_1d.toFixed(2)}%
                  </td>
                  {/* 5-Day */}
                  <td className={`text-right py-4 px-6 font-medium bg-purple-900/10 ${stock.return_5d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.return_5d > 0 ? '+' : ''}{stock.return_5d.toFixed(1)}%
                  </td>
                  <td className={`text-right py-4 px-6 font-medium bg-purple-900/10 ${stock.contribution_5d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.contribution_5d > 0 ? '+' : ''}{stock.contribution_5d.toFixed(2)}%
                  </td>
                  {/* 30-Day */}
                  <td className={`text-right py-4 px-6 font-medium bg-indigo-900/10 ${stock.return_30d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.return_30d > 0 ? '+' : ''}{stock.return_30d.toFixed(1)}%
                  </td>
                  <td className={`text-right py-4 px-6 font-medium bg-indigo-900/10 ${stock.contribution_30d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.contribution_30d > 0 ? '+' : ''}{stock.contribution_30d.toFixed(2)}%
                  </td>
                  {/* QTD */}
                  <td className={`text-right py-4 px-6 font-medium bg-cyan-900/10 ${stock.return_qtd >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.return_qtd > 0 ? '+' : ''}{stock.return_qtd.toFixed(1)}%
                  </td>
                  <td className={`text-right py-4 px-6 font-medium bg-cyan-900/10 ${stock.contribution_qtd >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.contribution_qtd > 0 ? '+' : ''}{stock.contribution_qtd.toFixed(2)}%
                  </td>
                  {/* YTD */}
                  <td className={`text-right py-4 px-6 font-medium bg-emerald-900/10 ${stock.return_ytd >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.return_ytd > 0 ? '+' : ''}{stock.return_ytd.toFixed(1)}%
                  </td>
                  <td className={`text-right py-4 px-6 font-medium bg-emerald-900/10 ${stock.contribution_ytd >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.contribution_ytd > 0 ? '+' : ''}{stock.contribution_ytd.toFixed(2)}%
                  </td>
                </tr>
              ))}
              {/* Totals Row */}
              {totals && (
                <tr className="bg-slate-900 border-t-2 border-blue-500 sticky bottom-0">
                  <td className="py-4 px-6 font-bold text-white sticky left-0 bg-slate-900">
                    TOTAL PORTFOLIO
                  </td>
                  <td className="text-right py-4 px-6 text-slate-300">
                    100.0%
                  </td>
                  {/* 1-Day Totals */}
                  <td className="text-right py-4 px-6 bg-blue-900/20">
                    {/* Return is same as contribution for portfolio */}
                  </td>
                  <td className={`text-right py-4 px-6 font-bold bg-blue-900/20 ${totals.total_contribution_1d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {totals.total_contribution_1d > 0 ? '+' : ''}{totals.total_contribution_1d.toFixed(2)}%
                  </td>
                  {/* 5-Day Totals */}
                  <td className="text-right py-4 px-6 bg-purple-900/20">
                    {/* Return is same as contribution for portfolio */}
                  </td>
                  <td className={`text-right py-4 px-6 font-bold bg-purple-900/20 ${totals.total_contribution_5d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {totals.total_contribution_5d > 0 ? '+' : ''}{totals.total_contribution_5d.toFixed(2)}%
                  </td>
                  {/* 30-Day Totals */}
                  <td className="text-right py-4 px-6 bg-indigo-900/20">
                    {/* Return is same as contribution for portfolio */}
                  </td>
                  <td className={`text-right py-4 px-6 font-bold bg-indigo-900/20 ${totals.total_contribution_30d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {totals.total_contribution_30d > 0 ? '+' : ''}{totals.total_contribution_30d.toFixed(2)}%
                  </td>
                  {/* QTD Totals */}
                  <td className="text-right py-4 px-6 bg-cyan-900/20">
                    {/* Return is same as contribution for portfolio */}
                  </td>
                  <td className={`text-right py-4 px-6 font-bold bg-cyan-900/20 ${totals.total_contribution_qtd >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {totals.total_contribution_qtd > 0 ? '+' : ''}{totals.total_contribution_qtd.toFixed(2)}%
                  </td>
                  {/* YTD Totals */}
                  <td className="text-right py-4 px-6 bg-emerald-900/20">
                    {/* Return is same as contribution for portfolio */}
                  </td>
                  <td className={`text-right py-4 px-6 font-bold bg-emerald-900/20 ${totals.total_contribution_ytd >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {totals.total_contribution_ytd > 0 ? '+' : ''}{totals.total_contribution_ytd.toFixed(2)}%
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
