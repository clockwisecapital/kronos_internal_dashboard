// FactSet Data API Route
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/app/utils/supabase/service-role'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    console.log('Fetching factset_data...')
    const supabase = createServiceRoleClient()

    // Fetch all factset data (bypasses RLS with service role key)
    const { data, error } = await supabase
      .from('factset_data')
      .select('"Ticker", "BETA 1Y", "BETA 3Y", "5 yr beta", "Next Earnings Date"')

    if (error) {
      console.error('FactSet API error:', error)
      throw error
    }

    console.log(`FactSet API: Loaded ${data?.length || 0} records`)

    return NextResponse.json({
      success: true,
      data: data || [],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('FactSet API error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch factset data',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}





