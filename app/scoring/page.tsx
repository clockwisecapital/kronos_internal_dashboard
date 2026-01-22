'use client'

import React, { useState, useEffect } from 'react'
import ScoreCell from '@/components/scoring/ScoreCell'
import CompositeScoreCard from '@/components/scoring/CompositeScoreCard'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

interface StockScore {
  ticker: string
  shares: number
  marketValue: number
  spyWeight: number | null
  qqqWeight: number | null
  benchmark1: string | null
  benchmark2: string | null
  benchmark3: string | null
  benchmarkCustom: string | null
  
  // VALUE metrics
  peRatio: number | null
  peRatioScore: number | null
  evEbitda: number | null
  evEbitdaScore: number | null
  evSales: number | null
  evSalesScore: number | null
  targetPriceUpside: number | null
  targetPriceUpsideScore: number | null
  valueScore: number | null
  
  // MOMENTUM metrics
  return12MEx1M: number | null
  return12MEx1MScore: number | null
  return3M: number | null
  return3MScore: number | null
  pct52WeekHigh: number | null
  pct52WeekHighScore: number | null
  epsSurprise: number | null
  epsSurpriseScore: number | null
  revSurprise: number | null
  revSurpriseScore: number | null
  ntmEpsChange: number | null
  ntmEpsChangeScore: number | null
  ntmRevChange: number | null
  ntmRevChangeScore: number | null
  momentumScore: number | null
  
  // QUALITY metrics
  roicTTM: number | null
  roicTTMScore: number | null
  grossProfitability: number | null
  grossProfitabilityScore: number | null
  accruals: number | null
  accrualsScore: number | null
  fcfToAssets: number | null
  fcfToAssetsScore: number | null
  roic3Yr: number | null
  roic3YrScore: number | null
  ebitdaMargin: number | null
  ebitdaMarginScore: number | null
  qualityScore: number | null
  
  // RISK metrics
  beta3Yr: number | null
  beta3YrScore: number | null
  volatility30Day: number | null
  volatility30DayScore: number | null
  maxDrawdown: number | null
  maxDrawdownScore: number | null
  financialLeverage: number | null
  financialLeverageScore: number | null
  riskScore: number | null
  
  // Total
  totalScore: number | null
}

interface ScoringResponse {
  success: boolean
  profile?: string
  data?: StockScore[]
  metadata?: {
    holdingsCount: number
    holdingsDate: string
    calculatedAt: string
  }
  message?: string
}

