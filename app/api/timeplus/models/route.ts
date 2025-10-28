/**
 * TIME+ Model Portfolios API
 * Returns the 4 pre-built model portfolio characteristics
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/app/utils/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface TimePlusModel {
  id: string
  model_name: string
  risk_level: string
  description: string
  expected_return_low: number
  expected_return_high: number
  time_horizon_years: number
  beta: number
  display_order: number
  top_holdings?: Array<{
    ticker: string
    weight: number
  }>
}

export async function GET() {
  try {
    console.log('=== TIME+ Models API: Starting ===')
    const supabase = await createClient()

    // Fetch model characteristics
    const { data: models, error: modelsError } = await supabase
      .from('time_plus_models')
      .select('*')
      .order('display_order', { ascending: true })

    if (modelsError) {
      throw new Error(`Failed to fetch models: ${modelsError.message}`)
    }

    if (!models || models.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No TIME+ models found. Please run migrations.'
      }, { status: 404 })
    }

    console.log(`Found ${models.length} TIME+ models`)

    // Fetch top 3 holdings for each model
    const modelsWithHoldings: TimePlusModel[] = await Promise.all(
      models.map(async (model) => {
        const { data: allocations } = await supabase
          .from('time_plus_allocations')
          .select('ticker, weight_pct')
          .eq('model_name', model.model_name)
          .order('weight_pct', { ascending: false })
          .limit(3)

        return {
          ...model,
          top_holdings: allocations?.map(a => ({
            ticker: a.ticker,
            weight: a.weight_pct
          })) || []
        }
      })
    )

    console.log('=== TIME+ Models API: Complete ===')

    return NextResponse.json({
      success: true,
      data: modelsWithHoldings
    })

  } catch (error) {
    console.error('TIME+ Models API Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch TIME+ models'
      },
      { status: 500 }
    )
  }
}
