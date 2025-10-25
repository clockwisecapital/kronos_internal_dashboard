/**
 * Admin script to create internal users
 * Run with: npx tsx scripts/create-users.ts
 * 
 * Make sure to install tsx: npm install -D tsx
 */

import { createClient } from '@supabase/supabase-js'

// Initialize Supabase Admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role key, not anon key
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// List of users to create
const usersToCreate = [
  {
    email: 'admin@yourcompany.com',
    password: 'ChangeMe123!',
    email_confirm: true
  },
  {
    email: 'employee1@yourcompany.com',
    password: 'ChangeMe123!',
    email_confirm: true
  },
  // Add more users as needed
]

async function createUsers() {
  console.log('🚀 Starting user creation...\n')

  for (const userData of usersToCreate) {
    try {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: userData.email_confirm,
      })

      if (error) {
        console.error(`❌ Failed to create ${userData.email}:`, error.message)
      } else {
        console.log(`✅ Created user: ${userData.email}`)
      }
    } catch (err) {
      console.error(`❌ Error creating ${userData.email}:`, err)
    }
  }

  console.log('\n✨ User creation complete!')
}

createUsers()
