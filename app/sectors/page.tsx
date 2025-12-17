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

type ValuationTab = 'pe' | 'ev_ebitda' | 'ev_sales'

export default function SectorsPage() {
  const [selectedSector, setSelectedSector] = useState('SMH')
  const [selectedValuationTab, setSelectedValuationTab] = useState<ValuationTab>('pe')
  const [selectedHoldingsTab, setSelectedHoldingsTab] = useState<ValuationTab>('pe')
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
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
          Sector Analysis
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-1">
          Sector-level valuations and holdings breakdown
        </p>
      </div>

      {/* Sector Valuations with Tabs */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">
            Sector Valuations
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Valuation metrics across sectors and indices
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 bg-slate-800/50">
          <button
            onClick={() => setSelectedValuationTab('pe')}
            className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
              selectedValuationTab === 'pe'
                ? 'border-blue-500 text-blue-400 bg-slate-700/50'
                : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-700/30'
            }`}
          >
            P/E NTM
          </button>
          <button
            onClick={() => setSelectedValuationTab('ev_ebitda')}
            className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
              selectedValuationTab === 'ev_ebitda'
                ? 'border-blue-500 text-blue-400 bg-slate-700/50'
                : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-700/30'
            }`}
          >
            EV/EBITDA NTM
          </button>
          <button
            onClick={() => setSelectedValuationTab('ev_sales')}
            className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
              selectedValuationTab === 'ev_sales'
                ? 'border-blue-500 text-blue-400 bg-slate-700/50'
                : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-700/30'
            }`}
          >
            EV/REVS NTM
          </button>
        </div>
        {/* Table Content */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-700 border-b border-slate-600">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-white">Index</th>
                  <th className="text-right py-3 px-4 font-semibold text-white">Avg</th>
                  <th className="text-right py-3 px-4 font-semibold text-white">3-yr Median</th>
                  <th className="text-right py-3 px-4 font-semibold text-white">3-yr min</th>
                  <th className="text-right py-3 px-4 font-semibold text-white">3-yr max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {sectorValuations.map((sector) => {
                  let avg, median, min, max
                  if (selectedValuationTab === 'pe') {
                    avg = sector.pe_avg
                    median = sector.pe_median
                    min = sector.pe_min
                    max = sector.pe_max
                  } else if (selectedValuationTab === 'ev_ebitda') {
                    avg = sector.ev_ebitda_avg
                    median = sector.ev_ebitda_median
                    min = sector.ev_ebitda_min
                    max = sector.ev_ebitda_max
                  } else {
                    avg = sector.ev_sales_avg
                    median = sector.ev_sales_median
                    min = sector.ev_sales_min
                    max = sector.ev_sales_max
                  }

                  return (
                    <tr key={sector.ticker} className="hover:bg-slate-700/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-white">
                        {sector.ticker} <span className="text-slate-400 font-normal">• {sectorNames[sector.ticker]}</span>
                      </td>
                      <td className="text-right py-3 px-4 text-slate-300">
                        {avg !== null ? avg.toFixed(1) : '-'}
                      </td>
                      <td className="text-right py-3 px-4 text-slate-300">
                        {median !== null ? median.toFixed(1) : '-'}
                      </td>
                      <td className="text-right py-3 px-4 text-slate-300">
                        {min !== null ? min.toFixed(1) : '-'}
                      </td>
                      <td className="text-right py-3 px-4 text-slate-300">
                        {max !== null ? max.toFixed(1) : '-'}
                      </td>
                    </tr>
                  )
                })}
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
                <option value="SMH">SMH - Semiconductors</option>
                <option value="SPY">SPY - S&P 500</option>
                <option value="QQQ">QQQ - Nasdaq 100</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabs for Holdings */}
        <div className="flex border-b border-slate-700 bg-slate-800/50">
          <button
            onClick={() => setSelectedHoldingsTab('pe')}
            className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
              selectedHoldingsTab === 'pe'
                ? 'border-blue-500 text-blue-400 bg-slate-700/50'
                : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-700/30'
            }`}
          >
            P/E NTM
          </button>
          <button
            onClick={() => setSelectedHoldingsTab('ev_ebitda')}
            className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
              selectedHoldingsTab === 'ev_ebitda'
                ? 'border-blue-500 text-blue-400 bg-slate-700/50'
                : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-700/30'
            }`}
          >
            EV/EBITDA NTM
          </button>
          <button
            onClick={() => setSelectedHoldingsTab('ev_sales')}
            className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
              selectedHoldingsTab === 'ev_sales'
                ? 'border-blue-500 text-blue-400 bg-slate-700/50'
                : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-700/30'
            }`}
          >
            EV/REVS NTM
          </button>
        </div>

        {/* Holdings Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-700 border-b border-slate-600">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-white">Ticker</th>
                <th className="text-left py-3 px-4 font-semibold text-white">Company Name</th>
                <th className="text-right py-3 px-4 font-semibold text-white">Weight</th>
                <th className="text-right py-3 px-4 font-semibold text-white">Avg</th>
                <th className="text-right py-3 px-4 font-semibold text-white">3-yr Median</th>
                <th className="text-right py-3 px-4 font-semibold text-white">3-yr min</th>
                <th className="text-right py-3 px-4 font-semibold text-white">3-yr max</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {sectorHoldings[selectedSector]?.map((holding) => {
                const valuation = holdingsValuations.find(v => v.ticker === holding.ticker)
                let avg, median, min, max
                if (valuation) {
                  if (selectedHoldingsTab === 'pe') {
                    avg = valuation.pe_avg
                    median = valuation.pe_median
                    min = valuation.pe_min
                    max = valuation.pe_max
                  } else if (selectedHoldingsTab === 'ev_ebitda') {
                    avg = valuation.ev_ebitda_avg
                    median = valuation.ev_ebitda_median
                    min = valuation.ev_ebitda_min
                    max = valuation.ev_ebitda_max
                  } else {
                    avg = valuation.ev_sales_avg
                    median = valuation.ev_sales_median
                    min = valuation.ev_sales_min
                    max = valuation.ev_sales_max
                  }
                }

                return (
                  <tr key={holding.ticker} className="hover:bg-slate-700/50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-white">
                      {holding.ticker}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {holding.name}
                    </td>
                    <td className="text-right py-3 px-4 font-medium text-blue-400">
                      {holding.weight.toFixed(1)}%
                    </td>
                    <td className="text-right py-3 px-4 text-slate-300">
                      {avg !== null && avg !== undefined ? avg.toFixed(1) : '-'}
                    </td>
                    <td className="text-right py-3 px-4 text-slate-300">
                      {median !== null && median !== undefined ? median.toFixed(1) : '-'}
                    </td>
                    <td className="text-right py-3 px-4 text-slate-300">
                      {min !== null && min !== undefined ? min.toFixed(1) : '-'}
                    </td>
                    <td className="text-right py-3 px-4 text-slate-300">
                      {max !== null && max !== undefined ? max.toFixed(1) : '-'}
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
