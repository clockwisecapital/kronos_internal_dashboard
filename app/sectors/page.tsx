'use client'

import { useState } from 'react'

export default function SectorsPage() {
  const [selectedSector, setSelectedSector] = useState('SMH')

  // Mock sector valuation data
  const sectorValuations = [
    {
      index: 'SPY',
      pe: { avg: 22.5, med: 21.8, win: 21.9, yr3: 19.2 },
      ps: { avg: 2.8, med: 2.5, win: 2.6, yr3: 2.1 },
      evEbitda: { avg: 14.2, med: 13.8, win: 13.9, yr3: 12.5 },
    },
    {
      index: 'QQQ',
      pe: { avg: 28.4, med: 26.1, win: 27.2, yr3: 24.8 },
      ps: { avg: 5.2, med: 4.8, win: 4.9, yr3: 4.2 },
      evEbitda: { avg: 18.7, med: 17.2, win: 17.8, yr3: 16.1 },
    },
    {
      index: 'DIA',
      pe: { avg: 18.9, med: 18.2, win: 18.5, yr3: 16.8 },
      ps: { avg: 1.9, med: 1.7, win: 1.8, yr3: 1.6 },
      evEbitda: { avg: 11.5, med: 11.1, win: 11.3, yr3: 10.2 },
    },
    {
      index: 'SMH',
      pe: { avg: 24.1, med: 23.5, win: 23.8, yr3: 21.2 },
      ps: { avg: 6.8, med: 6.2, win: 6.4, yr3: 5.5 },
      evEbitda: { avg: 15.9, med: 15.2, win: 15.4, yr3: 13.8 },
    },
    {
      index: 'IWM',
      pe: { avg: 15.2, med: 14.8, win: 15.0, yr3: 14.1 },
      ps: { avg: 1.2, med: 1.1, win: 1.15, yr3: 1.0 },
      evEbitda: { avg: 9.8, med: 9.4, win: 9.6, yr3: 8.9 },
    },
    {
      index: 'XLK',
      pe: { avg: 26.8, med: 25.2, win: 26.0, yr3: 23.5 },
      ps: { avg: 5.5, med: 5.1, win: 5.3, yr3: 4.6 },
      evEbitda: { avg: 17.2, med: 16.5, win: 16.8, yr3: 15.1 },
    },
  ]

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

  // Helper function to determine if value is expensive (red) or cheap (green)
  const getValuationColor = (current: number, historical: number) => {
    const diff = ((current - historical) / historical) * 100
    if (diff > 10) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
    if (diff < -10) return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
    return 'text-zinc-900 dark:text-white'
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

      {/* Sector Valuations Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Sector Valuations
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Current vs historical metrics • <span className="text-red-600">Red = expensive</span> • <span className="text-green-600">Green = cheap</span>
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                <th className="text-left py-3 px-4 font-semibold text-zinc-900 dark:text-white sticky left-0 bg-zinc-50 dark:bg-zinc-800/50">
                  Index
                </th>
                <th colSpan={4} className="text-center py-3 px-4 font-semibold text-zinc-900 dark:text-white border-l border-r border-zinc-200 dark:border-zinc-700">
                  P/E NTM
                </th>
                <th colSpan={4} className="text-center py-3 px-4 font-semibold text-zinc-900 dark:text-white border-r border-zinc-200 dark:border-zinc-700">
                  P/S NTM
                </th>
                <th colSpan={4} className="text-center py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                  EV/EBITDA NTM
                </th>
              </tr>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b-2 border-zinc-300 dark:border-zinc-700">
                <th className="py-2 px-4"></th>
                <th className="text-center py-2 px-2 text-zinc-600 dark:text-zinc-400 font-medium">Avg</th>
                <th className="text-center py-2 px-2 text-zinc-600 dark:text-zinc-400 font-medium">Med</th>
                <th className="text-center py-2 px-2 text-zinc-600 dark:text-zinc-400 font-medium">Win</th>
                <th className="text-center py-2 px-2 text-zinc-600 dark:text-zinc-400 font-medium border-r border-zinc-200 dark:border-zinc-700">3YR</th>
                <th className="text-center py-2 px-2 text-zinc-600 dark:text-zinc-400 font-medium">Avg</th>
                <th className="text-center py-2 px-2 text-zinc-600 dark:text-zinc-400 font-medium">Med</th>
                <th className="text-center py-2 px-2 text-zinc-600 dark:text-zinc-400 font-medium">Win</th>
                <th className="text-center py-2 px-2 text-zinc-600 dark:text-zinc-400 font-medium border-r border-zinc-200 dark:border-zinc-700">3YR</th>
                <th className="text-center py-2 px-2 text-zinc-600 dark:text-zinc-400 font-medium">Avg</th>
                <th className="text-center py-2 px-2 text-zinc-600 dark:text-zinc-400 font-medium">Med</th>
                <th className="text-center py-2 px-2 text-zinc-600 dark:text-zinc-400 font-medium">Win</th>
                <th className="text-center py-2 px-2 text-zinc-600 dark:text-zinc-400 font-medium">3YR</th>
              </tr>
            </thead>
            <tbody>
              {sectorValuations.map((sector) => (
                <tr
                  key={sector.index}
                  className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                >
                  <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-white sticky left-0 bg-white dark:bg-zinc-900">
                    {sector.index}
                  </td>
                  {/* P/E */}
                  <td className={`text-center py-3 px-2 font-medium ${getValuationColor(sector.pe.avg, sector.pe.yr3)}`}>
                    {sector.pe.avg.toFixed(1)}
                  </td>
                  <td className={`text-center py-3 px-2 font-medium ${getValuationColor(sector.pe.med, sector.pe.yr3)}`}>
                    {sector.pe.med.toFixed(1)}
                  </td>
                  <td className={`text-center py-3 px-2 font-medium ${getValuationColor(sector.pe.win, sector.pe.yr3)}`}>
                    {sector.pe.win.toFixed(1)}
                  </td>
                  <td className="text-center py-3 px-2 text-zinc-600 dark:text-zinc-400 border-r border-zinc-200 dark:border-zinc-700">
                    {sector.pe.yr3.toFixed(1)}
                  </td>
                  {/* P/S */}
                  <td className={`text-center py-3 px-2 font-medium ${getValuationColor(sector.ps.avg, sector.ps.yr3)}`}>
                    {sector.ps.avg.toFixed(1)}
                  </td>
                  <td className={`text-center py-3 px-2 font-medium ${getValuationColor(sector.ps.med, sector.ps.yr3)}`}>
                    {sector.ps.med.toFixed(1)}
                  </td>
                  <td className={`text-center py-3 px-2 font-medium ${getValuationColor(sector.ps.win, sector.ps.yr3)}`}>
                    {sector.ps.win.toFixed(1)}
                  </td>
                  <td className="text-center py-3 px-2 text-zinc-600 dark:text-zinc-400 border-r border-zinc-200 dark:border-zinc-700">
                    {sector.ps.yr3.toFixed(1)}
                  </td>
                  {/* EV/EBITDA */}
                  <td className={`text-center py-3 px-2 font-medium ${getValuationColor(sector.evEbitda.avg, sector.evEbitda.yr3)}`}>
                    {sector.evEbitda.avg.toFixed(1)}
                  </td>
                  <td className={`text-center py-3 px-2 font-medium ${getValuationColor(sector.evEbitda.med, sector.evEbitda.yr3)}`}>
                    {sector.evEbitda.med.toFixed(1)}
                  </td>
                  <td className={`text-center py-3 px-2 font-medium ${getValuationColor(sector.evEbitda.win, sector.evEbitda.yr3)}`}>
                    {sector.evEbitda.win.toFixed(1)}
                  </td>
                  <td className="text-center py-3 px-2 text-zinc-600 dark:text-zinc-400">
                    {sector.evEbitda.yr3.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sector Holdings */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Sector Holdings
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Top holdings within the selected sector/index
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Select Sector:
              </label>
              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="SMH">SMH - Semiconductors</option>
                <option value="SPY">SPY - S&P 500</option>
                <option value="QQQ">QQQ - Nasdaq 100</option>
              </select>
            </div>
          </div>
        </div>
        <div className="p-6">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="text-left py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                  Ticker
                </th>
                <th className="text-left py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                  Company Name
                </th>
                <th className="text-right py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                  Weight
                </th>
              </tr>
            </thead>
            <tbody>
              {sectorHoldings[selectedSector]?.map((holding) => (
                <tr
                  key={holding.ticker}
                  className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                >
                  <td className="py-4 px-4 font-semibold text-zinc-900 dark:text-white">
                    {holding.ticker}
                  </td>
                  <td className="py-4 px-4 text-zinc-600 dark:text-zinc-400">
                    {holding.name}
                  </td>
                  <td className="text-right py-4 px-4 font-medium text-blue-600 dark:text-blue-400">
                    {holding.weight.toFixed(1)}%
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
