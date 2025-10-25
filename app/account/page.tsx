import { createClient } from '@/app/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function Account() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    // Redirect to login if user is not authenticated
    if (!user) {
        redirect('/login')
    }

    // If user is authenticated, redirect to portfolio (main dashboard)
    redirect('/portfolio')
}