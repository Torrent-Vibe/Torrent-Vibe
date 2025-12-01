import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { Button } from '~/components/ui/button'
import { getI18n } from '~/i18n'
import {
  useAuthStatusValue,
  useLastAuthErrorValue,
  useSetAuthStatus,
  useSetLastAuthError,
} from '~/modules/connection/atoms/connection'
import { authManager } from '~/modules/connection/auth-manager'
import { SettingsModal } from '~/modules/modals/SettingsModal'

import { Modal } from '../ui/modal'

export const AuthFailureAlert = () => {
  const authStatus = useAuthStatusValue()
  const lastAuthError = useLastAuthErrorValue()
  const setAuthStatus = useSetAuthStatus()
  const setLastAuthError = useSetLastAuthError()
  const navigate = useNavigate()

  if (authStatus !== 'auth_failed') {
    return null
  }

  const handleRetryAuth = async () => {
    const success = await authManager.refreshAuth()
    if (success) {
      toast.success(getI18n().t('messages.authSuccessful'))
    } else {
      toast.error(getI18n().t('messages.authRetryFailed'))
    }
  }

  const handleReconnect = () => {
    if (!ELECTRON) {
      setAuthStatus('unauthenticated')
      setLastAuthError(null)
      navigate('/onboarding')
    } else {
      Modal.present(SettingsModal, { tab: 'servers' })
    }
  }

  return (
    <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-md">
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 shadow-lg dark:border-red-800 dark:bg-red-950">
        <div className="flex items-start gap-3">
          <div className="text-red-600 dark:text-red-400">
            <i className="i-mingcute-close-circle-line text-lg" />
          </div>

          <Button
            className="absolute right-2 top-2 p-1"
            variant="ghost"
            onClick={() => {
              setLastAuthError(null)
              setAuthStatus('unauthenticated')
            }}
          >
            <i className="i-mingcute-close-line text-lg" />
          </Button>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
              Authentication Failed
            </h3>
            <p className="mt-1 text-xs text-red-700 dark:text-red-300">
              {lastAuthError ||
                'Unable to authenticate with qBittorrent server'}
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                className="text-sm"
                variant="destructive"
                onClick={handleRetryAuth}
              >
                <i className="i-mingcute-refresh-2-line mr-1 text-xs" />
                Retry
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleReconnect}
                className="text-sm"
              >
                <i className="i-mingcute-settings-2-line mr-1 text-xs" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