export default function ScoringPage() {
  const [profile, setProfile] = useState<'BASE' | 'CAUTIOUS' | 'AGGRESSIVE'>('BASE')
  const [benchmark, setBenchmark] = useState<'BENCHMARK1' | 'BENCHMARK2' | 'BENCHMARK3' | 'BENCHMARK_CUSTOM'>('BENCHMARK1')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scores, setScores] = useState<StockScore[]>([])
  const [metadata, setMetadata] = useState<ScoringResponse['metadata'] | null>(null)
  const [sortField, setSortField] = useState<keyof StockScore>('ticker')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  
  // Universe table state
  const [universeData, setUniverseData] = useState<StockScore[]>([])
  const [universeLoading, setUniverseLoading] = useState(false)
  const [universeError, setUniverseError] = useState<string | null>(null)
  const [universePage, setUniversePage] = useState(1)
  const [universePageSize, setUniversePageSize] = useState(50)
  const [universeTotalCount, setUniverseTotalCount] = useState(0)
  const [universeTotalPages, setUniverseTotalPages] = useState(0)
  const [universeExpandedRow, setUniverseExpandedRow] = useState<string | null>(null)

  useEffect(() => {
    fetchScores()
  }, [profile, benchmark])

  useEffect(() => {
    fetchUniverseData()
  }, [profile, benchmark, universePage, universePageSize])

  const fetchScores = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/scoring?profile=${profile}&benchmark=${benchmark}`)
      const data: ScoringResponse = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch scores')
      }
      
      setScores(data.data || [])
      setMetadata(data.metadata || null)
    } catch (err) {
      console.error('Error fetching scores:', err)
      setError(err instanceof Error ? err.message : 'Failed to load scoring data')
    } finally {
      setLoading(false)
    }
  }

  const fetchUniverseData = async () => {
    try {
      setUniverseLoading(true)
      setUniverseError(null)
      
      const response = await fetch(
        `/api/scoring/universe?profile=${profile}&benchmark=${benchmark}&page=${universePage}&pageSize=${universePageSize}`
      )
      
      if (!response.ok) {
        throw new Error('Failed to fetch universe data')
      }
      
      const result = await response.json()
      setUniverseData(result.scores || [])
      setUniverseTotalCount(result.pagination?.totalCount || 0)
      setUniverseTotalPages(result.pagination?.totalPages || 0)
    } catch (err) {
      console.error('Error fetching universe data:', err)
      setUniverseError(err instanceof Error ? err.message : 'Failed to load universe data')
    } finally {
      setUniverseLoading(false)
    }
  }

  const handleSort = (field: keyof StockScore) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const sortedScores = [...scores].sort((a, b) => {
    const aVal = a[sortField]
    const bVal = b[sortField]
    
    if (aVal === null) return 1
    if (bVal === null) return -1
    
    const comparison = aVal > bVal ? 1 : -1
    return sortDirection === 'asc' ? comparison : -comparison
  })

  if (loading) {
    return (
      <div className="p-8 bg-slate-900 min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
            <p className="text-slate-300">Calculating scores... This may take a few minutes.</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 bg-slate-900 min-h-screen">
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-6">
          <h2 className="text-red-400 font-semibold mb-2">Error Loading Scores</h2>
          <p className="text-red-300">{error}</p>
          <button
            onClick={fetchScores}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 bg-slate-900 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Portfolio Scoring</h1>
        <p className="text-slate-400">
          Comprehensive scoring across VALUE, MOMENTUM, QUALITY, and RISK dimensions
        </p>
      </div>

      {/* Controls */}
      <div className="bg-slate-800 rounded-lg shadow-sm border border-slate-700 p-4 mb-6">
        <div className="flex items-center gap-6">
          {/* Profile Selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-300">Profile:</label>
            <select
              value={profile}
              onChange={(e) => setProfile(e.target.value as 'BASE' | 'CAUTIOUS' | 'AGGRESSIVE')}
              className="px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="BASE">BASE</option>
              <option value="CAUTIOUS">CAUTIOUS</option>
              <option value="AGGRESSIVE">AGGRESSIVE</option>
            </select>
          </div>

          {/* Benchmark Selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-300">Benchmark:</label>
            <select
              value={benchmark}
              onChange={(e) => setBenchmark(e.target.value as 'BENCHMARK1' | 'BENCHMARK2' | 'BENCHMARK3' | 'BENCHMARK_CUSTOM')}
              className="px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="BENCHMARK1">Benchmark 1</option>
              <option value="BENCHMARK2">Benchmark 2</option>
              <option value="BENCHMARK3">Benchmark 3</option>
              <option value="BENCHMARK_CUSTOM">Benchmark Custom</option>
            </select>
          </div>

          {/* Metadata */}
          {metadata && (
            <div className="ml-auto text-sm text-slate-400">
              <span>{metadata.holdingsCount} holdings</span>
              <span className="mx-2">•</span>
              <span>Date: {new Date(metadata.holdingsDate).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Scores Table */}
      <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto max-h-[800px] overflow-y-auto">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-700 border-b border-slate-600 sticky top-0 z-10">
              <tr>
                <th 
                  className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider cursor-pointer hover:text-blue-400"
                  onClick={() => handleSort('ticker')}
                >
                  Ticker
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider"
                >
                  {benchmark === 'BENCHMARK1' ? 'Benchmark 1' : 
                   benchmark === 'BENCHMARK2' ? 'Benchmark 2' : 
                   benchmark === 'BENCHMARK3' ? 'Benchmark 3' : 
                   'Benchmark Custom'}
                </th>
                <th 
                  className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider cursor-pointer hover:text-blue-400"
                  onClick={() => handleSort('valueScore')}
                >
                  VALUE
                </th>
                <th 
                  className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider cursor-pointer hover:text-blue-400"
                  onClick={() => handleSort('momentumScore')}
                >
                  MOMENTUM
                </th>
                <th 
                  className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider cursor-pointer hover:text-blue-400"
                  onClick={() => handleSort('qualityScore')}
                >
                  QUALITY
                </th>
                <th 
                  className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider cursor-pointer hover:text-blue-400"
                  onClick={() => handleSort('riskScore')}
                >
                  RISK
                </th>
                <th 
                  className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider cursor-pointer hover:text-blue-400"
                  onClick={() => handleSort('totalScore')}
                >
                  TOTAL SCORE
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-slate-800 divide-y divide-slate-700">
              {sortedScores.map((stock) => (
                <React.Fragment key={stock.ticker}>
                  <tr className="hover:bg-slate-700/50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-white">{stock.ticker}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-left text-sm text-slate-300">
                      {benchmark === 'BENCHMARK1' ? (stock.benchmark1 || 'N/A') :
                       benchmark === 'BENCHMARK2' ? (stock.benchmark2 || 'N/A') :
                       benchmark === 'BENCHMARK3' ? (stock.benchmark3 || 'N/A') :
                       (stock.benchmarkCustom || 'N/A')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <ScoreCell score={stock.valueScore} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <ScoreCell score={stock.momentumScore} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <ScoreCell score={stock.qualityScore} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <ScoreCell score={stock.riskScore} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <div className="font-bold text-lg">
                        <ScoreCell score={stock.totalScore} />
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <button
                        onClick={() => setExpandedRow(expandedRow === stock.ticker ? null : stock.ticker)}
                        className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                      >
                        {expandedRow === stock.ticker ? 'Hide' : 'Show'}
                      </button>
                    </td>
                  </tr>
                  
                  {/* Expanded Details Row */}
                  {expandedRow === stock.ticker && (
                    <tr>
                      <td colSpan={7} className="px-4 py-4 bg-slate-900/50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* VALUE Details */}
                          <CompositeScoreCard
                            title="VALUE"
                            compositeScore={stock.valueScore}
                            metrics={[
                              { name: 'P/E Ratio', value: stock.peRatio, score: stock.peRatioScore, format: 'ratio', invertColor: true },
                              { name: 'EV/EBITDA', value: stock.evEbitda, score: stock.evEbitdaScore, format: 'ratio', invertColor: true },
                              { name: 'EV/Sales', value: stock.evSales, score: stock.evSalesScore, format: 'ratio', invertColor: true },
                              { name: 'Target Price Upside', value: stock.targetPriceUpside, score: stock.targetPriceUpsideScore, format: 'ratio' }
                            ]}
                          />
                          
                          {/* MOMENTUM Details */}
                          <CompositeScoreCard
                            title="MOMENTUM"
                            compositeScore={stock.momentumScore}
                            metrics={[
                              { name: '12M Return ex 1M', value: stock.return12MEx1M, score: stock.return12MEx1MScore, format: 'percentage' },
                              { name: '3M Return', value: stock.return3M, score: stock.return3MScore, format: 'percentage' },
                              { name: '% of 52-Week High', value: stock.pct52WeekHigh, score: stock.pct52WeekHighScore, format: 'percentage' },
                              { name: 'EPS Surprise', value: stock.epsSurprise, score: stock.epsSurpriseScore, format: 'percentage' },
                              { name: 'Rev Surprise', value: stock.revSurprise, score: stock.revSurpriseScore, format: 'percentage' },
                              { name: 'NTM EPS Change', value: stock.ntmEpsChange, score: stock.ntmEpsChangeScore, format: 'ratio' },
                              { name: 'NTM Rev Change', value: stock.ntmRevChange, score: stock.ntmRevChangeScore, format: 'ratio' }
                            ]}
                          />
                          
                          {/* QUALITY Details */}
                          <CompositeScoreCard
                            title="QUALITY"
                            compositeScore={stock.qualityScore}
                            metrics={[
                              { name: 'ROIC TTM', value: stock.roicTTM, score: stock.roicTTMScore, format: 'percentage' },
                              { name: 'Gross Profitability / TA', value: stock.grossProfitability, score: stock.grossProfitabilityScore, format: 'ratio' },
                              { name: 'Accruals / TA', value: stock.accruals, score: stock.accrualsScore, format: 'percentage', invertColor: true },
                              { name: 'FCF / TA', value: stock.fcfToAssets, score: stock.fcfToAssetsScore, format: 'ratio' },
                              { name: 'ROIC 3-Yr', value: stock.roic3Yr, score: stock.roic3YrScore, format: 'percentage' },
                              { name: 'EBITDA Margin', value: stock.ebitdaMargin, score: stock.ebitdaMarginScore, format: 'percentage' }
                            ]}
                          />
                          
                          {/* RISK Details */}
                          <CompositeScoreCard
                            title="RISK"
                            compositeScore={stock.riskScore}
                            metrics={[
                              { name: 'Beta 3-Yr', value: stock.beta3Yr, score: stock.beta3YrScore, format: 'ratio', invertColor: true },
                              { name: '30-Day Volatility', value: stock.volatility30Day, score: stock.volatility30DayScore, format: 'percentage', invertColor: true },
                              { name: 'Max Drawdown', value: stock.maxDrawdown, score: stock.maxDrawdownScore, format: 'percentage', invertColor: true },
                              { name: 'Financial Leverage', value: stock.financialLeverage, score: stock.financialLeverageScore, format: 'ratio', invertColor: true }
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Universe Scoring Table */}
      <div className="mt-12">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Universe Scoring</h2>
          <p className="text-slate-400">
            {universeTotalCount} tickers • Profile: {profile} • Benchmark: {benchmark.replace('BENCHMARK', 'Benchmark ')}
          </p>
        </div>

        {/* Pagination Controls */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <select
              value={universePageSize}
              onChange={(e) => {
                setUniversePageSize(Number(e.target.value))
                setUniversePage(1)
              }}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500"
            >
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
            <span className="text-slate-400 text-sm">
              Showing {((universePage - 1) * universePageSize) + 1} to{' '}
              {Math.min(universePage * universePageSize, universeTotalCount)} of{' '}
              {universeTotalCount}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setUniversePage(1)}
              disabled={universePage === 1 || universeLoading}
              className="p-2 rounded bg-slate-800 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700"
            >
              <ChevronsLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setUniversePage(prev => Math.max(1, prev - 1))}
              disabled={universePage === 1 || universeLoading}
              className="p-2 rounded bg-slate-800 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <span className="px-4 py-2 text-white">
              Page {universePage} of {universeTotalPages}
            </span>
            
            <button
              onClick={() => setUniversePage(prev => Math.min(universeTotalPages, prev + 1))}
              disabled={universePage === universeTotalPages || universeLoading}
              className="p-2 rounded bg-slate-800 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => setUniversePage(universeTotalPages)}
              disabled={universePage === universeTotalPages || universeLoading}
              className="p-2 rounded bg-slate-800 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700"
            >
              <ChevronsRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Loading / Error / Table */}
        {universeLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-slate-400">Loading universe data...</p>
            </div>
          </div>
        ) : universeError ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center text-red-400">
              <p className="text-lg font-semibold mb-2">Error loading universe data</p>
              <p className="text-sm">{universeError}</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[800px] overflow-y-auto rounded-lg border border-slate-700">
            <table className="min-w-full divide-y divide-slate-700">
              <thead className="bg-slate-800 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Ticker
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Benchmark
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-300 uppercase tracking-wider">
                    VALUE
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-300 uppercase tracking-wider">
                    MOMENTUM
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-300 uppercase tracking-wider">
                    QUALITY
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-300 uppercase tracking-wider">
                    RISK
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-300 uppercase tracking-wider">
                    TOTAL
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-slate-800 divide-y divide-slate-700">
                {universeData.map((stock) => (
                  <React.Fragment key={stock.ticker}>
                    <tr className="hover:bg-slate-700/50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-white">{stock.ticker}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-left text-sm text-slate-300">
                        {benchmark === 'BENCHMARK1' ? (stock.benchmark1 || 'N/A') :
                         benchmark === 'BENCHMARK2' ? (stock.benchmark2 || 'N/A') :
                         benchmark === 'BENCHMARK3' ? (stock.benchmark3 || 'N/A') :
                         (stock.benchmarkCustom || 'N/A')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <ScoreCell score={stock.valueScore} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <ScoreCell score={stock.momentumScore} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <ScoreCell score={stock.qualityScore} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <ScoreCell score={stock.riskScore} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <ScoreCell score={stock.totalScore} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <button
                          onClick={() => setUniverseExpandedRow(universeExpandedRow === stock.ticker ? null : stock.ticker)}
                          className="text-blue-400 hover:text-blue-300 transition-colors text-sm font-medium"
                        >
                          Show
                        </button>
                      </td>
                    </tr>
                    
                    {/* Expanded Row with Details */}
                    {universeExpandedRow === stock.ticker && (
                      <tr>
                        <td colSpan={8} className="px-4 py-6 bg-slate-900/50">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {/* VALUE Details */}
                            <CompositeScoreCard
                              title="VALUE"
                              compositeScore={stock.valueScore}
                              metrics={[
                                { name: 'P/E Ratio', value: stock.peRatio, score: stock.peRatioScore, format: 'ratio' },
                                { name: 'EV/EBITDA', value: stock.evEbitda, score: stock.evEbitdaScore, format: 'ratio' },
                                { name: 'EV/Sales', value: stock.evSales, score: stock.evSalesScore, format: 'ratio' },
                                { name: 'Target Price Upside', value: stock.targetPriceUpside, score: stock.targetPriceUpsideScore, format: 'ratio' }
                              ]}
                            />
                            
                            {/* MOMENTUM Details */}
                            <CompositeScoreCard
                              title="MOMENTUM"
                              compositeScore={stock.momentumScore}
                              metrics={[
                                { name: '12M Return ex 1M', value: stock.return12MEx1M, score: stock.return12MEx1MScore, format: 'percentage' },
                                { name: '3M Return', value: stock.return3M, score: stock.return3MScore, format: 'percentage' },
                                { name: '% of 52-Week High', value: stock.pct52WeekHigh, score: stock.pct52WeekHighScore, format: 'percentage' },
                                { name: 'EPS Surprise', value: stock.epsSurprise, score: stock.epsSurpriseScore, format: 'percentage' },
                                { name: 'Rev Surprise', value: stock.revSurprise, score: stock.revSurpriseScore, format: 'percentage' },
                                { name: 'NTM EPS Change', value: stock.ntmEpsChange, score: stock.ntmEpsChangeScore, format: 'ratio' },
                                { name: 'NTM Rev Change', value: stock.ntmRevChange, score: stock.ntmRevChangeScore, format: 'ratio' }
                              ]}
                            />
                            
                            {/* QUALITY Details */}
                            <CompositeScoreCard
                              title="QUALITY"
                              compositeScore={stock.qualityScore}
                              metrics={[
                                { name: 'ROIC TTM', value: stock.roicTTM, score: stock.roicTTMScore, format: 'percentage' },
                                { name: 'Gross Profitability / TA', value: stock.grossProfitability, score: stock.grossProfitabilityScore, format: 'ratio' },
                                { name: 'Accruals / TA', value: stock.accruals, score: stock.accrualsScore, format: 'percentage', invertColor: true },
                                { name: 'FCF / TA', value: stock.fcfToAssets, score: stock.fcfToAssetsScore, format: 'ratio' },
                                { name: 'ROIC 3-Yr', value: stock.roic3Yr, score: stock.roic3YrScore, format: 'percentage' },
                                { name: 'EBITDA Margin', value: stock.ebitdaMargin, score: stock.ebitdaMarginScore, format: 'percentage' }
                              ]}
                            />
                            
                            {/* RISK Details */}
                            <CompositeScoreCard
                              title="RISK"
                              compositeScore={stock.riskScore}
                              metrics={[
                                { name: 'Beta 3-Yr', value: stock.beta3Yr, score: stock.beta3YrScore, format: 'ratio', invertColor: true },
                                { name: '30-Day Volatility', value: stock.volatility30Day, score: stock.volatility30DayScore, format: 'percentage', invertColor: true },
                                { name: 'Max Drawdown', value: stock.maxDrawdown, score: stock.maxDrawdownScore, format: 'percentage', invertColor: true },
                                { name: 'Financial Leverage', value: stock.financialLeverage, score: stock.financialLeverageScore, format: 'ratio', invertColor: true }
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
