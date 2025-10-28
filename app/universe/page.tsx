'use client'

import { useState, useEffect } from 'react'

interface UniverseStock {
  id?: string
  ticker: string
  name: string
  clockwise_val: string | null
  pulls_into_val: string | null
  gics: string | null
  clockwise_sector: string | null
  risk_score: string | null
  path: string | null
  optionality: string | null
  core_noncore: string | null
  beta_3yr: number | null
  beta_1yr: number | null
  true_beta_adj: string | null
  true_beta: number | null
  
  // BASE CASE
  base_methodology: string
  base_ticker_3yr_multiple: number
  base_ticker_ntm_multiple: number
  base_sector_3yr_multiple: number
  base_sector_ntm_multiple: number
  base_clockwise_rel_multiple: number
  base_metric: string
  base_target_price: number
  base_upside_pct: number
  
  // UPSIDE
  upside_methodology: string
  upside_ticker_3yr_multiple: number
  upside_ticker_ntm_multiple: number
  upside_sector_3yr_multiple: number
  upside_sector_ntm_multiple: number
  upside_clockwise_rel_multiple: number
  upside_metric: string
  upside_target_price: number
  upside_upside_pct: number
}

// Hardcoded sample data
const SAMPLE_DATA: UniverseStock[] = [
  {
    ticker: 'NVDA',
    name: 'NVIDIA Corporation',
    clockwise_val: 'Clockwise',
    pulls_into_val: 'SMH',
    gics: 'Information Technology',
    clockwise_sector: 'AI/Semiconductors',
    risk_score: 'Risk on (+1)',
    path: 'Growth',
    optionality: 'High',
    core_noncore: 'Core',
    beta_3yr: 1.85,
    beta_1yr: 1.92,
    true_beta_adj: 'SMH',
    true_beta: 1.80,
    base_methodology: 'P/E',
    base_ticker_3yr_multiple: 45.2,
    base_ticker_ntm_multiple: 38.5,
    base_sector_3yr_multiple: 28.3,
    base_sector_ntm_multiple: 25.1,
    base_clockwise_rel_multiple: 1.60,
    base_metric: 'EPS',
    base_target_price: 525.00,
    base_upside_pct: 12.5,
    upside_methodology: 'P/E',
    upside_ticker_3yr_multiple: 52.0,
    upside_ticker_ntm_multiple: 45.0,
    upside_sector_3yr_multiple: 28.3,
    upside_sector_ntm_multiple: 25.1,
    upside_clockwise_rel_multiple: 1.85,
    upside_metric: 'EPS',
    upside_target_price: 625.00,
    upside_upside_pct: 33.9
  },
  {
    ticker: 'AAPL',
    name: 'Apple Inc.',
    clockwise_val: 'Default',
    pulls_into_val: 'QQQ',
    gics: 'Information Technology',
    clockwise_sector: 'Consumer Tech',
    risk_score: 'Risk on (+1)',
    path: 'Quality',
    optionality: 'Medium',
    core_noncore: 'Core',
    beta_3yr: 1.28,
    beta_1yr: 1.32,
    true_beta_adj: 'QQQ',
    true_beta: 1.27,
    base_methodology: 'P/E',
    base_ticker_3yr_multiple: 28.5,
    base_ticker_ntm_multiple: 26.2,
    base_sector_3yr_multiple: 28.3,
    base_sector_ntm_multiple: 25.1,
    base_clockwise_rel_multiple: 1.10,
    base_metric: 'EPS',
    base_target_price: 195.00,
    base_upside_pct: 8.3,
    upside_methodology: 'P/E',
    upside_ticker_3yr_multiple: 32.0,
    upside_ticker_ntm_multiple: 29.5,
    upside_sector_3yr_multiple: 28.3,
    upside_sector_ntm_multiple: 25.1,
    upside_clockwise_rel_multiple: 1.25,
    upside_metric: 'EPS',
    upside_target_price: 220.00,
    upside_upside_pct: 22.2
  },
  {
    ticker: 'MSFT',
    name: 'Microsoft Corporation',
    clockwise_val: 'Clockwise',
    pulls_into_val: 'QQQ',
    gics: 'Information Technology',
    clockwise_sector: 'Cloud/Software',
    risk_score: 'Risk on (+1)',
    path: 'Quality',
    optionality: 'High',
    core_noncore: 'Core',
    beta_3yr: 1.15,
    beta_1yr: 1.18,
    true_beta_adj: 'QQQ',
    true_beta: 1.14,
    base_methodology: 'P/E',
    base_ticker_3yr_multiple: 32.8,
    base_ticker_ntm_multiple: 30.5,
    base_sector_3yr_multiple: 28.3,
    base_sector_ntm_multiple: 25.1,
    base_clockwise_rel_multiple: 1.20,
    base_metric: 'EPS',
    base_target_price: 425.00,
    base_upside_pct: 5.2,
    upside_methodology: 'P/E',
    upside_ticker_3yr_multiple: 38.0,
    upside_ticker_ntm_multiple: 35.0,
    upside_sector_3yr_multiple: 28.3,
    upside_sector_ntm_multiple: 25.1,
    upside_clockwise_rel_multiple: 1.40,
    upside_metric: 'EPS',
    upside_target_price: 485.00,
    upside_upside_pct: 20.1
  },
  {
    ticker: 'GOOGL',
    name: 'Alphabet Inc.',
    clockwise_val: 'Default',
    pulls_into_val: 'QQQ',
    gics: 'Communication Services',
    clockwise_sector: 'Internet/Search',
    risk_score: 'Risk on (+1)',
    path: 'Growth',
    optionality: 'Medium',
    core_noncore: 'Core',
    beta_3yr: 1.22,
    beta_1yr: 1.25,
    true_beta_adj: 'QQQ',
    true_beta: 1.20,
    base_methodology: 'P/E',
    base_ticker_3yr_multiple: 24.5,
    base_ticker_ntm_multiple: 22.8,
    base_sector_3yr_multiple: 22.1,
    base_sector_ntm_multiple: 20.5,
    base_clockwise_rel_multiple: 1.15,
    base_metric: 'EPS',
    base_target_price: 152.00,
    base_upside_pct: 10.1,
    upside_methodology: 'P/E',
    upside_ticker_3yr_multiple: 28.0,
    upside_ticker_ntm_multiple: 26.0,
    upside_sector_3yr_multiple: 22.1,
    upside_sector_ntm_multiple: 20.5,
    upside_clockwise_rel_multiple: 1.30,
    upside_metric: 'EPS',
    upside_target_price: 175.00,
    upside_upside_pct: 26.8
  },
  {
    ticker: 'TSLA',
    name: 'Tesla Inc.',
    clockwise_val: 'Clockwise',
    pulls_into_val: 'QQQ',
    gics: 'Consumer Discretionary',
    clockwise_sector: 'EV/Clean Energy',
    risk_score: 'Risk on (+1)',
    path: 'Growth',
    optionality: 'Very High',
    core_noncore: 'Non-Core',
    beta_3yr: 2.15,
    beta_1yr: 2.28,
    true_beta_adj: 'QQQ',
    true_beta: 2.10,
    base_methodology: 'P/S',
    base_ticker_3yr_multiple: 8.2,
    base_ticker_ntm_multiple: 7.5,
    base_sector_3yr_multiple: 1.8,
    base_sector_ntm_multiple: 1.6,
    base_clockwise_rel_multiple: 4.50,
    base_metric: 'Revenue',
    base_target_price: 245.00,
    base_upside_pct: 3.8,
    upside_methodology: 'P/S',
    upside_ticker_3yr_multiple: 10.5,
    upside_ticker_ntm_multiple: 9.8,
    upside_sector_3yr_multiple: 1.8,
    upside_sector_ntm_multiple: 1.6,
    upside_clockwise_rel_multiple: 6.00,
    upside_metric: 'Revenue',
    upside_target_price: 325.00,
    upside_upside_pct: 37.7
  },
  {
    ticker: 'META',
    name: 'Meta Platforms Inc.',
    clockwise_val: 'Default',
    pulls_into_val: 'QQQ',
    gics: 'Communication Services',
    clockwise_sector: 'Social Media',
    risk_score: 'Risk on (+1)',
    path: 'Value',
    optionality: 'High',
    core_noncore: 'Core',
    beta_3yr: 1.32,
    beta_1yr: 1.38,
    true_beta_adj: 'QQQ',
    true_beta: 1.30,
    base_methodology: 'P/E',
    base_ticker_3yr_multiple: 22.5,
    base_ticker_ntm_multiple: 20.8,
    base_sector_3yr_multiple: 22.1,
    base_sector_ntm_multiple: 20.5,
    base_clockwise_rel_multiple: 1.05,
    base_metric: 'EPS',
    base_target_price: 485.00,
    base_upside_pct: 7.8,
    upside_methodology: 'P/E',
    upside_ticker_3yr_multiple: 26.0,
    upside_ticker_ntm_multiple: 24.0,
    upside_sector_3yr_multiple: 22.1,
    upside_sector_ntm_multiple: 20.5,
    upside_clockwise_rel_multiple: 1.20,
    upside_metric: 'EPS',
    upside_target_price: 550.00,
    upside_upside_pct: 22.2
  },
  {
    ticker: 'JNJ',
    name: 'Johnson & Johnson',
    clockwise_val: 'Default',
    pulls_into_val: 'XLV',
    gics: 'Health Care',
    clockwise_sector: 'Pharma',
    risk_score: 'Risk off (-1)',
    path: 'Quality',
    optionality: 'Low',
    core_noncore: 'Core',
    beta_3yr: 0.68,
    beta_1yr: 0.72,
    true_beta_adj: 'XLV',
    true_beta: 0.67,
    base_methodology: 'P/E',
    base_ticker_3yr_multiple: 16.5,
    base_ticker_ntm_multiple: 15.8,
    base_sector_3yr_multiple: 18.2,
    base_sector_ntm_multiple: 17.1,
    base_clockwise_rel_multiple: 0.95,
    base_metric: 'EPS',
    base_target_price: 168.00,
    base_upside_pct: 4.2,
    upside_methodology: 'P/E',
    upside_ticker_3yr_multiple: 18.5,
    upside_ticker_ntm_multiple: 17.5,
    upside_sector_3yr_multiple: 18.2,
    upside_sector_ntm_multiple: 17.1,
    upside_clockwise_rel_multiple: 1.05,
    upside_metric: 'EPS',
    upside_target_price: 185.00,
    upside_upside_pct: 14.8
  },
  {
    ticker: 'SPY',
    name: 'SPDR S&P 500 ETF',
    clockwise_val: 'Default',
    pulls_into_val: 'SPY',
    gics: 'ETF',
    clockwise_sector: 'Broad Market',
    risk_score: 'Neutral (0)',
    path: 'Market',
    optionality: 'N/A',
    core_noncore: 'Core',
    beta_3yr: 1.00,
    beta_1yr: 1.00,
    true_beta_adj: 'SPY',
    true_beta: 1.00,
    base_methodology: 'P/E',
    base_ticker_3yr_multiple: 21.5,
    base_ticker_ntm_multiple: 19.8,
    base_sector_3yr_multiple: 21.5,
    base_sector_ntm_multiple: 19.8,
    base_clockwise_rel_multiple: 1.00,
    base_metric: 'Index',
    base_target_price: 485.00,
    base_upside_pct: 5.0,
    upside_methodology: 'P/E',
    upside_ticker_3yr_multiple: 23.0,
    upside_ticker_ntm_multiple: 21.5,
    upside_sector_3yr_multiple: 21.5,
    upside_sector_ntm_multiple: 19.8,
    upside_clockwise_rel_multiple: 1.10,
    upside_metric: 'Index',
    upside_target_price: 520.00,
    upside_upside_pct: 12.6
  }
]

