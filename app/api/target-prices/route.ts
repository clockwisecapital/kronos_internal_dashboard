// Target Prices API Route
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/app/utils/supabase/service-role'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    console.log('Fetching target prices...')
    const supabase = createServiceRoleClient()

    // Fetch all target prices (bypasses RLS with service role key)
    const { data, error } = await supabase
      .from('tgt_prices')
      .select('*')

    if (error) {
      console.error('Target Prices API error:', error)
      throw error
    }

    console.log(`Target Prices API: Loaded ${data?.length || 0} records`)

    return NextResponse.json({
      success: true,
      data: data || [],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Target Prices API error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch target prices',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}








