import { AnimatePresence, m } from 'motion/react'
import { useCallback } from 'react'

import { clsxm } from '~/lib/cn'
import { Spring } from '~/lib/spring'

import { Button } from '../button/Button'
import { RootPortal } from '../portal/RootPortal'

interface UpdateState {
  downloadProgress?: number
  version?: string
  isDownloading: boolean
  hasError?: boolean
  errorMessage?: string
  downloadUrl?: string
}

interface FloatingUpdatePillProps {
  updateState: UpdateState | null

  onInstall?: () => void
  onLater?: () => void
  onRetry?: () => void
  onDismiss?: () => void
  onOpenUrl?: (url: string) => void
}

const formatProgress = (progress?: number) => {
  if (progress === undefined) return ''
  return `${Math.round(progress)}%`
}

const ProgressBar = ({ progress }: { progress?: number }) => {
  const progressValue = progress ?? 0

  return (
    <div className="relative h-1 w-16 overflow-hidden rounded-full bg-fill">
      <m.div
        className="h-full bg-text"
        initial={{ width: 0 }}
        animate={{ width: `${progressValue}%` }}
        transition={Spring.smooth(0.6)}
      />
    </div>
  )
}

const DownloadingState = ({
  version,
  progress,

  onDismiss,
}: {
  version?: string
  progress?: number

  onDismiss?: () => void
}) => (
  <div className="flex items-center gap-3">
    <i className="i-mingcute-download-line text-accent" />
    <span className="text-sm text-text">Updating to {version}</span>
    <ProgressBar progress={progress} />
    <span className="text-xs text-text-secondary">
      {formatProgress(progress)}
    </span>

    <button
      type="button"
      onClick={onDismiss}
      className="size-8 inline-flex items-center justify-center"
    >
      <i className="i-mingcute-close-line text-text-secondary" />
    </button>
  </div>
)

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
    <span className="text-sm text-text">Update {version} ready</span>
    <div className="flex items-center gap-2">
      <Button
        variant="primary"
        size="sm"
        onClick={onInstall}
        className="h-5 px-2 text-xs bg-text hover:bg-text/90"
      >
        Install Now
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onLater}
        className="h-6 px-2 text-xs"
      >
        Later
      </Button>
    </div>
  </div>
)

const ErrorState = ({
  errorMessage,
  downloadUrl,
  onRetry,
  onDismiss,
  onOpenUrl,
}: {
  errorMessage?: string
  downloadUrl?: string
  onRetry?: () => void
  onDismiss?: () => void
  onOpenUrl?: (url: string) => void
}) => (
  <div className="flex items-center gap-3">
    <i className="i-mingcute-alert-circle-line text-red" />
    <span className="text-sm text-text">Update failed: {errorMessage}</span>
    <div className="flex items-center gap-2">
      {downloadUrl && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpenUrl?.(downloadUrl)}
          className="h-6 px-3 text-xs"
        >
          Download latest
        </Button>
      )}
      <Button
        variant="primary"
        size="sm"
        onClick={onRetry}
        className="h-6 px-3 text-xs"
      >
        Retry
      </Button>
      <button
        type="button"
        onClick={onDismiss}
        className="size-8 inline-flex items-center justify-center"
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
  onOpenUrl,
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
          downloadUrl={updateState.downloadUrl}
          onRetry={onRetry}
          onDismiss={handleDismiss}
          onOpenUrl={onOpenUrl}
        />
      )
    }

    if (updateState.isDownloading) {
      return (
        <DownloadingState
          version={updateState.version}
          progress={updateState.downloadProgress}
          onDismiss={handleDismiss}
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
            className={
              'pointer-events-none fixed bottom-5 left-5 z-50 bg-material-medium backdrop-blur'
            }
            initial={{ opacity: 0, x: -100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -100, scale: 0.9 }}
            transition={Spring.presets.snappy}
          >
            <m.div
              className={clsxm(
                // Base pill styling
                'pointer-events-auto relative overflow-hidden rounded-lg border border-border shadow-lg',

                // Padding and sizing
                'pl-4 pr-2 py-1',
              )}
              transition={Spring.smooth(0.3)}
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
