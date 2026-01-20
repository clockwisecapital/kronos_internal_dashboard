// Weightings API - Fetches QQQ and SPY weights from weightings_universe
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/app/utils/supabase/service-role'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    console.log('Fetching weightings_universe...')
    const supabase = createServiceRoleClient()

    const { data, error } = await supabase
      .from('weightings_universe')
      .select('"Ticker", "Name", "SPY", "QQQ", "SOXX", "SMH", "ARKK"')
      .limit(5000)

    if (error) {
      console.error('Error fetching weightings:', error)
      throw error
    }

    console.log(`Weightings API: Loaded ${data?.length || 0} records from weightings_universe`)

    // Normalize column names to lowercase for consistency
    const normalizedData = (data || []).map((item: any) => ({
      ticker: item.Ticker,
      name: item.Name,
      spy: item.SPY && item.SPY !== '-' ? parseFloat(item.SPY) : null,
      qqq: item.QQQ && item.QQQ !== '-' ? parseFloat(item.QQQ) : null,
      dow: null,  // DOW/DIA column not available in weightings_universe
      soxx: item.SOXX && item.SOXX !== '-' ? parseFloat(item.SOXX) : null,
      smh: item.SMH && item.SMH !== '-' ? parseFloat(item.SMH) : null,
      arkk: item.ARKK && item.ARKK !== '-' ? parseFloat(item.ARKK) : null
    }))

    return NextResponse.json({
      success: true,
      data: normalizedData,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Weightings API error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch weightings',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

