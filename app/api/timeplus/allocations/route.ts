/**
 * TIME+ Allocations API
 * Returns allocation weights for all model portfolios
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/app/utils/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface AllocationRecord {
  ticker: string
  asset_class: string
  sector: string
  max_growth: number
  growth: number
  moderate: number
  max_income: number
}

export async function GET(request: Request) {
  try {
    console.log('=== TIME+ Allocations API: Starting ===')
    const supabase = await createClient()

    const { searchParams } = new URL(request.url)
    const modelFilter = searchParams.get('model')

    // Fetch all allocations
    let query = supabase
      .from('time_plus_allocations')
      .select('*')
      .order('weight_pct', { ascending: false })

    if (modelFilter) {
      query = query.eq('model_name', modelFilter)
    }

    const { data: allocations, error } = await query

    if (error) {
      throw new Error(`Failed to fetch allocations: ${error.message}`)
    }

    if (!allocations || allocations.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No allocations found. Please upload model_portfolios.csv'
      }, { status: 404 })
    }

    console.log(`Found ${allocations.length} allocation records`)

    // If filtering by model, return simple list
    if (modelFilter) {
      return NextResponse.json({
        success: true,
        data: allocations.map(a => ({
          ticker: a.ticker,
          weight: a.weight_pct,
          asset_class: a.asset_class,
          sector: a.sector
        }))
      })
    }

    // Otherwise, pivot data to create allocation table
    // Group by ticker
    const tickerMap = new Map<string, AllocationRecord>()

    for (const allocation of allocations) {
      if (!tickerMap.has(allocation.ticker)) {
        tickerMap.set(allocation.ticker, {
          ticker: allocation.ticker,
          asset_class: allocation.asset_class || '',
          sector: allocation.sector || '',
          max_growth: 0,
          growth: 0,
          moderate: 0,
          max_income: 0
        })
      }

      const record = tickerMap.get(allocation.ticker)!
      
      // Map model name to column
      switch (allocation.model_name) {
        case 'Max Growth':
          record.max_growth = allocation.weight_pct
          break
        case 'Growth':
          record.growth = allocation.weight_pct
          break
        case 'Moderate':
          record.moderate = allocation.weight_pct
          break
        case 'Max Income':
          record.max_income = allocation.weight_pct
          break
      }
    }

    // Convert to array and sort by max allocation
    const allocationTable = Array.from(tickerMap.values()).sort((a, b) => {
      const maxA = Math.max(a.max_growth, a.growth, a.moderate, a.max_income)
      const maxB = Math.max(b.max_growth, b.growth, b.moderate, b.max_income)
      return maxB - maxA
    })

    console.log(`Created allocation table with ${allocationTable.length} tickers`)
    console.log('=== TIME+ Allocations API: Complete ===')

    return NextResponse.json({
      success: true,
      data: allocationTable
    })

  } catch (error) {
    console.error('TIME+ Allocations API Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch allocations'
      },
      { status: 500 }
    )
  }
}
