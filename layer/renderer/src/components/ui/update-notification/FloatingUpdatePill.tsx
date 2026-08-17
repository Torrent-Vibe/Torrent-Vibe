import { AnimatePresence, m } from 'motion/react'
import { useCallback } from 'react'

import { clsxm } from '~/lib/cn'
import { Spring } from '~/lib/spring'

import { Button } from '../button/Button'
import { RootPortal } from '../portal/RootPortal'

interface UpdateState {
  errorMessage?: string
  hasError?: boolean
  version?: string
}

interface FloatingUpdatePillProps {
  onDismiss?: () => void

  onInstall?: () => void
  onLater?: () => void
  onRetry?: () => void
  updateState: UpdateState | null
}

const ReadyState = ({
  version,
  onInstall,
  onLater,
}: {
  version?: string
  onInstall?: () => void
  onLater?: () => void
}) => (
  <div className="flex items-center gap-3">
    <i className="i-mingcute-check-circle-line text-green" />
    <span className="text-sm text-text">{`Update ${version} ready`}</span>
    <div className="flex items-center gap-2">
      <Button
        className="h-5 px-2 text-xs bg-text hover:bg-text/90"
        size="sm"
        variant="primary"
        onClick={onInstall}
      >
        Install Now
      </Button>
      <Button
        className="h-6 px-2 text-xs"
        size="sm"
        variant="ghost"
        onClick={onLater}
      >
        Later
      </Button>
    </div>
  </div>
)

const ErrorState = ({
  errorMessage,
  onRetry,
  onDismiss,
}: {
  errorMessage?: string
  onRetry?: () => void
  onDismiss?: () => void
}) => (
  <div className="flex items-center gap-3">
    <i className="i-mingcute-alert-circle-line text-red" />
    <span className="text-sm text-text">
      {`Update failed: ${errorMessage}`}
    </span>
    <div className="flex items-center gap-2">
      <Button
        className="h-6 px-3 text-xs"
        size="sm"
        variant="primary"
        onClick={onRetry}
      >
        Retry
      </Button>
      <button
        className="size-8 inline-flex items-center justify-center"
        type="button"
        onClick={onDismiss}
      >
        <i className="i-mingcute-close-line text-text-secondary" />
      </button>
    </div>
  </div>
)

export const FloatingUpdatePill = ({
  updateState,

  onInstall,
  onLater,
  onRetry,
  onDismiss,
}: FloatingUpdatePillProps) => {
  const handleDismiss = useCallback(() => {
    onDismiss?.()
  }, [onDismiss])

  const renderContent = () => {
    if (!updateState) {
      return null
    }

    if (updateState.hasError) {
      return (
        <ErrorState
          errorMessage={updateState.errorMessage}
          onDismiss={handleDismiss}
          onRetry={onRetry}
        />
      )
    }

    if (updateState.version) {
      return (
        <ReadyState
          version={updateState.version}
          onInstall={onInstall}
          onLater={onLater}
        />
      )
    }

    return null
  }

  const content = renderContent()

  return (
    <RootPortal>
      <AnimatePresence>
        {content && (
          <m.div
            animate={{ opacity: 1, x: 0, scale: 1 }}
            className="pointer-events-none fixed bottom-5 left-5 z-50 bg-material-medium backdrop-blur"
            exit={{ opacity: 0, x: -100, scale: 0.9 }}
            initial={{ opacity: 0, x: -100, scale: 0.9 }}
            transition={Spring.presets.snappy}
          >
            <m.div
              transition={Spring.smooth(0.3)}
              className={clsxm(
                // Base pill styling
                'pointer-events-auto relative overflow-hidden rounded-lg border border-border shadow-lg',

                // Padding and sizing
                'pl-4 pr-2 py-1',
              )}
            >
              {content}
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </RootPortal>
  )
}

export type { FloatingUpdatePillProps, UpdateState }
