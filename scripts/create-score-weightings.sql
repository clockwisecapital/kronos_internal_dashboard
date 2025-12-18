-- Create score_weightings table for storing scoring profile configurations
CREATE TABLE IF NOT EXISTS public.score_weightings (
  id SERIAL PRIMARY KEY,
  profile_name TEXT NOT NULL, -- BASE, CAUTIOUS, AGGRESSIVE
  category TEXT NOT NULL, -- VALUE, MOMENTUM, QUALITY, RISK
  metric_name TEXT NULL, -- Individual metric name (NULL for category weight rows)
  metric_weight NUMERIC NULL, -- Weight of metric within its category (0-1)
  category_weight NUMERIC NULL, -- Weight of category in total score (0-1)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_profile_category_metric UNIQUE (profile_name, category, metric_name)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_score_weightings_profile ON public.score_weightings(profile_name);

-- Seed BASE profile
-- VALUE category (weight: 0.4)
INSERT INTO public.score_weightings (profile_name, category, metric_name, metric_weight, category_weight) VALUES
('BASE', 'VALUE', NULL, NULL, 0.4),
('BASE', 'VALUE', 'P/E', 0.20, NULL),
('BASE', 'VALUE', 'EV/EBITDA', 0.20, NULL),
('BASE', 'VALUE', 'EV/Sales', 0.20, NULL),
('BASE', 'VALUE', 'TGT PRICE', 0.40, NULL);

-- MOMENTUM category (weight: 0.3)
INSERT INTO public.score_weightings (profile_name, category, metric_name, metric_weight, category_weight) VALUES
('BASE', 'MOMENTUM', NULL, NULL, 0.3),
('BASE', 'MOMENTUM', '12M Return ex 1M', 0.3, NULL),
('BASE', 'MOMENTUM', '3M Return', 0.1, NULL),
('BASE', 'MOMENTUM', '52-Week High %', 0.1, NULL),
('BASE', 'MOMENTUM', 'EPS Surprise', 0.1, NULL),
('BASE', 'MOMENTUM', 'Rev Surprise', 0.1, NULL),
('BASE', 'MOMENTUM', 'NTM EPS Change', 0.15, NULL),
('BASE', 'MOMENTUM', 'NTM Rev Change', 0.15, NULL);

-- QUALITY category (weight: 0.15)
INSERT INTO public.score_weightings (profile_name, category, metric_name, metric_weight, category_weight) VALUES
('BASE', 'QUALITY', NULL, NULL, 0.15),
('BASE', 'QUALITY', 'ROIC TTM', 0.25, NULL),
('BASE', 'QUALITY', 'Gross Profitability', 0.25, NULL),
('BASE', 'QUALITY', 'Accruals', 0.2, NULL),
('BASE', 'QUALITY', 'FCF', 0.1, NULL),
('BASE', 'QUALITY', 'ROIC 3-Yr', 0.1, NULL),
('BASE', 'QUALITY', 'EBITDA Margin', 0.1, NULL);

-- RISK category (weight: 0.15)
INSERT INTO public.score_weightings (profile_name, category, metric_name, metric_weight, category_weight) VALUES
('BASE', 'RISK', NULL, NULL, 0.15),
('BASE', 'RISK', 'Beta 3-Yr', 0.25, NULL),
('BASE', 'RISK', '30-Day Volatility', 0.3, NULL),
('BASE', 'RISK', 'Max Drawdown', 0.2, NULL),
('BASE', 'RISK', 'Financial Leverage', 0.25, NULL);

-- Seed CAUTIOUS profile
-- VALUE category (weight: 0.4)
INSERT INTO public.score_weightings (profile_name, category, metric_name, metric_weight, category_weight) VALUES
('CAUTIOUS', 'VALUE', NULL, NULL, 0.4),
('CAUTIOUS', 'VALUE', 'P/E', 0.20, NULL),
('CAUTIOUS', 'VALUE', 'EV/EBITDA', 0.20, NULL),
('CAUTIOUS', 'VALUE', 'EV/Sales', 0.20, NULL),
('CAUTIOUS', 'VALUE', 'TGT PRICE', 0.40, NULL);

-- MOMENTUM category (weight: 0.1)
INSERT INTO public.score_weightings (profile_name, category, metric_name, metric_weight, category_weight) VALUES
('CAUTIOUS', 'MOMENTUM', NULL, NULL, 0.1),
('CAUTIOUS', 'MOMENTUM', '12M Return ex 1M', 0.3, NULL),
('CAUTIOUS', 'MOMENTUM', '3M Return', 0.1, NULL),
('CAUTIOUS', 'MOMENTUM', '52-Week High %', 0.1, NULL),
('CAUTIOUS', 'MOMENTUM', 'EPS Surprise', 0.1, NULL),
('CAUTIOUS', 'MOMENTUM', 'Rev Surprise', 0.1, NULL),
('CAUTIOUS', 'MOMENTUM', 'NTM EPS Change', 0.15, NULL),
('CAUTIOUS', 'MOMENTUM', 'NTM Rev Change', 0.15, NULL);

-- QUALITY category (weight: 0.25)
INSERT INTO public.score_weightings (profile_name, category, metric_name, metric_weight, category_weight) VALUES
('CAUTIOUS', 'QUALITY', NULL, NULL, 0.25),
('CAUTIOUS', 'QUALITY', 'ROIC TTM', 0.25, NULL),
('CAUTIOUS', 'QUALITY', 'Gross Profitability', 0.25, NULL),
('CAUTIOUS', 'QUALITY', 'Accruals', 0.2, NULL),
('CAUTIOUS', 'QUALITY', 'FCF', 0.1, NULL),
('CAUTIOUS', 'QUALITY', 'ROIC 3-Yr', 0.1, NULL),
('CAUTIOUS', 'QUALITY', 'EBITDA Margin', 0.1, NULL);

-- RISK category (weight: 0.25)
INSERT INTO public.score_weightings (profile_name, category, metric_name, metric_weight, category_weight) VALUES
('CAUTIOUS', 'RISK', NULL, NULL, 0.25),
('CAUTIOUS', 'RISK', 'Beta 3-Yr', 0.25, NULL),
('CAUTIOUS', 'RISK', '30-Day Volatility', 0.3, NULL),
('CAUTIOUS', 'RISK', 'Max Drawdown', 0.2, NULL),
('CAUTIOUS', 'RISK', 'Financial Leverage', 0.25, NULL);

-- Seed AGGRESSIVE profile
-- VALUE category (weight: 0.4)
INSERT INTO public.score_weightings (profile_name, category, metric_name, metric_weight, category_weight) VALUES
('AGGRESSIVE', 'VALUE', NULL, NULL, 0.4),
('AGGRESSIVE', 'VALUE', 'P/E', 0.20, NULL),
('AGGRESSIVE', 'VALUE', 'EV/EBITDA', 0.20, NULL),
('AGGRESSIVE', 'VALUE', 'EV/Sales', 0.20, NULL),
('AGGRESSIVE', 'VALUE', 'TGT PRICE', 0.40, NULL);

-- MOMENTUM category (weight: 0.5)
INSERT INTO public.score_weightings (profile_name, category, metric_name, metric_weight, category_weight) VALUES
('AGGRESSIVE', 'MOMENTUM', NULL, NULL, 0.5),
('AGGRESSIVE', 'MOMENTUM', '12M Return ex 1M', 0.3, NULL),
('AGGRESSIVE', 'MOMENTUM', '3M Return', 0.1, NULL),
('AGGRESSIVE', 'MOMENTUM', '52-Week High %', 0.1, NULL),
('AGGRESSIVE', 'MOMENTUM', 'EPS Surprise', 0.1, NULL),
('AGGRESSIVE', 'MOMENTUM', 'Rev Surprise', 0.1, NULL),
('AGGRESSIVE', 'MOMENTUM', 'NTM EPS Change', 0.15, NULL),
('AGGRESSIVE', 'MOMENTUM', 'NTM Rev Change', 0.15, NULL);

-- QUALITY category (weight: 0.05)
INSERT INTO public.score_weightings (profile_name, category, metric_name, metric_weight, category_weight) VALUES
('AGGRESSIVE', 'QUALITY', NULL, NULL, 0.05),
('AGGRESSIVE', 'QUALITY', 'ROIC TTM', 0.25, NULL),
('AGGRESSIVE', 'QUALITY', 'Gross Profitability', 0.25, NULL),
('AGGRESSIVE', 'QUALITY', 'Accruals', 0.2, NULL),
('AGGRESSIVE', 'QUALITY', 'FCF', 0.1, NULL),
('AGGRESSIVE', 'QUALITY', 'ROIC 3-Yr', 0.1, NULL),
('AGGRESSIVE', 'QUALITY', 'EBITDA Margin', 0.1, NULL);

-- RISK category (weight: 0.05)
INSERT INTO public.score_weightings (profile_name, category, metric_name, metric_weight, category_weight) VALUES
('AGGRESSIVE', 'RISK', NULL, NULL, 0.05),
('AGGRESSIVE', 'RISK', 'Beta 3-Yr', 0.25, NULL),
('AGGRESSIVE', 'RISK', '30-Day Volatility', 0.3, NULL),
('AGGRESSIVE', 'RISK', 'Max Drawdown', 0.2, NULL),
('AGGRESSIVE', 'RISK', 'Financial Leverage', 0.25, NULL);

-- Verify the data
SELECT profile_name, category, COUNT(*) as metric_count
FROM public.score_weightings
WHERE metric_name IS NOT NULL
GROUP BY profile_name, category
ORDER BY profile_name, category;

