# FactSet Data V2 - Column Reference Guide

This document maps the numbered column references from the original CSV to the actual column names in the `factset_data_v2` Supabase table.

## Currently Used Columns

These are the columns currently being used in the application:

| # | Column Name | Type | Usage | Location |
|---|------------|------|-------|----------|
| 1 | Ticker | TEXT (Primary Key) | Stock identifier | Holdings, API |
| 58 | Next Earnings Date | TEXT | Upcoming earnings date | Holdings page |
| 59 | Next Earnings Date Time of day | TEXT | Earnings call time (BMO/AMC/Unspecified) | Holdings page |
| 67 | 1 yr Beta | NUMERIC | 1-year beta | Holdings page, Portfolio beta calc |
| 68 | 3 yr beta | NUMERIC | 3-year beta | Holdings page, Portfolio beta calc |
| 69 | 5 yr beta - monthly | NUMERIC | 5-year beta (monthly) | Holdings page, Portfolio beta calc |

## All Available Columns (1-102)

### Earnings & Estimates (Columns 1-13)
1. **Ticker** - Stock symbol (Primary Key)
2. **EPS LTM** - Earnings per share, last twelve months
3. **EPS - most recent FY** - Earnings per share, most recent fiscal year
4. **EPS Est current FY** - EPS estimate for current fiscal year
5. **EPS Est FY+1** - EPS estimate for next fiscal year
6. **EPS Est FY+2** - EPS estimate for fiscal year +2
7. **EPS EST NTM** - EPS estimate next twelve months
8. **EPS EST NTM+1** - EPS estimate NTM+1
9. **EPS EST NTM - 30 days ago** - Historical EPS estimate
10. **EPS EST NTM - 90 days ago** - Historical EPS estimate
11. **EPS EST Current Qtr** - EPS estimate current quarter
12. **EPS Est Next Qtr** - EPS estimate next quarter
13. **EPS surprise last qtr** - Earnings surprise percentage

### Sales Data (Columns 14-25)
14. **Sales LTM** - Sales last twelve months
15. **Sales - most recent FY** - Sales most recent fiscal year
16. **Sales Est current FY** - Sales estimate current FY
17. **Sales Est FY+1** - Sales estimate FY+1
18. **Sales Est FY+2** - Sales estimate FY+2
19. **Sales EST NTM** - Sales estimate next twelve months
20. **Sales EST NTM+1** - Sales estimate NTM+1
21. **SALES EST NTM - 30 days ago** - Historical sales estimate
22. **SALES EST NTM - 90 days ago** - Historical sales estimate
23. **SALES EST Current Qtr** - Sales estimate current quarter
24. **SALES EST Next Qtr** - Sales estimate next quarter
25. **SALES surprise last qtr** - Sales surprise percentage

### EBITDA Data (Columns 26-36)
26. **EBITDA LTM** - EBITDA last twelve months
27. **EBITDA - most recent FY** - EBITDA most recent fiscal year
28. **EBITDA Est current FY** - EBITDA estimate current FY
29. **EBITDA Est FY+1** - EBITDA estimate FY+1
30. **EBITDA Est FY+2** - EBITDA estimate FY+2
31. **EBITDA EST NTM** - EBITDA estimate next twelve months
32. **EBITDA EST NTM+1** - EBITDA estimate NTM+1
33. **EBITDA EST NTM - 30 days ago** - Historical EBITDA estimate
34. **EBITDA EST NTM - 90 days ago** - Historical EBITDA estimate
35. **EBITDA EST Current Qtr** - EBITDA estimate current quarter
36. **EBITDA EST Next Qtr** - EBITDA estimate next quarter

### Market Data (Columns 37-46)
37. **PRICE** - Current stock price
38. **SO** - Shares outstanding
39. **MKT CAP** - Market capitalization
40. **EV** - Enterprise value
41. **ND** - Net debt
42. **Gross Profit LTM** - Gross profit last twelve months
43. **EBIT LTM** - EBIT last twelve months
44. **Stock Option Expense - LTM** - Stock option expense
45. **Stock price - LTM High** - 52-week high
46. **Stock price - LTM LOW** - 52-week low

### Performance Metrics (Columns 47-57)
47. **ROIC 1 YR** - Return on invested capital, 1 year
48. **ROIC 3YR** - Return on invested capital, 3 year
49. **14 day RSI** - 14-day relative strength index
50. **SI % of float** - Short interest as % of float
51. **SI Days to Cover** - Short interest days to cover
52. **Insider % ownership** - Insider ownership percentage
53. **Insider Purchases** - Recent insider purchases
54. **Insider Sales** - Recent insider sales
55. **Accruals abs** - Absolute accruals
56. **acrcrurals %** - Accruals percentage
57. **FCF** - Free cash flow
58. **Consensus Price Target** - Analyst consensus target price

