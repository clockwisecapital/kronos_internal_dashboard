'use client'

import { useState, useEffect } from 'react'

// ===== INTERFACES =====

interface ExposureRow {
  gics: string
  index: string
  current_weight: number
  net_weight: number
  spy_weighting: number
  qqq_weighting: number
  in_index: number
  not_in_index: number
  igv_weighting?: number
  ita_weighting?: number
  smh_weighting?: number
  arkk_weighting?: number
}

interface PortfolioComposition {
  core: number
  non_core: number
}

interface PortfolioBias {
  risk_on: number
  risk_off: number
}

interface PortfolioExposure {
  long: number
  short: number
  net_exposure: number
}

interface ExposureData {
  date: string
  sector_exposure: ExposureRow[]
  composition: PortfolioComposition
  bias: PortfolioBias
  exposure: PortfolioExposure
  total_market_value: number
}

// ===== MAIN COMPONENT =====

export default function ExposurePage() {
  const [data, setData] = useState<ExposureData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortColumn, setSortColumn] = useState<keyof ExposureRow>('current_weight')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    fetchExposureData()
  }, [])

  const fetchExposureData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/exposure')
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch exposure data')
      }

      setData(result.data)
    } catch (err) {
      console.error('Error fetching exposure data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch exposure data')
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (column: keyof ExposureRow) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('desc')
    }
  }

  const sortedRows = data?.sector_exposure ? [...data.sector_exposure].sort((a, b) => {
    // Keep special rows at the bottom
    const specialRows = ['Hedge', 'Other', 'Cash', 'Total']
    const aIsSpecial = specialRows.includes(a.gics)
    const bIsSpecial = specialRows.includes(b.gics)

    if (aIsSpecial && !bIsSpecial) return 1
    if (!aIsSpecial && bIsSpecial) return -1
    if (aIsSpecial && bIsSpecial) {
      return specialRows.indexOf(a.gics) - specialRows.indexOf(b.gics)
    }

    const aValue = a[sortColumn]
    const bValue = b[sortColumn]

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
    }

    const aStr = String(aValue || '')
    const bStr = String(bValue || '')
    return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
  }) : []

  // Format percentage
  const formatPct = (value: number | undefined) => {
    if (value === undefined || value === null) return '—'
    return `${value.toFixed(1)}%`
  }

  // Get color for weight comparison
  const getWeightColor = (current: number, benchmark: number) => {
    if (benchmark === 0) return 'text-slate-300'
    const diff = current - benchmark
    if (diff > 5) return 'text-green-400'
    if (diff < -5) return 'text-red-400'
    return 'text-slate-300'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
        <div className="max-w-[1800px] mx-auto">
          <h1 className="text-3xl font-bold mb-8">Exposure</h1>
          <div className="flex items-center justify-center py-20">
            <div className="text-slate-400">Loading exposure data...</div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
        <div className="max-w-[1800px] mx-auto">
          <h1 className="text-3xl font-bold mb-8">Exposure</h1>
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-6">
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
        <div className="max-w-[1800px] mx-auto">
          <h1 className="text-3xl font-bold mb-8">Exposure</h1>
          <div className="text-slate-400">No exposure data available</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Exposure</h1>
            <p className="text-slate-400 mt-1">As of {data.date}</p>
          </div>
          <button
            onClick={fetchExposureData}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Main Sector Exposure Table */}
        <div className="bg-slate-800 rounded-lg shadow-xl overflow-hidden mb-8">
          <div className="overflow-x-auto max-h-[800px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-slate-700 sticky top-0 z-10">
                <tr>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-600"
                    onClick={() => handleSort('gics')}
                  >
                    GICS {sortColumn === 'gics' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-600"
                    onClick={() => handleSort('index')}
                  >
                    Index {sortColumn === 'index' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-600"
                    onClick={() => handleSort('current_weight')}
                  >
                    Current Weight {sortColumn === 'current_weight' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-600"
                    onClick={() => handleSort('net_weight')}
                  >
                    Net Weight {sortColumn === 'net_weight' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-600"
                    onClick={() => handleSort('spy_weighting')}
                  >
                    S&P Weight {sortColumn === 'spy_weighting' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-600"
                    onClick={() => handleSort('qqq_weighting')}
                  >
                    QQQ Weight {sortColumn === 'qqq_weighting' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-600"
                    onClick={() => handleSort('in_index')}
                  >
                    In Index {sortColumn === 'in_index' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-600"
                    onClick={() => handleSort('not_in_index')}
                  >
                    Not in Index {sortColumn === 'not_in_index' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {sortedRows.map((row, idx) => {
                  const isSpecialRow = ['Hedge', 'Other', 'Cash', 'Total'].includes(row.gics)
                  const isTotalRow = row.gics === 'Total'
                  
                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-700/50 transition-colors ${
                        isTotalRow ? 'bg-slate-700 font-bold' : ''
                      } ${isSpecialRow && !isTotalRow ? 'bg-slate-800/50' : ''}`}
                    >
                      <td className="px-4 py-3 text-sm">{row.gics}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{row.index || '—'}</td>
                      <td className="px-4 py-3 text-sm text-right font-mono">
                        {formatPct(row.current_weight)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono">
                        {formatPct(row.net_weight)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-slate-400">
                        {formatPct(row.spy_weighting)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-slate-400">
                        {formatPct(row.qqq_weighting)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-blue-400">
                        {formatPct(row.in_index)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-amber-400">
                        {formatPct(row.not_in_index)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Portfolio Composition */}
          <div className="bg-slate-800 rounded-lg shadow-xl p-6">
            <h2 className="text-xl font-bold mb-6 text-slate-300">Portfolio Composition</h2>
            <div className="space-y-4">
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="text-sm text-slate-400 mb-1">Core</div>
                <div className="text-3xl font-bold text-blue-400">
                  {formatPct(data.composition.core)}
                </div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="text-sm text-slate-400 mb-1">Non-Core</div>
                <div className="text-3xl font-bold text-purple-400">
                  {formatPct(data.composition.non_core)}
                </div>
              </div>
            </div>
          </div>

          {/* Portfolio Bias */}
          <div className="bg-slate-800 rounded-lg shadow-xl p-6">
            <h2 className="text-xl font-bold mb-6 text-slate-300">Portfolio Bias</h2>
            <div className="space-y-4">
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="text-sm text-slate-400 mb-1">Risk On</div>
                <div className="text-3xl font-bold text-green-400">
                  {formatPct(data.bias.risk_on)}
                </div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="text-sm text-slate-400 mb-1">Risk Off</div>
                <div className="text-3xl font-bold text-orange-400">
                  {formatPct(data.bias.risk_off)}
                </div>
              </div>
            </div>
          </div>

          {/* Portfolio Exposure */}
          <div className="bg-slate-800 rounded-lg shadow-xl p-6">
            <h2 className="text-xl font-bold mb-6 text-slate-300">Portfolio Exposure</h2>
            <div className="space-y-4">
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="text-sm text-slate-400 mb-1">Long</div>
                <div className="text-3xl font-bold text-green-400">
                  {formatPct(data.exposure.long)}
                </div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="text-sm text-slate-400 mb-1">Short</div>
                <div className="text-3xl font-bold text-red-400">
                  {formatPct(data.exposure.short)}
                </div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="text-sm text-slate-400 mb-1">Net Exposure</div>
                <div className="text-3xl font-bold text-cyan-400">
                  {formatPct(data.exposure.net_exposure)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Index Weightings Section */}
        <div className="mt-8 bg-slate-800 rounded-lg shadow-xl p-6">
          <h2 className="text-xl font-bold mb-4 text-slate-300">Additional Index Weightings</h2>
          <div className="overflow-x-auto max-h-[800px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-slate-700 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    GICS
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Index
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    IGV Weight
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    ITA Weight
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    SMH Weight
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    ARKK Weight
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {sortedRows
                  .filter(row => !['Hedge', 'Other', 'Cash', 'Total'].includes(row.gics))
                  .map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-700/50 transition-colors">
                      <td className="px-4 py-3 text-sm">{row.gics}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{row.index || '—'}</td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-slate-400">
                        {formatPct(row.igv_weighting)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-slate-400">
                        {formatPct(row.ita_weighting)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-slate-400">
                        {formatPct(row.smh_weighting)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-slate-400">
                        {formatPct(row.arkk_weighting)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
