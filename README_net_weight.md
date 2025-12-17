# Net Weight Calculations Page

This page shows true net exposure after accounting for inverse ETF hedges. Data comes from the latest holdings upload and the weightings table (index weights per stock).

## Column Calculations (per row / per stock)
- **Holding Wt%**: Position weight in the portfolio.
- **SQQQ**: `(Portfolio SQQQ wt × 3) × stock's QQQ weight`.
- **QID**: `(Portfolio QID wt × 2) × stock's QQQ weight`.
- **PSQ**: `(Portfolio PSQ wt × 1) × stock's QQQ weight`.
- **SHORT QQQs**: `SQQQ + QID + PSQ`.
- **Wt in QQQ**: Stock's QQQ index weight (from weightings table).

- **SPXU**: `(Portfolio SPXU wt × 3) × stock's SPY weight`.
- **SDS**: `(Portfolio SDS wt × 2) × stock's SPY weight`.
- **SH**: `(Portfolio SH wt × 1) × stock's SPY weight`.
- **SHORT SPYs**: `SPXU + SDS + SH`.
- **Wt in SPY**: Stock's SPY index weight.

- **SDOW**: `(Portfolio SDOW wt × 3) × stock's DOW weight`.
- **DXD**: `(Portfolio DXD wt × 2) × stock's DOW weight`.
- **DOG**: `(Portfolio DOG wt × 1) × stock's DOW weight`.
- **Short DOW**: `SDOW + DXD + DOG`.
- **Wt in DOW**: Stock's DOW index weight.

- **SOXS**: `(Portfolio SOXS wt × 3) × stock's SOXX weight`.
- **Wt in SOXX**: Stock's SOXX/SMH weight.

- **SARK**: `(Portfolio SARK wt × 1) × stock's ARKK weight`.
- **Wt in SARK**: Stock's ARKK weight.

- **EFFECTIVE SHORT**: `SHORT QQQs + SHORT SPYs + Short DOW + SOXS + SARK` (all per-stock contributions).
- **NET**: `Holding Wt% – EFFECTIVE SHORT`.

## Notes
- If the portfolio holds no SPY or DOW inverse ETFs, those columns will be blank/0.
- SOXS applies semiconductor weight; SARK applies ARKK weight.
- All portfolio inverse positions are multiplied by their leverage (3x/2x/1x) before applying the stock's index weight.



