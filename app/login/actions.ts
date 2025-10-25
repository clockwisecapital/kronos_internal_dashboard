'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/app/utils/supabase/server'

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Validation function
function validateAuthInput(email: unknown, password: unknown): { email: string; password: string } | { error: string } {
  // Check if values exist
  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  // Convert to strings
  const emailStr = String(email).trim()
  const passwordStr = String(password)

  // Validate email format
  if (!emailRegex.test(emailStr)) {
    return { error: 'Please enter a valid email address' }
  }

  // Validate password length
  if (passwordStr.length < 6) {
    return { error: 'Password must be at least 6 characters long' }
  }

  return { email: emailStr, password: passwordStr }
}

export async function login(formData: FormData) {
  const supabase = await createClient()

  // Validate inputs
  const validation = validateAuthInput(
    formData.get('email'),
    formData.get('password')
  )

  if ('error' in validation) {
    redirect(`/error?message=${encodeURIComponent(validation.error)}`)
  }

  const { error } = await supabase.auth.signInWithPassword(validation)

  if (error) {
    redirect(`/error?message=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/account')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  // Validate inputs
  const validation = validateAuthInput(
    formData.get('email'),
    formData.get('password')
  )

  if ('error' in validation) {
    redirect(`/error?message=${encodeURIComponent(validation.error)}`)
  }

  const { error } = await supabase.auth.signUp(validation)

  if (error) {
    redirect(`/error?message=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/account')
}