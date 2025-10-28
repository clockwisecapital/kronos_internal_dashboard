/**
 * Universe API Route
 * Handles CRUD operations for the universe table
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/utils/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface UniverseStock {
  id: string
  ticker: string
  name: string
  clockwise_val: string | null
  pulls_into_val: string | null
  gics: string | null
  clockwise_sector: string | null
  risk_score: string | null
  path: string | null
  optionality: string | null
  core_noncore: string | null
  beta_3yr: number | null
  beta_1yr: number | null
  true_beta_adj: number | null
  true_beta: number | null
  base_methodology: string | null
  base_ticker_3yr_multiple: number | null
  base_ticker_ntm_multiple: number | null
  base_sector_3yr_multiple: number | null
  base_sector_ntm_multiple: number | null
  base_clockwise_rel_multiple: number | null
  base_metric: string | null
  base_target_price: number | null
  base_upside_pct: number | null
  upside_methodology: string | null
  upside_ticker_3yr_multiple: number | null
  upside_ticker_ntm_multiple: number | null
  upside_sector_3yr_multiple: number | null
  upside_sector_ntm_multiple: number | null
  upside_clockwise_rel_multiple: number | null
  upside_metric: string | null
  upside_target_price: number | null
  upside_upside_pct: number | null
}

// GET - Fetch all holdings with universe data
export async function GET() {
  try {
    console.log('=== Universe API: Fetching holdings + universe data ===')
    const supabase = await createClient()

    // Fetch all holdings
    const { data: holdings, error: holdingsError } = await supabase
      .from('holdings')
      .select('stock_ticker, security_name')
      .order('stock_ticker', { ascending: true })

    if (holdingsError) {
      throw new Error(`Failed to fetch holdings: ${holdingsError.message}`)
    }

    if (!holdings || holdings.length === 0) {
      console.log('No holdings found')
      return NextResponse.json({
        success: true,
        data: []
      })
    }

    // Deduplicate by ticker
    const uniqueHoldings = Array.from(
      new Map(holdings.map(h => [h.stock_ticker, h])).values()
    )

    console.log(`Found ${uniqueHoldings.length} unique holdings`)

    // Fetch universe data for these tickers
    const { data: universeData, error: universeError } = await supabase
      .from('universe')
      .select('*')
      .in('ticker', uniqueHoldings.map(h => h.stock_ticker))

    if (universeError) {
      console.warn('Error fetching universe data:', universeError)
    }

    // Create a map of universe data by ticker
    const universeMap = new Map(
      (universeData || []).map(u => [u.ticker, u])
    )

    // Merge holdings with universe data
    const mergedData = uniqueHoldings.map(holding => {
      const universeEntry = universeMap.get(holding.stock_ticker)
      
      return {
        id: universeEntry?.id || null,
        ticker: holding.stock_ticker,
        name: holding.security_name || holding.stock_ticker,
        clockwise_val: universeEntry?.clockwise_val || null,
        pulls_into_val: universeEntry?.pulls_into_val || null,
        gics: universeEntry?.gics || null,
        clockwise_sector: universeEntry?.clockwise_sector || null,
        risk_score: universeEntry?.risk_score || null,
        path: universeEntry?.path || null,
        optionality: universeEntry?.optionality || null,
        core_noncore: universeEntry?.core_noncore || null,
        beta_3yr: universeEntry?.beta_3yr || null,
        beta_1yr: universeEntry?.beta_1yr || null,
        true_beta_adj: universeEntry?.true_beta_adj || null,
        true_beta: universeEntry?.true_beta || null,
        base_methodology: universeEntry?.base_methodology || null,
        base_ticker_3yr_multiple: universeEntry?.base_ticker_3yr_multiple || null,
        base_ticker_ntm_multiple: universeEntry?.base_ticker_ntm_multiple || null,
        base_sector_3yr_multiple: universeEntry?.base_sector_3yr_multiple || null,
        base_sector_ntm_multiple: universeEntry?.base_sector_ntm_multiple || null,
        base_clockwise_rel_multiple: universeEntry?.base_clockwise_rel_multiple || null,
        base_metric: universeEntry?.base_metric || null,
        base_target_price: universeEntry?.base_target_price || null,
        base_upside_pct: universeEntry?.base_upside_pct || null,
        upside_methodology: universeEntry?.upside_methodology || null,
        upside_ticker_3yr_multiple: universeEntry?.upside_ticker_3yr_multiple || null,
        upside_ticker_ntm_multiple: universeEntry?.upside_ticker_ntm_multiple || null,
        upside_sector_3yr_multiple: universeEntry?.upside_sector_3yr_multiple || null,
        upside_sector_ntm_multiple: universeEntry?.upside_sector_ntm_multiple || null,
        upside_clockwise_rel_multiple: universeEntry?.upside_clockwise_rel_multiple || null,
        upside_metric: universeEntry?.upside_metric || null,
        upside_target_price: universeEntry?.upside_target_price || null,
        upside_upside_pct: universeEntry?.upside_upside_pct || null
      }
    })

    console.log(`Returning ${mergedData.length} stocks with universe data`)

    return NextResponse.json({
      success: true,
      data: mergedData
    })

  } catch (error) {
    console.error('Universe API GET error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch universe data'
      },
      { status: 500 }
    )
  }
}

// PUT - Update a specific stock field (or create if doesn't exist)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { ticker, field, value, name } = body

    if (!ticker || !field) {
      return NextResponse.json(
        { success: false, message: 'Missing ticker or field' },
        { status: 400 }
      )
    }

    console.log(`=== Universe API: Updating ${ticker}.${field} = ${value} ===`)
    const supabase = await createClient()

    // Check if universe entry exists
    const { data: existing } = await supabase
      .from('universe')
      .select('id')
      .eq('ticker', ticker)
      .single()

    if (existing) {
      // Update existing entry
      const updateData: Record<string, any> = {
        [field]: value
      }

      const { data, error } = await supabase
        .from('universe')
        .update(updateData)
        .eq('ticker', ticker)
        .select()
        .single()

      if (error) {
        throw new Error(`Failed to update ${ticker}: ${error.message}`)
      }

      console.log(`Updated ${ticker}.${field} successfully`)

      return NextResponse.json({
        success: true,
        data
      })
    } else {
      // Create new entry with this field set
      const newEntry: Record<string, any> = {
        ticker,
        name: name || ticker,
        [field]: value
      }

      const { data, error } = await supabase
        .from('universe')
        .insert(newEntry)
        .select()
        .single()

      if (error) {
        throw new Error(`Failed to create ${ticker}: ${error.message}`)
      }

      console.log(`Created ${ticker} with ${field} = ${value}`)

      return NextResponse.json({
        success: true,
        data
      })
    }

  } catch (error) {
    console.error('Universe API PUT error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update universe data'
      },
      { status: 500 }
    )
  }
}

// POST - Add new stock to universe
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('=== Universe API: Adding new stock ===')
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('universe')
      .insert(body)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to add stock: ${error.message}`)
    }

    console.log(`Added ${body.ticker} successfully`)

    return NextResponse.json({
      success: true,
      data
    })

  } catch (error) {
    console.error('Universe API POST error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to add stock'
      },
      { status: 500 }
    )
  }
}