### Company Information (Columns 59-65)
59. **Next Earnings Date** - ⭐ USED - Upcoming earnings date
60. **Next Earnings Date Time of day** - ⭐ USED - Earnings time (BMO/AMC/Unspecified)
61. **LAST Reported FYE** - Last reported fiscal year end
62. **FYE** - Fiscal year end
63. **LAST Reported FQ** - Last reported fiscal quarter
64. **Total assets** - Total assets
65. **1 month volatility** - 1-month volatility
66. **2 month vol** - 2-month volatility

### Risk Metrics (Columns 67-71)
67. **3 month vol** - 3-month volatility
68. **1 yr Beta** - ⭐ USED - 1-year beta
69. **3 yr beta** - ⭐ USED - 3-year beta
70. **5 yr beta - monthly** - ⭐ USED - 5-year beta (monthly)
71. **5 yr beta - weekly** - 5-year beta (weekly)

### Valuation Multiples - NTM (Columns 72-85)
72. **EV/EBITDA - NTM** - EV to EBITDA, next twelve months
73. **EV/Sales - NTM** - EV to Sales, next twelve months
74. **P/E NTM** - Price to earnings, next twelve months
75. **3-YR AVG NTM EV/EBITDA** - 3-year average EV/EBITDA
76. **3-YR AVG NTM EV/SALES** - 3-year average EV/Sales
77. **3-YR AVG NTM P/E** - 3-year average P/E
78. **3-YR MEDIAN NTM EV/EBITDA** - 3-year median EV/EBITDA
79. **3-YR MEDIAN NTM EV/SALES** - 3-year median EV/Sales
80. **3-YR MEDIAN NTM P/E** - 3-year median P/E
81. **3-YR MIN NTM EV/EBITDA** - 3-year minimum EV/EBITDA
82. **3-YR MIN NTM EV/SALES** - 3-year minimum EV/Sales
83. **3-YR MIN NTM P/E** - 3-year minimum P/E
84. **3-YR MAX NTM EV/EBITDA** - 3-year maximum EV/EBITDA
85. **3-YR MAX NTM EV/SALES** - 3-year maximum EV/Sales

### Historical Valuation Metrics (Columns 86-99)
86. **3-YR MAX NTM P/E** - 3-year maximum P/E
87. **52 week high** - 52-week high price
88. **26-YR AVG NTM EV/EBITDA** - 26-year average EV/EBITDA
89. **26-YR AVG NTM EV/SALES** - 26-year average EV/Sales
90. **26-YR AVG NTM P/E** - 26-year average P/E
91. **26-YR MEDIAN NTM EV/EBITDA** - 26-year median EV/EBITDA
92. **26-YR MEDIAN NTM EV/SALES** - 26-year median EV/Sales
93. **26-YR MEDIAN NTM P/E** - 26-year median P/E
94. **26-YR MIN NTM EV/EBITDA** - 26-year minimum EV/EBITDA
95. **26-YR MIN NTM EV/SALES** - 26-year minimum EV/Sales
96. **26-YR MIN NTM P/E** - 26-year minimum P/E
97. **26-YR MAX NTM EV/EBITDA** - 26-year maximum EV/EBITDA
98. **26-YR MAX NTM EV/SALES** - 26-year maximum EV/Sales
99. **26-YR MAX NTM P/E** - 26-year maximum P/E

*Note: Columns 100-102 appear to be empty/reserved in the current dataset*

## API Integration

### Current API Route
- **File**: `app/api/factset/route.ts`
- **Table**: `factset_data_v2`
- **Selected Columns**: Ticker, 1 yr Beta, 3 yr beta, 5 yr beta - monthly, Next Earnings Date, Next Earnings Date Time of day

### Holdings Page Integration
- **File**: `app/holdings/page.tsx`
- **Usage**: Portfolio beta calculations, earnings dates display, risk metrics

## Adding New Columns

To add new columns to the application:

1. Update `app/api/factset/route.ts` - Add column to the `.select()` query
2. Update `app/holdings/page.tsx` - Add to the `factsetMap` mapping
3. Update the interface if needed (around line 28)
4. Use the column name from this reference guide

## Notes

- All columns are stored as TEXT in Supabase, parse to numbers when needed
- Column names with special characters (spaces, dashes) must be quoted in SQL queries
- Beta columns use different time periods - choose appropriate one for your analysis
- Earnings time values: "BMO" (Before Market Open), "AMC" (After Market Close), "Unspecified"

---
Last Updated: December 16, 2025


