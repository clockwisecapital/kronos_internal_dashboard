'use client'

import { useState, useEffect } from 'react'

interface SectorValuation {
  ticker: string
  pe_ntm: number | null
  pe_avg: number | null
  pe_median: number | null
  pe_min: number | null
  pe_max: number | null
  ev_ebitda_ntm: number | null
  ev_ebitda_avg: number | null
  ev_ebitda_median: number | null
  ev_ebitda_min: number | null
  ev_ebitda_max: number | null
  ev_sales_ntm: number | null
  ev_sales_avg: number | null
  ev_sales_median: number | null
  ev_sales_min: number | null
  ev_sales_max: number | null
}

interface SectorHolding {
  ticker: string
  name: string
  weight: number
  isClockwiseHolding: boolean
}

type SortColumn = 'ticker' | 'pe_ntm' | 'ev_ebitda_ntm' | 'ev_sales_ntm'
type SortDirection = 'asc' | 'desc'
type HoldingSortColumn = 'ticker' | 'name' | 'weight' | 'pe_ntm' | 'ev_ebitda_ntm' | 'ev_sales_ntm'

export default function SectorsPage() {
  const [selectedSector, setSelectedSector] = useState('SPY')
  const [sectorValuations, setSectorValuations] = useState<SectorValuation[]>([])
  const [sectorHoldings, setSectorHoldings] = useState<SectorHolding[]>([])
  const [holdingsValuations, setHoldingsValuations] = useState<SectorValuation[]>([])
  const [loading, setLoading] = useState(true)
  const [holdingsLoading, setHoldingsLoading] = useState(false)
  
  // Sorting state for Sector Valuations table
  const [sortColumn, setSortColumn] = useState<SortColumn>('ticker')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  
  // Sorting state for Sector Holdings table
  const [holdingSortColumn, setHoldingSortColumn] = useState<HoldingSortColumn>('weight')
  const [holdingSortDirection, setHoldingSortDirection] = useState<SortDirection>('desc')

  // Fetch sector valuations on mount
  useEffect(() => {
    fetchSectorValuations()
  }, [])

  // Fetch sector holdings when sector changes
  useEffect(() => {
    fetchSectorHoldings(selectedSector)
  }, [selectedSector])

  // Fetch holdings valuations when sector holdings are loaded
  useEffect(() => {
    const tickers = sectorHoldings.map(h => h.ticker)
    if (tickers.length > 0) {
      fetchHoldingsValuations(tickers)
    }
  }, [sectorHoldings])

  const fetchSectorValuations = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/sector-valuations')
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          const formatted = result.data.map((d: any) => ({
            ticker: d.Ticker,
            pe_ntm: parseFloat(d['P/E NTM']) || null,
            pe_avg: parseFloat(d['3-YR AVG NTM P/E']) || null,
            pe_median: parseFloat(d['3-YR MEDIAN NTM P/E']) || null,
            pe_min: parseFloat(d['3-YR MIN NTM P/E']) || null,
            pe_max: parseFloat(d['3-YR MAX NTM P/E']) || null,
            ev_ebitda_ntm: parseFloat(d['EV/EBITDA - NTM']) || null,
            ev_ebitda_avg: parseFloat(d['3-YR AVG NTM EV/EBITDA']) || null,
            ev_ebitda_median: parseFloat(d['3-YR MEDIAN NTM EV/EBITDA']) || null,
            ev_ebitda_min: parseFloat(d['3-YR MIN NTM EV/EBITDA']) || null,
            ev_ebitda_max: parseFloat(d['3-YR MAX NTM EV/EBITDA']) || null,
            ev_sales_ntm: parseFloat(d['EV/Sales - NTM']) || null,
            ev_sales_avg: parseFloat(d['3-YR AVG NTM EV/SALES']) || null,
            ev_sales_median: parseFloat(d['3-YR MEDIAN NTM EV/SALES']) || null,
            ev_sales_min: parseFloat(d['3-YR MIN NTM EV/SALES']) || null,
            ev_sales_max: parseFloat(d['3-YR MAX NTM EV/SALES']) || null,
          }))
          setSectorValuations(formatted)
        }
      }
    } catch (error) {
      console.error('Error fetching sector valuations:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSectorHoldings = async (sector: string) => {
    try {
      setHoldingsLoading(true)
      const response = await fetch(`/api/sector-holdings?sector=${sector}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          setSectorHoldings(result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching sector holdings:', error)
    } finally {
      setHoldingsLoading(false)
    }
  }

  const fetchHoldingsValuations = async (tickers: string[]) => {
    try {
      const response = await fetch(`/api/sector-valuations?tickers=${tickers.join(',')}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          const formatted = result.data.map((d: any) => ({
            ticker: d.Ticker,
            pe_ntm: parseFloat(d['P/E NTM']) || null,
            pe_avg: parseFloat(d['3-YR AVG NTM P/E']) || null,
            pe_median: parseFloat(d['3-YR MEDIAN NTM P/E']) || null,
            pe_min: parseFloat(d['3-YR MIN NTM P/E']) || null,
            pe_max: parseFloat(d['3-YR MAX NTM P/E']) || null,
            ev_ebitda_ntm: parseFloat(d['EV/EBITDA - NTM']) || null,
            ev_ebitda_avg: parseFloat(d['3-YR AVG NTM EV/EBITDA']) || null,
            ev_ebitda_median: parseFloat(d['3-YR MEDIAN NTM EV/EBITDA']) || null,
            ev_ebitda_min: parseFloat(d['3-YR MIN NTM EV/EBITDA']) || null,
            ev_ebitda_max: parseFloat(d['3-YR MAX NTM EV/EBITDA']) || null,
            ev_sales_ntm: parseFloat(d['EV/Sales - NTM']) || null,
            ev_sales_avg: parseFloat(d['3-YR AVG NTM EV/SALES']) || null,
            ev_sales_median: parseFloat(d['3-YR MEDIAN NTM EV/SALES']) || null,
            ev_sales_min: parseFloat(d['3-YR MIN NTM EV/SALES']) || null,
            ev_sales_max: parseFloat(d['3-YR MAX NTM EV/SALES']) || null,
          }))
          setHoldingsValuations(formatted)
        }
      }
    } catch (error) {
      console.error('Error fetching holdings valuations:', error)
    }
  }

  // Sector display names
  const sectorNames: Record<string, string> = {
    'SPY': 'S&P 500',
    'QQQ': 'Nasdaq 100',
    'DIA': 'Dow Jones',
    'XLK': 'Technology',
    'XLF': 'Financials',
    'XLC': 'Communication Services',
    'XLY': 'Consumer Discretionary',
    'XLP': 'Consumer Staples',
    'XLE': 'Energy',
    'XLV': 'Healthcare',
    'XLI': 'Industrials',
    'XLB': 'Materials',
    'XLRE': 'Real Estate',
    'XLU': 'Utilities',
    'SOXX': 'Semiconductors (PHLX)',
    'SMH': 'Semiconductors (VanEck)'
  }

  // Sorting functions
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const handleHoldingSort = (column: HoldingSortColumn) => {
    if (holdingSortColumn === column) {
      setHoldingSortDirection(holdingSortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setHoldingSortColumn(column)
      setHoldingSortDirection('asc')
    }
  }

  // Sort sector valuations
  const sortedSectorValuations = [...sectorValuations].sort((a, b) => {
    let aVal: any, bVal: any
    
    switch (sortColumn) {
      case 'ticker':
        aVal = a.ticker
        bVal = b.ticker
        break
      case 'pe_ntm':
        aVal = a.pe_ntm ?? Infinity
        bVal = b.pe_ntm ?? Infinity
        break
      case 'ev_ebitda_ntm':
        aVal = a.ev_ebitda_ntm ?? Infinity
        bVal = b.ev_ebitda_ntm ?? Infinity
        break
      case 'ev_sales_ntm':
        aVal = a.ev_sales_ntm ?? Infinity
        bVal = b.ev_sales_ntm ?? Infinity
        break
    }

    if (typeof aVal === 'string') {
      return sortDirection === 'asc' 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal)
    } else {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    }
  })

  // Sort sector holdings
  const sortedSectorHoldings = [...sectorHoldings].sort((a, b) => {
    let aVal: any, bVal: any
    
    switch (holdingSortColumn) {
      case 'ticker':
        aVal = a.ticker
        bVal = b.ticker
        break
      case 'name':
        aVal = a.name
        bVal = b.name
        break
      case 'weight':
        aVal = a.weight
        bVal = b.weight
        break
      case 'pe_ntm':
        const aValuationPE = holdingsValuations.find(v => v.ticker === a.ticker)
        const bValuationPE = holdingsValuations.find(v => v.ticker === b.ticker)
        aVal = aValuationPE?.pe_ntm ?? Infinity
        bVal = bValuationPE?.pe_ntm ?? Infinity
        break
      case 'ev_ebitda_ntm':
        const aValuationEBITDA = holdingsValuations.find(v => v.ticker === a.ticker)
        const bValuationEBITDA = holdingsValuations.find(v => v.ticker === b.ticker)
        aVal = aValuationEBITDA?.ev_ebitda_ntm ?? Infinity
        bVal = bValuationEBITDA?.ev_ebitda_ntm ?? Infinity
        break
      case 'ev_sales_ntm':
        const aValuationSales = holdingsValuations.find(v => v.ticker === a.ticker)
        const bValuationSales = holdingsValuations.find(v => v.ticker === b.ticker)
        aVal = aValuationSales?.ev_sales_ntm ?? Infinity
        bVal = bValuationSales?.ev_sales_ntm ?? Infinity
        break
    }

    if (typeof aVal === 'string') {
      return holdingSortDirection === 'asc' 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal)
    } else {
      return holdingSortDirection === 'asc' ? aVal - bVal : bVal - aVal
    }
  })

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          Sector Analysis
        </h1>
        <p className="text-slate-400 mt-1">
          Sector-level valuations and holdings breakdown
        </p>
      </div>

      {/* Sector Valuations - All Metrics in One Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Sector Valuations
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                P/E, EV/EBITDA, and EV/REVS metrics across sectors and indices
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-300">
                Sort by:
              </label>
              <select
                value={sortColumn}
                onChange={(e) => handleSort(e.target.value as SortColumn)}
                className="px-4 py-2 border border-slate-600 rounded-lg bg-slate-900 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="ticker">Ticker</option>
                <option value="pe_ntm">P/E Avg</option>
                <option value="ev_ebitda_ntm">EV/EBITDA Avg</option>
                <option value="ev_sales_ntm">EV/Sales Avg</option>
              </select>
              <button
                onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                className="px-3 py-2 border border-slate-600 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors text-sm"
                title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
              >
                {sortDirection === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>

        {/* Table Content - All Metrics */}
        <div className="overflow-x-auto max-h-[800px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <table className="w-full text-xs">
              <colgroup>
                <col className="w-32" />
              </colgroup>
              <thead className="sticky top-0 z-20 bg-slate-700 border-b border-slate-600">
                <tr>
                  <th className="text-left py-3 px-3 font-semibold text-white sticky left-0 bg-slate-700 z-30">Index</th>
                  <th colSpan={4} className="text-center py-3 px-2 font-semibold text-white border-l border-r border-slate-600">P/E NTM</th>
                  <th colSpan={4} className="text-center py-3 px-2 font-semibold text-white border-r border-slate-600">EV/EBITDA NTM</th>
                  <th colSpan={4} className="text-center py-3 px-2 font-semibold text-white">EV/REVS NTM</th>
                </tr>
                <tr className="bg-slate-700/50 border-b-2 border-slate-600">
                  <th className="py-2 px-3 sticky left-0 bg-slate-700/50 z-30"></th>
                  <th className="text-center py-2 px-2 text-slate-400 font-medium">Avg</th>
                  <th className="text-center py-2 px-2 text-slate-400 font-medium">3-yr Med</th>
                  <th className="text-center py-2 px-2 text-slate-400 font-medium">Min</th>
                  <th className="text-center py-2 px-2 text-slate-400 font-medium border-r border-slate-600">Max</th>
                  <th className="text-center py-2 px-2 text-slate-400 font-medium">Avg</th>
                  <th className="text-center py-2 px-2 text-slate-400 font-medium">3-yr Med</th>
                  <th className="text-center py-2 px-2 text-slate-400 font-medium">Min</th>
                  <th className="text-center py-2 px-2 text-slate-400 font-medium border-r border-slate-600">Max</th>
                  <th className="text-center py-2 px-2 text-slate-400 font-medium">Avg</th>
                  <th className="text-center py-2 px-2 text-slate-400 font-medium">3-yr Med</th>
                  <th className="text-center py-2 px-2 text-slate-400 font-medium">Min</th>
                  <th className="text-center py-2 px-2 text-slate-400 font-medium">Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {sortedSectorValuations.map((sector, idx) => (
                  <tr key={sector.ticker} className="hover:bg-slate-700/50 transition-colors">
                    <td className="py-3 px-3 font-semibold text-white sticky left-0 bg-slate-800 z-10">
                      <div className="flex flex-col">
                        <span>{sector.ticker}</span>
                        <span className="text-slate-400 font-normal text-[10px]">{sectorNames[sector.ticker]}</span>
                      </div>
                    </td>
                    {/* P/E NTM */}
                    <td className="text-center py-3 px-2 text-slate-300">
                      {sector.pe_ntm !== null ? sector.pe_ntm.toFixed(1) : '-'}
                    </td>
                    <td className="text-center py-3 px-2 text-slate-300">
                      {sector.pe_median !== null ? sector.pe_median.toFixed(1) : '-'}
                    </td>
                    <td className="text-center py-3 px-2 text-slate-300">
                      {sector.pe_min !== null ? sector.pe_min.toFixed(1) : '-'}
                    </td>
                    <td className="text-center py-3 px-2 text-slate-300 border-r border-slate-700">
                      {sector.pe_max !== null ? sector.pe_max.toFixed(1) : '-'}
                    </td>
                    {/* EV/EBITDA NTM */}
                    <td className="text-center py-3 px-2 text-slate-300">
                      {sector.ev_ebitda_ntm !== null ? sector.ev_ebitda_ntm.toFixed(1) : '-'}
                    </td>
                    <td className="text-center py-3 px-2 text-slate-300">
                      {sector.ev_ebitda_median !== null ? sector.ev_ebitda_median.toFixed(1) : '-'}
                    </td>
                    <td className="text-center py-3 px-2 text-slate-300">
                      {sector.ev_ebitda_min !== null ? sector.ev_ebitda_min.toFixed(1) : '-'}
                    </td>
                    <td className="text-center py-3 px-2 text-slate-300 border-r border-slate-700">
                      {sector.ev_ebitda_max !== null ? sector.ev_ebitda_max.toFixed(1) : '-'}
                    </td>
                    {/* EV/REVS NTM */}
                    <td className="text-center py-3 px-2 text-slate-300">
                      {sector.ev_sales_ntm !== null ? sector.ev_sales_ntm.toFixed(1) : '-'}
                    </td>
                    <td className="text-center py-3 px-2 text-slate-300">
                      {sector.ev_sales_median !== null ? sector.ev_sales_median.toFixed(1) : '-'}
                    </td>
                    <td className="text-center py-3 px-2 text-slate-300">
                      {sector.ev_sales_min !== null ? sector.ev_sales_min.toFixed(1) : '-'}
                    </td>
                    <td className="text-center py-3 px-2 text-slate-300">
                      {sector.ev_sales_max !== null ? sector.ev_sales_max.toFixed(1) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Sector Holdings with Tabs */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Top 50 Sector Holdings
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Top 50 holdings by weight with valuation metrics for selected sector/index
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-300">
                Select Sector:
              </label>
              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="px-4 py-2 border border-slate-600 rounded-lg bg-slate-900 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="SPY">SPY - S&P 500</option>
                <option value="QQQ">QQQ - Nasdaq 100</option>
                <option value="DIA">DIA - Dow Jones</option>
                <option value="XLK">XLK - Technology</option>
                <option value="XLF">XLF - Financials</option>
                <option value="XLC">XLC - Communication Services</option>
                <option value="XLY">XLY - Consumer Discretionary</option>
                <option value="XLP">XLP - Consumer Staples</option>
                <option value="XLE">XLE - Energy</option>
                <option value="XLV">XLV - Healthcare</option>
                <option value="XLI">XLI - Industrials</option>
                <option value="XLB">XLB - Materials</option>
                <option value="XLRE">XLRE - Real Estate</option>
                <option value="XLU">XLU - Utilities</option>
                <option value="SOXX">SOXX - Semiconductors (PHLX)</option>
                <option value="SMH">SMH - Semiconductors (VanEck)</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-300">
              Sort by:
            </label>
            <select
              value={holdingSortColumn}
              onChange={(e) => handleHoldingSort(e.target.value as HoldingSortColumn)}
              className="px-4 py-2 border border-slate-600 rounded-lg bg-slate-900 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="weight">Weight</option>
              <option value="ticker">Ticker</option>
              <option value="name">Company Name</option>
              <option value="pe_ntm">P/E Avg</option>
              <option value="ev_ebitda_ntm">EV/EBITDA Avg</option>
              <option value="ev_sales_ntm">EV/Sales Avg</option>
            </select>
            <button
              onClick={() => setHoldingSortDirection(holdingSortDirection === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 border border-slate-600 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors text-sm"
              title={holdingSortDirection === 'asc' ? 'Ascending' : 'Descending'}
            >
              {holdingSortDirection === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        {/* Holdings Table - All Metrics */}
        <div className="overflow-x-auto max-h-[800px] overflow-y-auto">
          {holdingsLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : sortedSectorHoldings.length === 0 ? (
            <div className="flex items-center justify-center p-12 text-slate-400">
              No holdings data available for this sector
            </div>
          ) : (
            <table className="w-full text-xs">
              <colgroup>
                <col className="w-24" />
              </colgroup>
              <thead className="sticky top-0 z-20 bg-slate-700 border-b border-slate-600">
                <tr>
                  <th className="text-left py-3 px-3 font-semibold text-white sticky left-0 bg-slate-700 z-30">Ticker</th>
                  <th className="text-left py-3 px-3 font-semibold text-white">Company Name</th>
                  <th className="text-right py-3 px-3 font-semibold text-white">Weight</th>
                  <th className="text-center py-3 px-3 font-semibold text-white border-r border-slate-600">Clockwise Holding</th>
                  <th colSpan={4} className="text-center py-3 px-2 font-semibold text-white border-r border-slate-600">P/E NTM</th>
                  <th colSpan={4} className="text-center py-3 px-2 font-semibold text-white border-r border-slate-600">EV/EBITDA NTM</th>
                  <th colSpan={4} className="text-center py-3 px-2 font-semibold text-white">EV/REVS NTM</th>
                </tr>
                <tr className="bg-slate-700/50 border-b-2 border-slate-600">
                  <th className="py-2 px-3 sticky left-0 bg-slate-700/50 z-30"></th>
                  <th className="py-2 px-3"></th>
                  <th className="py-2 px-3"></th>
                  <th className="py-2 px-3 border-r border-slate-600"></th>
                  <th className="text-center py-2 px-2 text-slate-400 font-medium">Avg</th>
                  <th className="text-center py-2 px-2 text-slate-400 font-medium">3-yr Med</th>
                  <th className="text-center py-2 px-2 text-slate-400 font-medium">Min</th>
                  <th className="text-center py-2 px-2 text-slate-400 font-medium border-r border-slate-600">Max</th>
                  <th className="text-center py-2 px-2 text-slate-400 font-medium">Avg</th>
                  <th className="text-center py-2 px-2 text-slate-400 font-medium">3-yr Med</th>
                  <th className="text-center py-2 px-2 text-slate-400 font-medium">Min</th>
                  <th className="text-center py-2 px-2 text-slate-400 font-medium border-r border-slate-600">Max</th>
                  <th className="text-center py-2 px-2 text-slate-400 font-medium">Avg</th>
                  <th className="text-center py-2 px-2 text-slate-400 font-medium">3-yr Med</th>
                  <th className="text-center py-2 px-2 text-slate-400 font-medium">Min</th>
                  <th className="text-center py-2 px-2 text-slate-400 font-medium">Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {sortedSectorHoldings.map((holding) => {
                  const valuation = holdingsValuations.find(v => v.ticker === holding.ticker)

                return (
                  <tr key={holding.ticker} className="hover:bg-slate-700/50 transition-colors">
                    <td className="py-3 px-3 font-semibold text-white sticky left-0 bg-slate-800 z-10">
                      {holding.ticker}
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      {holding.name}
                    </td>
                    <td className="text-right py-3 px-3 font-medium text-blue-400">
                      {holding.weight.toFixed(2)}%
                    </td>
                    <td className="text-center py-3 px-3 border-r border-slate-700">
                      {holding.isClockwiseHolding ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-900/50 text-green-300 border border-green-700">
                          ✓ Yes
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    {/* P/E NTM */}
                    <td className="text-center py-3 px-2 text-slate-300">
                      {valuation?.pe_ntm !== null && valuation?.pe_ntm !== undefined ? valuation.pe_ntm.toFixed(1) : '-'}
                    </td>
                    <td className="text-center py-3 px-2 text-slate-300">
                      {valuation?.pe_median !== null && valuation?.pe_median !== undefined ? valuation.pe_median.toFixed(1) : '-'}
                    </td>
                    <td className="text-center py-3 px-2 text-slate-300">
                      {valuation?.pe_min !== null && valuation?.pe_min !== undefined ? valuation.pe_min.toFixed(1) : '-'}
                    </td>
                    <td className="text-center py-3 px-2 text-slate-300 border-r border-slate-700">
                      {valuation?.pe_max !== null && valuation?.pe_max !== undefined ? valuation.pe_max.toFixed(1) : '-'}
                    </td>
                    {/* EV/EBITDA NTM */}
                    <td className="text-center py-3 px-2 text-slate-300">
                      {valuation?.ev_ebitda_ntm !== null && valuation?.ev_ebitda_ntm !== undefined ? valuation.ev_ebitda_ntm.toFixed(1) : '-'}
                    </td>
                    <td className="text-center py-3 px-2 text-slate-300">
                      {valuation?.ev_ebitda_median !== null && valuation?.ev_ebitda_median !== undefined ? valuation.ev_ebitda_median.toFixed(1) : '-'}
                    </td>
                    <td className="text-center py-3 px-2 text-slate-300">
                      {valuation?.ev_ebitda_min !== null && valuation?.ev_ebitda_min !== undefined ? valuation.ev_ebitda_min.toFixed(1) : '-'}
                    </td>
                    <td className="text-center py-3 px-2 text-slate-300 border-r border-slate-700">
                      {valuation?.ev_ebitda_max !== null && valuation?.ev_ebitda_max !== undefined ? valuation.ev_ebitda_max.toFixed(1) : '-'}
                    </td>
                    {/* EV/REVS NTM */}
                    <td className="text-center py-3 px-2 text-slate-300">
                      {valuation?.ev_sales_ntm !== null && valuation?.ev_sales_ntm !== undefined ? valuation.ev_sales_ntm.toFixed(1) : '-'}
                    </td>
                    <td className="text-center py-3 px-2 text-slate-300">
                      {valuation?.ev_sales_median !== null && valuation?.ev_sales_median !== undefined ? valuation.ev_sales_median.toFixed(1) : '-'}
                    </td>
                    <td className="text-center py-3 px-2 text-slate-300">
                      {valuation?.ev_sales_min !== null && valuation?.ev_sales_min !== undefined ? valuation.ev_sales_min.toFixed(1) : '-'}
                    </td>
                    <td className="text-center py-3 px-2 text-slate-300">
                      {valuation?.ev_sales_max !== null && valuation?.ev_sales_max !== undefined ? valuation.ev_sales_max.toFixed(1) : '-'}
                    </td>
                  </tr>
                )
              })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
