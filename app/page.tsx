import { createClient } from '@/app/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  // Check authentication status and redirect accordingly
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    redirect('/account')
  } else {
    redirect('/login')
  }
}
