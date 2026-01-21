# Scoring Diagnostics API

## Overview

The Scoring Diagnostics API provides detailed data quality analysis for the scoring system, helping identify issues that could cause inaccurate VALUE, MOMENTUM, QUALITY, or RISK scores.

## Endpoint

```
GET /api/scoring/diagnostics
```

## Query Parameters

- `profile` (optional): Scoring profile - `BASE`, `CAUTIOUS`, or `AGGRESSIVE` (default: `BASE`)
- `benchmark` (optional): Benchmark column - `BENCHMARK1`, `BENCHMARK2`, `BENCHMARK3`, or `BENCHMARK_CUSTOM` (default: `BENCHMARK1`)

## Example Usage

### Via Browser
```
http://localhost:3000/api/scoring/diagnostics?profile=BASE&benchmark=BENCHMARK1
```

### Via UI
Navigate to:
```
http://localhost:3000/scoring/diagnostics
```

### Via cURL
```bash
curl "http://localhost:3000/api/scoring/diagnostics?profile=BASE&benchmark=BENCHMARK1"
```

## Response Structure

```typescript
{
  success: boolean
  timestamp: string
  profile: string
  benchmark: string
  
  // High-level summary
  summary: {
    totalHoldings: number
    holdingsWithFactSet: number
    holdingsWithYahoo: number
    holdingsWithBenchmark: number
    holdingsWithCompleteData: number
  }
  
  // Missing data breakdown
  missingData: {
    noFactSet: string[]              // Tickers with no FactSet data
    noYahoo: string[]                // Tickers with no Yahoo historical data
    noBenchmark: string[]            // Tickers with no benchmark assignment
    nullValueScores: Array<{
      ticker: string
      reason: string
      missingMetrics: string[]       // e.g., ["P/E NTM", "EV/EBITDA"]
    }>
  }
  
  // Benchmark quality analysis
  benchmarkAnalysis: Array<{
    benchmark: string                // e.g., "QQQ", "SPY"
    constituentCount: number         // Number of constituents in weightings_universe
    holdingsCount: number            // Number of your holdings using this benchmark
    tickers: string[]                // Your holdings assigned to this benchmark
    status: 'OK' | 'WARNING' | 'ERROR'
    message: string                  // Human-readable status message
  }>
  
  // Weightings configuration
  weightingsAnalysis: {
    totalWeightings: number
    profileExists: boolean
    categories: Array<{
      category: string               // "VALUE", "MOMENTUM", "QUALITY", "RISK"
      categoryWeight: number
      metrics: Array<{
        name: string                 // e.g., "P/E", "ROIC TTM"
        weight: number
      }>
    }>
  }
  
  // Prioritized list of issues
  dataQualityIssues: Array<{
    ticker: string                   // Affected ticker or "ALL"
    severity: 'ERROR' | 'WARNING' | 'INFO'
    category: string                 // e.g., "Missing Data", "Benchmark Issue"
    issue: string                    // Description of the issue
    impact: string                   // What this means for scoring
  }>
}
```

## Common Issues Detected

### ERROR Severity
- **No FactSet data**: Cannot calculate any scores
- **Benchmark not in weightings_universe**: Will fall back to universe-wide ranking
- **No weightings for profile**: Cannot calculate composite/total scores
- **Category has no metric weights**: Composite score will be null

### WARNING Severity
- **No benchmark assignment**: Will use universe-wide percentile ranking
- **Missing VALUE metrics**: VALUE score calculated with reduced metrics
- **Benchmark has <10 constituents**: Falls back to universe-wide ranking
- **Category weight is 0**: Category won't contribute to total score

### INFO Severity
- **Data freshness warnings**
- **Non-critical configuration notes**

## Interpreting Results

### Summary Metrics

- **Total Holdings**: Number of stocks in your portfolio
- **With FactSet**: Holdings that have FactSet data (required for scoring)
- **With Yahoo**: Holdings with historical price data (required for momentum/risk)
- **With Benchmark**: Holdings assigned to a benchmark in `gics_yahoo_finance`
- **Complete Data**: Holdings with all required data for accurate scoring

### Benchmark Status

- **OK**: Benchmark has ≥10 constituents, scoring will be accurate
- **WARNING**: Benchmark has <10 constituents, will use universe-wide ranking
- **ERROR**: Benchmark not found in `weightings_universe`, will use universe-wide ranking

## Troubleshooting

### Issue: "No FactSet data found"
**Solution**: Upload/update FactSet data in `factset_data_v2` table

### Issue: "No benchmark assignment"
**Solution**: Add ticker to `gics_yahoo_finance` table with appropriate benchmark

### Issue: "Benchmark has no constituents"
**Solution**: Add benchmark constituents to `weightings_universe` table

### Issue: "No weightings found for profile"
**Solution**: Add weightings to `score_weightings` table for the profile

### Issue: "Missing VALUE metrics"
**Solution**: Check FactSet data for null/invalid values in P/E, EV/EBITDA, EV/Sales, or Target Price columns

## Performance

- **Runtime**: ~10-30 seconds depending on portfolio size
- **Timeout**: 5 minutes (300 seconds)
- **Sample Size**: Yahoo data checked for first 5 tickers only (for speed)

## Notes

- This endpoint is read-only and safe to run anytime
- It does NOT modify any data
- It does NOT trigger actual score calculations
- Results are not cached - each request runs fresh diagnostics
