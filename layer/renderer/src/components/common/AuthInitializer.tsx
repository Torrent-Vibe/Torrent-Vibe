import { useEffect } from 'react'

import { authManager } from '~/modules/connection/auth-manager'

export const AuthInitializer = () => {
  useEffect(() => {
    // Initialize authentication on app start
    authManager.initialize().catch((error) => {
      console.error('Failed to initialize authentication:', error)
    })

    // Cleanup on unmount
    return () => {
      authManager.destroy()
    }
  }, [])

  return null
}