// Dropdown options
const CLOCKWISE_VAL_OPTIONS = ['Clockwise', 'Default']
const PULLS_INTO_VAL_OPTIONS = ['QQQ', 'SMH', 'IGV', 'ITA', 'XLB', 'XLE', 'XLI', 'XLRE', 'XLU', 'XLV', 'mNAV', 'HEDGE', 'CASH', 'XLF', 'SPY']
const GICS_OPTIONS = [
  'Information Technology',
  'Communication Services', 
  'Consumer Discretionary',
  'Consumer Staples',
  'Energy',
  'Financials',
  'Health Care',
  'Industrials',
  'Materials',
  'Real Estate',
  'Utilities'
]
const CLOCKWISE_SECTOR_OPTIONS = [
  'Technology',
  'Communication',
  'Crypto',
  'Discretionary',
  'Energy',
  'Financials',
  'Healthcare',
  'Industrials',
  'Materials',
  'Semis',
  'Software',
  'Staples',
  'Real Estate',
  'Utilities',
  'Hedge',
  'CASH'
]
const RISK_SCORE_OPTIONS = [
  'Risk on (+1)',
  'Neutral (0)',
  'Risk off (-1)',
  'Hedge'
]
const PATH_OPTIONS = [
  'Neutral',
  'Known',
  'Unknown',
  'Hedge'
]
const OPTIONALITY_OPTIONS = [
  'Neutral',
  'Known',
  'Unknown',
  'Hedge'
]
const CORE_NONCORE_OPTIONS = [
  'Core',
  'Non-Core',
  'Hedge'
]
const TRUE_BETA_ADJ_OPTIONS = [
  'QQQ',
  '3-Year',
  'DIA',
  'SPY',
  'SMH',
  '1-Year',
  'XLB',
  'XLU',
  'Crypto'
]
const METHODOLOGY_OPTIONS = [
  'P/E x',
  'P/S x',
  'EBITDA x',
  'mNAV x',
  'HEDGE',
  'Special'
]

