// FactSet Data API Route - Updated for factset_data_v2
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/app/utils/supabase/service-role'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    console.log('Fetching factset_data_v2...')
    const supabase = createServiceRoleClient()

    // Fetch from new factset_data_v2 table with updated column names
    const { data, error } = await supabase
      .from('factset_data_v2')
      .select('"Ticker", "1 yr Beta", "3 yr beta", "5 yr beta - monthly", "Next Earnings Date", "Next Earnings Date Time of day"')

    if (error) {
      console.error('FactSet API error:', error)
      throw error
    }

    console.log(`FactSet API: Loaded ${data?.length || 0} records from factset_data_v2`)

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








