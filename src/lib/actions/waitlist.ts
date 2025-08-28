'use server'

import { supabase } from '~/lib/supabase'

export interface WaitlistResult {
  success: boolean
  message: string
  error?: string
}

export async function addToWaitlist(email: string): Promise<WaitlistResult> {
  try {
    if (!email || !email.includes('@')) {
      return {
        success: false,
        message: 'Please enter a valid email address',
      }
    }

    // Check if email already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing user:', checkError)
      return {
        success: false,
        message: 'Something went wrong. Please try again.',
        error: checkError.message,
      }
    }

    if (existingUser) {
      return {
        success: false,
        message: 'This email is already on the waitlist',
      }
    }

    // Insert new user
    const { error: insertError } = await supabase
      .from('users')
      .insert([{ email }])

    if (insertError) {
      console.error('Error inserting user:', insertError)
      return {
        success: false,
        message: 'Failed to add email to waitlist. Please try again.',
        error: insertError.message,
      }
    }

    return {
      success: true,
      message: 'Successfully added to waitlist!',
    }
  } catch (error) {
    console.error('Unexpected error:', error)
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