export default function UniversePage() {
  const [data, setData] = useState<UniverseStock[]>(SAMPLE_DATA)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  // Fetch data from API
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const response = await fetch('/api/universe')
        const json = await response.json()
        
        if (json.success && json.data && json.data.length > 0) {
          setData(json.data)
        } else {
          // Use sample data if no data in database
          console.log('No data in database, using sample data')
        }
      } catch (error) {
        console.error('Error fetching universe data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [])

  // Update field in database
  async function updateField(ticker: string, field: string, value: string) {
    try {
      setSaving(`${ticker}-${field}`)
      
      // Get the stock name for potential creation
      const stock = data.find(s => s.ticker === ticker)
      
      const response = await fetch('/api/universe', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, field, value, name: stock?.name || ticker })
      })
      
      const json = await response.json()
      
      if (json.success) {
        // Update local state
        setData(prev => prev.map(stock => 
          stock.ticker === ticker ? { ...stock, [field]: value } : stock
        ))
      } else {
        alert(`Failed to update: ${json.message}`)
      }
    } catch (error) {
      console.error('Error updating field:', error)
      alert('Failed to update field')
    } finally {
      setSaving(null)
    }
  }


  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          Investment Universe
        </h1>
        <p className="text-slate-400 mt-1">
          Comprehensive stock analysis with valuation metrics and target prices
        </p>
        {data === SAMPLE_DATA && (
          <p className="text-sm text-amber-400 mt-2">
            ⚠️ No holdings found - upload holdings.csv first. Data will auto-populate from your portfolio.
          </p>
        )}
        {data !== SAMPLE_DATA && (
          <p className="text-sm text-green-400 mt-2">
            ✅ Showing {data.length} stocks from your portfolio. Edit dropdowns to customize.
          </p>
        )}
      </div>

      {/* Universe Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">
            Stock Universe Analysis
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            32 columns of fundamental, technical, and valuation data
          </p>
        </div>
        
        <div className="overflow-x-auto overflow-y-auto max-h-[800px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              {/* Section Headers */}
              <tr className="bg-slate-900 border-b border-slate-600">
                <th colSpan={14} className="text-left py-2 px-4 font-bold text-white border-r border-slate-600">
                  BASIC INFORMATION
                </th>
                <th colSpan={9} className="text-left py-2 px-4 font-bold text-blue-400 border-r border-slate-600">
                  BASE CASE VALUATION
                </th>
                <th colSpan={9} className="text-left py-2 px-4 font-bold text-green-400">
                  UPSIDE VALUATION
                </th>
              </tr>
              
              {/* Column Headers */}
              <tr className="bg-slate-700 border-b border-slate-600">
                {/* Basic Info */}
                <th className="text-left py-3 px-4 font-semibold text-white sticky left-0 bg-slate-700 z-20 border-r border-slate-600">Ticker</th>
                <th className="text-left py-3 px-4 font-semibold text-white">Name</th>
                <th className="text-left py-3 px-4 font-semibold text-white">CW Val/Default</th>
                <th className="text-left py-3 px-4 font-semibold text-white">Pulls Into Val</th>
                <th className="text-left py-3 px-4 font-semibold text-white">GICS</th>
                <th className="text-left py-3 px-4 font-semibold text-white">CW Sector</th>
                <th className="text-left py-3 px-4 font-semibold text-white">Risk Score</th>
                <th className="text-left py-3 px-4 font-semibold text-white">Path</th>
                <th className="text-left py-3 px-4 font-semibold text-white">Optionality</th>
                <th className="text-left py-3 px-4 font-semibold text-white">Core/Non-Core</th>
                <th className="text-right py-3 px-4 font-semibold text-white">3-Yr Beta</th>
                <th className="text-right py-3 px-4 font-semibold text-white">1-Yr Beta</th>
                <th className="text-right py-3 px-4 font-semibold text-white">True Beta Adj</th>
                <th className="text-right py-3 px-4 font-semibold text-white border-r border-slate-600">True Beta</th>
                
                {/* BASE CASE */}
                <th className="text-left py-3 px-4 font-semibold text-blue-400 bg-blue-900/20">Method Base</th>
                <th className="text-right py-3 px-4 font-semibold text-blue-400 bg-blue-900/20">Ticker 3Y Mult</th>
                <th className="text-right py-3 px-4 font-semibold text-blue-400 bg-blue-900/20">Ticker NTM Mult</th>
                <th className="text-right py-3 px-4 font-semibold text-blue-400 bg-blue-900/20">Sector 3Y Mult</th>
                <th className="text-right py-3 px-4 font-semibold text-blue-400 bg-blue-900/20">Sector NTM Mult</th>
                <th className="text-right py-3 px-4 font-semibold text-blue-400 bg-blue-900/20">CW Rel Mult</th>
                <th className="text-left py-3 px-4 font-semibold text-blue-400 bg-blue-900/20">Metric</th>
                <th className="text-right py-3 px-4 font-semibold text-blue-400 bg-blue-900/20">Tgt Price</th>
                <th className="text-right py-3 px-4 font-semibold text-blue-400 bg-blue-900/20 border-r border-slate-600">% Up</th>
                
                {/* UPSIDE */}
                <th className="text-left py-3 px-4 font-semibold text-green-400 bg-green-900/20">Method Base</th>
                <th className="text-right py-3 px-4 font-semibold text-green-400 bg-green-900/20">Ticker 3Y Mult</th>
                <th className="text-right py-3 px-4 font-semibold text-green-400 bg-green-900/20">Ticker NTM Mult</th>
                <th className="text-right py-3 px-4 font-semibold text-green-400 bg-green-900/20">Sector 3Y Mult</th>
                <th className="text-right py-3 px-4 font-semibold text-green-400 bg-green-900/20">Sector NTM Mult</th>
                <th className="text-right py-3 px-4 font-semibold text-green-400 bg-green-900/20">CW Rel Mult</th>
                <th className="text-left py-3 px-4 font-semibold text-green-400 bg-green-900/20">Metric</th>
                <th className="text-right py-3 px-4 font-semibold text-green-400 bg-green-900/20">Tgt Price</th>
                <th className="text-right py-3 px-4 font-semibold text-green-400 bg-green-900/20">% Up</th>
              </tr>
            </thead>
            <tbody>
              {data.map((stock, idx) => (
                <tr
                  key={idx}
                  className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors"
                >
                  {/* Basic Info */}
                  <td className="py-3 px-4 font-bold text-white sticky left-0 bg-slate-800 hover:bg-slate-700/50 border-r border-slate-700">{stock.ticker}</td>
                  <td className="py-3 px-4 text-slate-300 whitespace-nowrap">{stock.name}</td>
                  {/* Editable: Clockwise Val */}
                  <td className="py-3 px-4">
                    <select
                      value={stock.clockwise_val || ''}
                      onChange={(e) => updateField(stock.ticker, 'clockwise_val', e.target.value)}
                      disabled={saving === `${stock.ticker}-clockwise_val`}
                      className="bg-slate-700 text-slate-300 border border-slate-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="">Select...</option>
                      {CLOCKWISE_VAL_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  {/* Editable: Pulls Into Val */}
                  <td className="py-3 px-4">
                    <select
                      value={stock.pulls_into_val || ''}
                      onChange={(e) => updateField(stock.ticker, 'pulls_into_val', e.target.value)}
                      disabled={saving === `${stock.ticker}-pulls_into_val`}
                      className="bg-slate-700 text-slate-300 border border-slate-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="">Select...</option>
                      {PULLS_INTO_VAL_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  {/* Editable: GICS */}
                  <td className="py-3 px-4">
                    <select
                      value={stock.gics || ''}
                      onChange={(e) => updateField(stock.ticker, 'gics', e.target.value)}
                      disabled={saving === `${stock.ticker}-gics`}
                      className="bg-slate-700 text-slate-300 border border-slate-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="">Select...</option>
                      {GICS_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  {/* Editable: Clockwise Sector */}
                  <td className="py-3 px-4">
                    <select
                      value={stock.clockwise_sector || ''}
                      onChange={(e) => updateField(stock.ticker, 'clockwise_sector', e.target.value)}
                      disabled={saving === `${stock.ticker}-clockwise_sector`}
                      className="bg-slate-700 text-slate-300 border border-slate-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="">Select...</option>
                      {CLOCKWISE_SECTOR_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  {/* Editable: Risk Score */}
                  <td className="py-3 px-4">
                    <select
                      value={stock.risk_score || ''}
                      onChange={(e) => updateField(stock.ticker, 'risk_score', e.target.value)}
                      disabled={saving === `${stock.ticker}-risk_score`}
                      className="bg-slate-700 text-slate-300 border border-slate-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="">Select...</option>
                      {RISK_SCORE_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  {/* Editable: Path */}
                  <td className="py-3 px-4">
                    <select
                      value={stock.path || ''}
                      onChange={(e) => updateField(stock.ticker, 'path', e.target.value)}
                      disabled={saving === `${stock.ticker}-path`}
                      className="bg-slate-700 text-slate-300 border border-slate-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="">Select...</option>
                      {PATH_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  {/* Editable: Optionality */}
                  <td className="py-3 px-4">
                    <select
                      value={stock.optionality || ''}
                      onChange={(e) => updateField(stock.ticker, 'optionality', e.target.value)}
                      disabled={saving === `${stock.ticker}-optionality`}
                      className="bg-slate-700 text-slate-300 border border-slate-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="">Select...</option>
                      {OPTIONALITY_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  {/* Editable: Core/Non-Core */}
                  <td className="py-3 px-4">
                    <select
                      value={stock.core_noncore || ''}
                      onChange={(e) => updateField(stock.ticker, 'core_noncore', e.target.value)}
                      disabled={saving === `${stock.ticker}-core_noncore`}
                      className="bg-slate-700 text-slate-300 border border-slate-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="">Select...</option>
                      {CORE_NONCORE_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  {/* Editable: 3-yr Beta */}
                  <td className="py-3 px-4">
                    <input
                      type="number"
                      step="0.01"
                      value={stock.beta_3yr || ''}
                      onChange={(e) => updateField(stock.ticker, 'beta_3yr', e.target.value)}
                      disabled={saving === `${stock.ticker}-beta_3yr`}
                      placeholder="0.00"
                      className="w-20 bg-slate-700 text-slate-300 border border-slate-600 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </td>
                  {/* Editable: 1-yr Beta */}
                  <td className="py-3 px-4">
                    <input
                      type="number"
                      step="0.01"
                      value={stock.beta_1yr || ''}
                      onChange={(e) => updateField(stock.ticker, 'beta_1yr', e.target.value)}
                      disabled={saving === `${stock.ticker}-beta_1yr`}
                      placeholder="0.00"
                      className="w-20 bg-slate-700 text-slate-300 border border-slate-600 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </td>
                  {/* Editable: True Beta Adj */}
                  <td className="py-3 px-4">
                    <select
                      value={stock.true_beta_adj?.toString() || ''}
                      onChange={(e) => updateField(stock.ticker, 'true_beta_adj', e.target.value)}
                      disabled={saving === `${stock.ticker}-true_beta_adj`}
                      className="bg-slate-700 text-slate-300 border border-slate-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="">Select...</option>
                      {TRUE_BETA_ADJ_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  {/* Editable: True Beta (text input) */}
                  <td className="py-3 px-4 border-r border-slate-700">
                    <input
                      type="number"
                      step="0.01"
                      value={stock.true_beta || ''}
                      onChange={(e) => updateField(stock.ticker, 'true_beta', e.target.value)}
                      disabled={saving === `${stock.ticker}-true_beta`}
                      placeholder="0.00"
                      className="w-20 bg-slate-700 text-slate-300 border border-slate-600 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </td>
                  
                  {/* BASE CASE */}
                  {/* Methodology Base - Dropdown */}
                  <td className="py-3 px-4 bg-blue-900/10">
                    <select
                      value={stock.base_methodology || ''}
                      onChange={(e) => updateField(stock.ticker, 'base_methodology', e.target.value)}
                      disabled={saving === `${stock.ticker}-base_methodology`}
                      className="bg-slate-700 text-slate-300 border border-slate-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="">Select...</option>
                      {METHODOLOGY_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  {/* Ticker 3-yr Multiple */}
                  <td className="py-3 px-4 bg-blue-900/10">
                    <input
                      type="number"
                      step="0.1"
                      value={stock.base_ticker_3yr_multiple || ''}
                      onChange={(e) => updateField(stock.ticker, 'base_ticker_3yr_multiple', e.target.value)}
                      disabled={saving === `${stock.ticker}-base_ticker_3yr_multiple`}
                      placeholder="0.0"
                      className="w-16 bg-slate-700 text-slate-300 border border-slate-600 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </td>
                  {/* Ticker NTM Multiple */}
                  <td className="py-3 px-4 bg-blue-900/10">
                    <input
                      type="number"
                      step="0.1"
                      value={stock.base_ticker_ntm_multiple || ''}
                      onChange={(e) => updateField(stock.ticker, 'base_ticker_ntm_multiple', e.target.value)}
                      disabled={saving === `${stock.ticker}-base_ticker_ntm_multiple`}
                      placeholder="0.0"
                      className="w-16 bg-slate-700 text-slate-300 border border-slate-600 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </td>
                  {/* Sector 3-yr Multiple */}
                  <td className="py-3 px-4 bg-blue-900/10">
                    <input
                      type="number"
                      step="0.1"
                      value={stock.base_sector_3yr_multiple || ''}
                      onChange={(e) => updateField(stock.ticker, 'base_sector_3yr_multiple', e.target.value)}
                      disabled={saving === `${stock.ticker}-base_sector_3yr_multiple`}
                      placeholder="0.0"
                      className="w-16 bg-slate-700 text-slate-300 border border-slate-600 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </td>
                  {/* Sector NTM Multiple */}
                  <td className="py-3 px-4 bg-blue-900/10">
                    <input
                      type="number"
                      step="0.1"
                      value={stock.base_sector_ntm_multiple || ''}
                      onChange={(e) => updateField(stock.ticker, 'base_sector_ntm_multiple', e.target.value)}
                      disabled={saving === `${stock.ticker}-base_sector_ntm_multiple`}
                      placeholder="0.0"
                      className="w-16 bg-slate-700 text-slate-300 border border-slate-600 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </td>
                  {/* Clockwise Rel Multiple */}
                  <td className="py-3 px-4 bg-blue-900/10">
                    <input
                      type="number"
                      step="0.01"
                      value={stock.base_clockwise_rel_multiple || ''}
                      onChange={(e) => updateField(stock.ticker, 'base_clockwise_rel_multiple', e.target.value)}
                      disabled={saving === `${stock.ticker}-base_clockwise_rel_multiple`}
                      placeholder="0.00"
                      className="w-16 bg-slate-700 text-slate-300 border border-slate-600 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </td>
                  {/* Metric */}
                  <td className="py-3 px-4 bg-blue-900/10">
                    <input
                      type="text"
                      value={stock.base_metric || ''}
                      onChange={(e) => updateField(stock.ticker, 'base_metric', e.target.value)}
                      disabled={saving === `${stock.ticker}-base_metric`}
                      placeholder="EPS"
                      className="w-16 bg-slate-700 text-slate-300 border border-slate-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </td>
                  {/* Target Price - Calculated */}
                  <td className="text-right py-3 px-4 font-semibold text-blue-300 bg-blue-900/10">{stock.base_target_price ? `$${stock.base_target_price.toFixed(2)}` : '-'}</td>
                  {/* % Up - Calculated */}
                  <td className={`text-right py-3 px-4 font-semibold bg-blue-900/10 border-r border-slate-700 ${stock.base_upside_pct && stock.base_upside_pct >= 0 ? 'text-green-400' : stock.base_upside_pct ? 'text-red-400' : 'text-slate-400'}`}>
                    {stock.base_upside_pct ? `${stock.base_upside_pct > 0 ? '+' : ''}${stock.base_upside_pct.toFixed(1)}%` : '-'}
                  </td>
                  
                  {/* UPSIDE */}
                  {/* Methodology Base - Dropdown */}
                  <td className="py-3 px-4 bg-green-900/10">
                    <select
                      value={stock.upside_methodology || ''}
                      onChange={(e) => updateField(stock.ticker, 'upside_methodology', e.target.value)}
                      disabled={saving === `${stock.ticker}-upside_methodology`}
                      className="bg-slate-700 text-slate-300 border border-slate-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="">Select...</option>
                      {METHODOLOGY_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  {/* Ticker 3-yr Multiple */}
                  <td className="py-3 px-4 bg-green-900/10">
                    <input
                      type="number"
                      step="0.1"
                      value={stock.upside_ticker_3yr_multiple || ''}
                      onChange={(e) => updateField(stock.ticker, 'upside_ticker_3yr_multiple', e.target.value)}
                      disabled={saving === `${stock.ticker}-upside_ticker_3yr_multiple`}
                      placeholder="0.0"
                      className="w-16 bg-slate-700 text-slate-300 border border-slate-600 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </td>
                  {/* Ticker NTM Multiple */}
                  <td className="py-3 px-4 bg-green-900/10">
                    <input
                      type="number"
                      step="0.1"
                      value={stock.upside_ticker_ntm_multiple || ''}
                      onChange={(e) => updateField(stock.ticker, 'upside_ticker_ntm_multiple', e.target.value)}
                      disabled={saving === `${stock.ticker}-upside_ticker_ntm_multiple`}
                      placeholder="0.0"
                      className="w-16 bg-slate-700 text-slate-300 border border-slate-600 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </td>
                  {/* Sector 3-yr Multiple */}
                  <td className="py-3 px-4 bg-green-900/10">
                    <input
                      type="number"
                      step="0.1"
                      value={stock.upside_sector_3yr_multiple || ''}
                      onChange={(e) => updateField(stock.ticker, 'upside_sector_3yr_multiple', e.target.value)}
                      disabled={saving === `${stock.ticker}-upside_sector_3yr_multiple`}
                      placeholder="0.0"
                      className="w-16 bg-slate-700 text-slate-300 border border-slate-600 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </td>
                  {/* Sector NTM Multiple */}
                  <td className="py-3 px-4 bg-green-900/10">
                    <input
                      type="number"
                      step="0.1"
                      value={stock.upside_sector_ntm_multiple || ''}
                      onChange={(e) => updateField(stock.ticker, 'upside_sector_ntm_multiple', e.target.value)}
                      disabled={saving === `${stock.ticker}-upside_sector_ntm_multiple`}
                      placeholder="0.0"
                      className="w-16 bg-slate-700 text-slate-300 border border-slate-600 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </td>
                  {/* Clockwise Rel Multiple */}
                  <td className="py-3 px-4 bg-green-900/10">
                    <input
                      type="number"
                      step="0.01"
                      value={stock.upside_clockwise_rel_multiple || ''}
                      onChange={(e) => updateField(stock.ticker, 'upside_clockwise_rel_multiple', e.target.value)}
                      disabled={saving === `${stock.ticker}-upside_clockwise_rel_multiple`}
                      placeholder="0.00"
                      className="w-16 bg-slate-700 text-slate-300 border border-slate-600 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </td>
                  {/* Metric */}
                  <td className="py-3 px-4 bg-green-900/10">
                    <input
                      type="text"
                      value={stock.upside_metric || ''}
                      onChange={(e) => updateField(stock.ticker, 'upside_metric', e.target.value)}
                      disabled={saving === `${stock.ticker}-upside_metric`}
                      placeholder="EPS"
                      className="w-16 bg-slate-700 text-slate-300 border border-slate-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </td>
                  {/* Target Price - Calculated */}
                  <td className="text-right py-3 px-4 font-semibold text-green-300 bg-green-900/10">{stock.upside_target_price ? `$${stock.upside_target_price.toFixed(2)}` : '-'}</td>
                  {/* % Up - Calculated */}
                  <td className={`text-right py-3 px-4 font-semibold bg-green-900/10 ${stock.upside_upside_pct && stock.upside_upside_pct >= 0 ? 'text-green-400' : stock.upside_upside_pct ? 'text-red-400' : 'text-slate-400'}`}>
                    {stock.upside_upside_pct ? `${stock.upside_upside_pct > 0 ? '+' : ''}${stock.upside_upside_pct.toFixed(1)}%` : '-'}
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
