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

export default function SectorsPage() {
  const [selectedSector, setSelectedSector] = useState('SPY')
  const [sectorValuations, setSectorValuations] = useState<SectorValuation[]>([])
  const [holdingsValuations, setHoldingsValuations] = useState<SectorValuation[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch sector valuations on mount
  useEffect(() => {
    fetchSectorValuations()
  }, [])

  // Fetch holdings valuations when sector changes
  useEffect(() => {
    const tickers = sectorHoldings[selectedSector]?.map(h => h.ticker) || []
    if (tickers.length > 0) {
      fetchHoldingsValuations(tickers)
    }
  }, [selectedSector])

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

  // Mock sector holdings data
  const sectorHoldings: Record<string, Array<{ ticker: string; name: string; weight: number }>> = {
    SMH: [
      { ticker: 'NVDA', name: 'NVIDIA Corp', weight: 21.2 },
      { ticker: 'TSM', name: 'Taiwan Semiconductor', weight: 11.8 },
      { ticker: 'AVGO', name: 'Broadcom Inc', weight: 9.4 },
      { ticker: 'AMD', name: 'Advanced Micro Devices', weight: 7.6 },
      { ticker: 'MU', name: 'Micron Technology', weight: 4.2 },
      { ticker: 'QCOM', name: 'Qualcomm Inc', weight: 3.8 },
      { ticker: 'INTC', name: 'Intel Corp', weight: 3.5 },
      { ticker: 'TXN', name: 'Texas Instruments', weight: 2.9 },
    ],
    SPY: [
      { ticker: 'AAPL', name: 'Apple Inc', weight: 7.2 },
      { ticker: 'MSFT', name: 'Microsoft Corp', weight: 6.8 },
      { ticker: 'AMZN', name: 'Amazon.com Inc', weight: 3.5 },
      { ticker: 'NVDA', name: 'NVIDIA Corp', weight: 3.2 },
      { ticker: 'GOOGL', name: 'Alphabet Inc Class A', weight: 2.1 },
    ],
    QQQ: [
      { ticker: 'AAPL', name: 'Apple Inc', weight: 8.9 },
      { ticker: 'MSFT', name: 'Microsoft Corp', weight: 8.2 },
      { ticker: 'NVDA', name: 'NVIDIA Corp', weight: 7.5 },
      { ticker: 'AMZN', name: 'Amazon.com Inc', weight: 5.4 },
      { ticker: 'META', name: 'Meta Platforms Inc', weight: 4.8 },
    ],
  }

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
          <h2 className="text-lg font-semibold text-white">
            Sector Valuations
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            P/E, EV/EBITDA, and EV/REVS metrics across sectors and indices
          </p>
        </div>

        {/* Table Content - All Metrics */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-700 border-b border-slate-600">
                <tr>
                  <th className="text-left py-3 px-3 font-semibold text-white sticky left-0 bg-slate-700 z-10">Index</th>
                  <th colSpan={4} className="text-center py-3 px-2 font-semibold text-white border-l border-r border-slate-600">P/E NTM</th>
                  <th colSpan={4} className="text-center py-3 px-2 font-semibold text-white border-r border-slate-600">EV/EBITDA NTM</th>
                  <th colSpan={4} className="text-center py-3 px-2 font-semibold text-white">EV/REVS NTM</th>
                </tr>
                <tr className="bg-slate-700/50 border-b-2 border-slate-600">
                  <th className="py-2 px-3"></th>
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
                {sectorValuations.map((sector) => (
                  <tr key={sector.ticker} className="hover:bg-slate-700/50 transition-colors">
                    <td className="py-3 px-3 font-semibold text-white sticky left-0 bg-slate-800 z-10">
                      <div className="flex flex-col">
                        <span>{sector.ticker}</span>
                        <span className="text-slate-400 font-normal text-[10px]">{sectorNames[sector.ticker]}</span>
                      </div>
                    </td>
                    {/* P/E NTM */}
                    <td className="text-center py-3 px-2 text-slate-300">
                      {sector.pe_avg !== null ? sector.pe_avg.toFixed(1) : '-'}
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
                      {sector.ev_ebitda_avg !== null ? sector.ev_ebitda_avg.toFixed(1) : '-'}
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
                      {sector.ev_sales_avg !== null ? sector.ev_sales_avg.toFixed(1) : '-'}
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
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Sector Holdings
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Top holdings and valuation metrics for selected sector/index
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
        </div>

        {/* Holdings Table - All Metrics */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-700 border-b border-slate-600">
              <tr>
                <th className="text-left py-3 px-3 font-semibold text-white sticky left-0 bg-slate-700 z-10">Ticker</th>
                <th className="text-left py-3 px-3 font-semibold text-white">Company Name</th>
                <th className="text-right py-3 px-3 font-semibold text-white border-r border-slate-600">Weight</th>
                <th colSpan={4} className="text-center py-3 px-2 font-semibold text-white border-r border-slate-600">P/E NTM</th>
                <th colSpan={4} className="text-center py-3 px-2 font-semibold text-white border-r border-slate-600">EV/EBITDA NTM</th>
                <th colSpan={4} className="text-center py-3 px-2 font-semibold text-white">EV/REVS NTM</th>
              </tr>
              <tr className="bg-slate-700/50 border-b-2 border-slate-600">
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
              {sectorHoldings[selectedSector]?.map((holding) => {
                const valuation = holdingsValuations.find(v => v.ticker === holding.ticker)

                return (
                  <tr key={holding.ticker} className="hover:bg-slate-700/50 transition-colors">
                    <td className="py-3 px-3 font-semibold text-white sticky left-0 bg-slate-800 z-10">
                      {holding.ticker}
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      {holding.name}
                    </td>
                    <td className="text-right py-3 px-3 font-medium text-blue-400 border-r border-slate-700">
                      {holding.weight.toFixed(1)}%
                    </td>
                    {/* P/E NTM */}
                    <td className="text-center py-3 px-2 text-slate-300">
                      {valuation?.pe_avg !== null && valuation?.pe_avg !== undefined ? valuation.pe_avg.toFixed(1) : '-'}
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
                      {valuation?.ev_ebitda_avg !== null && valuation?.ev_ebitda_avg !== undefined ? valuation.ev_ebitda_avg.toFixed(1) : '-'}
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
                      {valuation?.ev_sales_avg !== null && valuation?.ev_sales_avg !== undefined ? valuation.ev_sales_avg.toFixed(1) : '-'}
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
        </div>
      </div>
    </div>
  )
}
