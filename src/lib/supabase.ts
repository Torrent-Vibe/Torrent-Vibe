import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY

if (!supabaseUrl) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL')
}

if (!supabaseKey) {
  throw new Error('Missing environment variable: SUPABASE_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: number
          created_at: string
          email: string
        }
        Insert: {
          id?: number
          created_at?: string
          email: string
        }
        Update: {
          id?: number
          created_at?: string
          email?: string
        }
      }
    }
  }
}
