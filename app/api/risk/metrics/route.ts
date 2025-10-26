/**
 * Risk Metrics API
 * Returns portfolio risk metrics calculated from historical snapshots
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/app/utils/supabase/server'
import { calculateRiskMetrics, type RiskMetrics } from '@/lib/calculators/risk'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RiskMetricsResponse {
  success: boolean
  data?: RiskMetrics
  message?: string
  timestamp: string
}

export async function GET() {
  try {
    console.log('=== Risk Metrics API: Starting ===')
    const supabase = await createClient()

    // Fetch last 90 days of snapshots (enough for robust calculations)
    const { data: snapshots, error: snapshotsError } = await supabase
      .from('portfolio_snapshot')
      .select('snapshot_date, nav')
      .order('snapshot_date', { ascending: false })
      .limit(90)

    if (snapshotsError) {
      throw new Error(`Failed to fetch snapshots: ${snapshotsError.message}`)
    }

    if (!snapshots || snapshots.length === 0) {
      return NextResponse.json<RiskMetricsResponse>({
        success: true,
        data: {
          sharpeRatio: null,
          annualizedVolatility: null,
          var95: null,
          maxDrawdown: null,
          daysOfData: 0,
          requiresDays: 30
        },
        message: 'No snapshot data available yet. Start collecting data by running daily snapshots.',
        timestamp: new Date().toISOString()
      })
    }

    console.log(`Found ${snapshots.length} days of snapshot data`)

    // Calculate risk metrics
    const metrics = calculateRiskMetrics(snapshots, 30)

    console.log('Risk Metrics:', {
      sharpeRatio: metrics.sharpeRatio?.toFixed(2) || 'N/A',
      volatility: metrics.annualizedVolatility?.toFixed(2) || 'N/A',
      var95: metrics.var95?.toFixed(2) || 'N/A',
      maxDrawdown: metrics.maxDrawdown?.toFixed(2) || 'N/A',
      daysOfData: metrics.daysOfData
    })

    console.log('=== Risk Metrics API: Complete ===')

    return NextResponse.json<RiskMetricsResponse>({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Risk Metrics API Error:', error)
    return NextResponse.json<RiskMetricsResponse>(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to calculate risk metrics',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
