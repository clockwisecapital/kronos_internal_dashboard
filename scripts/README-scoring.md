# Scoring System Implementation

This document provides instructions for setting up and using the portfolio scoring system.

## Setup Instructions

### 1. Create Database Table

Run the SQL script to create the `score_weightings` table and seed it with the three scoring profiles:

```bash
# Connect to your Supabase database and run:
psql -h <your-supabase-host> -U postgres -d postgres -f scripts/create-score-weightings.sql
```

Or execute the SQL directly in the Supabase SQL Editor:
- Open Supabase Dashboard
- Go to SQL Editor
- Copy and paste the contents of `scripts/create-score-weightings.sql`
- Run the script

### 2. Verify Data

After running the script, verify the data was inserted correctly:

```sql
SELECT profile_name, category, COUNT(*) as metric_count
FROM public.score_weightings
WHERE metric_name IS NOT NULL
GROUP BY profile_name, category
ORDER BY profile_name, category;
```

Expected output:
- BASE: VALUE (4), MOMENTUM (7), QUALITY (6), RISK (4)
- CAUTIOUS: VALUE (4), MOMENTUM (7), QUALITY (6), RISK (4)
- AGGRESSIVE: VALUE (4), MOMENTUM (7), QUALITY (6), RISK (4)

### 3. Test the API

Test the scoring API endpoint:

```bash
# Test BASE profile
curl http://localhost:3000/api/scoring?profile=BASE

# Test CAUTIOUS profile
curl http://localhost:3000/api/scoring?profile=CAUTIOUS

# Test AGGRESSIVE profile
curl http://localhost:3000/api/scoring?profile=AGGRESSIVE
```

### 4. Access the Scoring Page

Navigate to `/scoring` in your application to view the scoring dashboard.

## Scoring Methodology

### Calculation Process

1. **Data Aggregation**: Fetches holdings, FactSet data, and historical prices from Yahoo Finance
2. **Metric Extraction**: Calculates individual metrics from raw data
3. **Percentile Ranking**: Ranks each metric within the holdings universe (0-100 scale)
4. **Composite Scores**: Calculates weighted averages for each category (VALUE, MOMENTUM, QUALITY, RISK)
5. **Total Score**: Combines composite scores using profile-specific category weights

### Scoring Profiles

#### BASE Profile
- VALUE: 40%
- MOMENTUM: 30%
- QUALITY: 15%
- RISK: 15%

Balanced approach suitable for general portfolio analysis.

#### CAUTIOUS Profile
- VALUE: 40%
- MOMENTUM: 10%
- QUALITY: 25%
- RISK: 25%

Emphasizes quality and risk management over momentum.

#### AGGRESSIVE Profile
- VALUE: 40%
- MOMENTUM: 50%
- QUALITY: 5%
- RISK: 5%

Heavily weighted toward momentum for growth-oriented strategies.

### Metric Categories

#### VALUE (4 metrics)
- **P/E Ratio** (20%): Price-to-Earnings NTM - lower is better
- **EV/EBITDA** (20%): Enterprise Value to EBITDA - lower is better
- **EV/Sales** (20%): Enterprise Value to Sales - lower is better
- **Target Price Upside** (40%): Consensus target / current price - higher is better

#### MOMENTUM (7 metrics)
- **12M Return ex 1M** (30%): Return from 365 days ago to 30 days ago
- **3M Return** (10%): Return over last 90 days
- **52-Week High %** (10%): Current price as % of 52-week high
- **EPS Surprise** (10%): Last quarter earnings surprise
- **Rev Surprise** (10%): Last quarter revenue surprise
- **NTM EPS Change** (15%): Change in NTM EPS estimates over 30 days
- **NTM Rev Change** (15%): Change in NTM revenue estimates over 30 days

#### QUALITY (6 metrics)
- **ROIC TTM** (25%): Return on Invested Capital, trailing twelve months
- **Gross Profitability** (25%): Gross Profit / Total Assets
- **Accruals** (20%): Accruals as % of assets - lower is better
- **FCF** (10%): Free Cash Flow / Total Assets
- **ROIC 3-Yr** (10%): 3-year average ROIC
- **EBITDA Margin** (10%): EBITDA / Sales

#### RISK (3 metrics)
- **Beta 3-Yr** (25%): 3-year beta - lower is better
- **30-Day Volatility** (30%): 1-month volatility - lower is better
- **Max Drawdown** (20%): Worst peak-to-trough decline over 252 trading days - lower is better
- **Financial Leverage** (25%): Currently skipped due to missing data

## Data Sources

### FactSet Data (factset_data_v2 table)
All fundamental metrics, valuation ratios, and analyst estimates come from FactSet.

### Yahoo Finance API
- Current and historical prices
- Return calculations
- Maximum drawdown calculations

### Weightings Table
Benchmark weights for QQQ and SPY comparison.

## Performance Considerations

- **API Duration**: The scoring API can take 2-5 minutes to complete due to:
  - Fetching historical prices for all holdings from Yahoo Finance
  - Calculating max drawdown for 252 trading days per stock
  - Processing 20+ metrics per holding
  
- **Optimization**: The API uses parallel processing where possible (Promise.all) to minimize wait time

- **Caching**: Consider implementing caching for:
  - Historical prices (update daily)
  - FactSet data (update on refresh)
  - Calculated scores (update on demand)

## Troubleshooting

### Missing Data
- Individual metrics with missing data show "N/A"
- Composite scores exclude missing metrics and re-weight remaining ones
- If all metrics in a category are missing, the composite shows "N/A"

### Yahoo Finance API Failures
- The system retries failed requests with exponential backoff
- If historical data is unavailable, momentum metrics will show "N/A"
- Check console logs for specific ticker failures

### FactSet Column Mismatches
- Verify column names match exactly (case-sensitive, including spaces)
- Check `FACTSET_COLUMN_REFERENCE.md` for correct column names
- Column 58 "Consensus Price Target" was added - ensure your FactSet data includes it

## Future Enhancements

1. **Financial Leverage**: Add when debt/equity data becomes available
2. **Caching Layer**: Implement Redis or similar for faster subsequent loads
3. **Export Functionality**: Add CSV/Excel export of scores
4. **Historical Tracking**: Store scores over time to track changes
5. **Alerts**: Notify when stocks cross score thresholds
6. **Sector Comparison**: Add sector-relative scoring option

## Files Created/Modified

### New Files
- `lib/calculators/scoring.ts` - Core scoring calculation logic
- `app/api/scoring/route.ts` - API endpoint for scoring
- `components/scoring/ScoreCell.tsx` - Score display component
- `components/scoring/CompositeScoreCard.tsx` - Expandable composite score display
- `scripts/create-score-weightings.sql` - Database setup script
- `scripts/README-scoring.md` - This file

### Modified Files
- `app/scoring/page.tsx` - Complete scoring dashboard UI
- `lib/services/yahooFinance.ts` - Added max drawdown and historical price functions
- `FACTSET_COLUMN_REFERENCE.md` - Added Column 58 (Consensus Price Target)

## Support

For issues or questions:
1. Check console logs for detailed error messages
2. Verify database table was created correctly
3. Ensure FactSet data is up to date
4. Test API endpoint directly before debugging UI


