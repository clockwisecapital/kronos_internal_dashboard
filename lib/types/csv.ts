// CSV Upload Type Definitions

export type CSVFileType = 
  | 'holdings' 
  | 'weightings'
  | 'prices' 
  | 'fundamentals' 
  | 'benchmarks' 
  | 'sector_valuations'
  | 'cycle_indicators'
  | 'model_portfolios'
  | 'any'

export type UploadStatus = 'processing' | 'completed' | 'failed'

export interface CSVUploadRecord {
  id: string
  user_id: string
  file_name: string
  file_type: CSVFileType
  upload_date: string
  row_count: number
  status: UploadStatus
  error_message?: string
  metadata?: Record<string, unknown>
}

export interface HoldingRecord {
  date: string
  account: string
  stock_ticker: string
  cusip: string
  security_name: string
  shares: number
  close_price: number  // Close price from CSV (renamed from 'price')
  market_value: number  // Market value from CSV
  weightings: number
  net_assets: number
  shares_outstand: number
  creation_units: number
  // Calculated/API fields (added after upload)
  current_price?: number  // From API (placeholder)
  pct_change?: number  // Calculated: (current_price/close_price - 1) * 100
  avg_index_weight?: number  // Placeholder: avg of QQQ and S&P weights
  index_ratio?: number  // Placeholder: Weight / QQQ Weight
  qqq_weight?: number  // Placeholder: from benchmark csv
  sp_weight?: number  // Placeholder: from benchmark csv
  earnings_date?: string  // Placeholder: from fundamentals csv
  earnings_time?: string  // Placeholder: future field
}

export interface WeightingsRecord {
  ticker: string
  name: string
  spy?: number  // S&P 500 weight
  qqq?: number  // Nasdaq 100 weight
  xlk?: number
  xlf?: number
  xlc?: number
  xly?: number
  xlp?: number
  xle?: number
  xlv?: number
  xli?: number
  xlb?: number
  xlre?: number
  xlu?: number
  igv?: number
  ita?: number
  soxx?: number
  smh?: number
  arkk?: number
}

export interface PriceRecord {
  ticker: string
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface FundamentalRecord {
  ticker: string
  sector: string
  pe_ratio: number
  ev_ebitda: number
  ev_sales: number
  base_upside: number
  opt_upside: number
  return_12m: number
  return_36m: number
  vol_12m: number
  sharpe: number
  max_dd: number
  corr_spy: number
  beta: number
  rev_growth: number
  margin: number
  roe: number
  debt_equity: number
  fcf_yield: number
  div_yield: number
  analyst_rating: number
  price_target_upside: number
  short_interest: number
  inst_ownership: number
}

export interface BenchmarkRecord {
  index: string
  date: string
  price: number
  change_1d: number
  change_5d: number
  change_30d: number
  change_ytd: number
}

export interface SectorValuationRecord {
  index: string
  pe_avg: number
  pe_med: number
  pe_win: number
  pe_3yr: number
  ps_avg: number
  ps_med: number
  ps_win: number
  ps_3yr: number
  pb_avg: number
  pb_med: number
  pb_win: number
  pb_3yr: number
  div_yield_avg: number
  div_yield_med: number
}

export interface CycleIndicatorRecord {
  cycle_type: string
  phase: string
  alignment_pct: number
  trend: string
  description: string
  updated_date: string
}

export interface ModelPortfolioRecord {
  model_name: string
  ticker: string
  target_weight: number
  asset_class: string
  sector: string
}

export type CSVRecord = 
  | HoldingRecord 
  | WeightingsRecord
  | PriceRecord 
  | FundamentalRecord 
  | BenchmarkRecord 
  | SectorValuationRecord
  | CycleIndicatorRecord
  | ModelPortfolioRecord

export interface ParsedCSVData {
  records: CSVRecord[]
  rowCount: number
  columns: string[]
  warnings?: string[]
  errors?: string[]
}

export interface UploadResponse {
  success: boolean
  uploadId?: string
  message: string
  preview?: ParsedCSVData
  error?: string
  fileType?: CSVFileType
  fileName?: string
}

export interface MultiUploadResponse {
  results: UploadResponse[]
  totalFiles: number
  successCount: number
  failureCount: number
}

// Schema definitions for validation
export const CSV_SCHEMAS = {
  holdings: [
    'date',
    'account',
    'stock_ticker',
    'cusip',
    'security_name',
    'shares',
    'close_price',  // Renamed from 'price' - this is close price from CSV
    'market_value',
    'weightings',
    'net_assets',
    'shares_outstand',
    'creation_units'
  ],
  weightings: [
    'ticker',
    'name',
    'spy',
    'qqq',
    'xlk',
    'xlf',
    'xlc',
    'xly',
    'xlp',
    'xle',
    'xlv',
    'xli',
    'xlb',
    'xlre',
    'xlu',
    'igv',
    'ita',
    'soxx',
    'smh',
    'arkk'
  ],
  prices: [
    'ticker',
    'date',
    'open',
    'high',
    'low',
    'close',
    'volume'
  ],
  fundamentals: [
    'ticker',
    'sector',
    'pe_ratio',
    'ev_ebitda',
    'ev_sales',
    'base_upside',
    'opt_upside',
    'return_12m',
    'return_36m',
    'vol_12m',
    'sharpe',
    'max_dd',
    'corr_spy',
    'beta',
    'rev_growth',
    'margin',
    'roe',
    'debt_equity',
    'fcf_yield',
    'div_yield',
    'analyst_rating',
    'price_target_upside',
    'short_interest',
    'inst_ownership'
  ],
  benchmarks: [
    'index',
    'date',
    'price',
    'change_1d',
    'change_5d',
    'change_30d',
    'change_ytd'
  ],
  sector_valuations: [
    'index',
    'pe_avg',
    'pe_med',
    'pe_win',
    'pe_3yr',
    'ps_avg',
    'ps_med',
    'ps_win',
    'ps_3yr',
    'pb_avg',
    'pb_med',
    'pb_win',
    'pb_3yr',
    'div_yield_avg',
    'div_yield_med'
  ],
  cycle_indicators: [
    'cycle_type',
    'phase',
    'alignment_pct',
    'trend',
    'description',
    'updated_date'
  ],
  model_portfolios: [
    'model_name',
    'ticker',
    'target_weight',
    'asset_class',
    'sector'
  ]
} as const
