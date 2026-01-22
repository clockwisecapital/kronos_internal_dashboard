# Scoring Discrepancy Fix: Portfolio vs Universe Views

## Problem
AAPL (and other stocks) showed completely different scores when viewed in:
- Portfolio scoring view (`/api/scoring`)
- Universe scoring view (`/api/scoring/universe`)

## Root Causes

### 1. **Universe Used Dummy Yahoo Data for Percentile Calculations**
**Location:** `app/api/scoring/universe/route.ts` line 205-207

**Before:**
```typescript
const dummyYahoo = { 
  currentPrice: 0, 
  price30DaysAgo: null, 
  price90DaysAgo: null, 
  price365DaysAgo: null, 
  maxDrawdown: null 
}
const universeMetrics = (universeData || []).map(ticker => 
  extractIndividualMetrics(ticker as FactSetData, dummyYahoo)
)
```

**Impact:** Universe-wide percentile calculations had **NO REAL PRICE DATA**, causing wildly inaccurate momentum and risk scores.

**After:**
```typescript
const universeYahooMap = await fetchHistoricalPricesWithCache(
  universeTickers,
  15,  // batch size
  400  // delay in ms
)

const universeMetrics = (universeData || []).map(ticker => {
  const yahoo = universeYahooMap.get(ticker.Ticker.toUpperCase()) || {...}
  return extractIndividualMetrics(ticker as FactSetData, yahoo)
})
```

---

### 2. **Universe Didn't Use Caching (Different Data Timing)**
**Location:** `app/api/scoring/universe/route.ts` line 364

**Before:**
```typescript
const historicalPricesMap = await fetchHistoricalPricesInBatches(
  Array.from(allTickersForYahoo),
  10,  // batch size
  500  // delay in ms
)
```

**After:**
```typescript
const historicalPricesMap = await fetchHistoricalPricesWithCache(
  Array.from(allTickersForYahoo),
  15,  // batch size
  400  // delay in ms
)
```

**Impact:** Portfolio used 24hr cached data, Universe fetched fresh data every time, causing timing differences.

---

### 3. **Universe Fetched Unnecessary Tickers (5000+ vs Optimized)**
**Location:** `app/api/scoring/universe/route.ts` lines 345-358

**Before:**
```typescript
// Add all tickers from weightings_universe (for constituent-based scoring)
const { data: allWeightingsTickers } = await supabase
  .from('weightings_universe')
  .select('"Ticker"')
  .limit(5000)

if (allWeightingsTickers) {
  allWeightingsTickers.forEach((row: any) => {
    if (row.Ticker) {
      allTickersForYahoo.add(row.Ticker)
    }
  })
}
```

**After:**
```typescript
// Only fetch what we need: page tickers + benchmarks + constituents
const uniqueGicsBenchmarks = new Set<string>()
// ... validate and collect benchmarks ...

for (const benchmarkTicker of uniqueGicsBenchmarks) {
  const constituentTickers = await fetchBenchmarkConstituents(supabase, benchmarkTicker)
  constituentTickers.forEach(ticker => {
    const validated = validateAndNormalizeTicker(ticker)
    if (validated) allTickersForYahoo.add(validated)
  })
}
```

**Impact:** Fetched ~5000 unnecessary tickers, slowing down API and potentially including irrelevant data.

---

### 4. **Missing Ticker Validation in Universe Route**
Universe route didn't filter out invalid tickers like `-`, `#`, `CASH`, etc.

**After:** Added same `validateAndNormalizeTicker()` function used in portfolio route.

---

## Expected Result

✅ **Identical scores** for the same stock in both views
✅ **Same data sources** (cached Yahoo Finance with 24hr TTL)
✅ **Same calculation methods** (real price data for percentiles)
✅ **Faster universe loading** (optimized ticker fetching)

## Testing

1. Load portfolio scoring view and note AAPL score
2. Load universe scoring view and verify AAPL has identical score
3. Repeat for 5-10 different stocks to confirm consistency

## Files Changed

- `app/api/scoring/universe/route.ts` - Synced with portfolio route optimizations
