import {
  useAuthStatusValue,
  useConnectionStatusValue,
  useIsAuthenticating,
} from '~/modules/connection/atoms/connection'

export const AuthStatusIndicator = () => {
  const authStatus = useAuthStatusValue()
  const connectionStatus = useConnectionStatusValue()
  const isAuthenticating = useIsAuthenticating()

  // Don't show anything if we're connected and authenticated
  if (authStatus === 'authenticated' && connectionStatus === 'connected') {
    return null
  }

  // Show loading state when authenticating
  if (isAuthenticating) {
    return (
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <i className="i-mingcute-loading-3-line animate-spin" />
        <span>Authenticating...</span>
      </div>
    )
  }

  // Show connection status
  switch (connectionStatus) {
    case 'connecting': {
      return (
        <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
          <i className="i-mingcute-loading-3-line animate-spin" />
          <span>Connecting...</span>
        </div>
      )
    }

    case 'disconnected': {
      return (
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <i className="i-mingcute-close-circle-line" />
          <span>Disconnected</span>
        </div>
      )
    }

    case 'error': {
      return (
        <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
          <i className="i-mingcute-close-circle-line" />
          <span>Connection Error</span>
        </div>
      )
    }

    default: {
      return null
    }
  }
}
