import { AnimatePresence, m } from 'motion/react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { clsxm } from '~/lib/cn'
import { Spring } from '~/lib/spring'

import { RootPortal } from '../portal/RootPortal'

type UpdateCardState =
  | { kind: 'available'; version: string }
  | { kind: 'preparing' }
  | { kind: 'downloading'; version: string; percent: number }
  | { kind: 'ready'; version: string }
  | { kind: 'error'; message: string }

interface FloatingUpdatePillProps {
  onDismiss: () => void
  onInstall: () => void
  onShowReleaseNotes: () => void
  state: UpdateCardState | null
}

const actionClassName =
  'h-7 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50'

const SecondaryAction = ({
  children,
  onClick,
}: {
  children: ReactNode
  onClick: () => void
}) => (
  <button
    type="button"
    className={clsxm(
      actionClassName,
      'border border-border text-text hover:bg-fill-secondary',
    )}
    onClick={onClick}
  >
    {children}
  </button>
)

const PrimaryAction = ({
  children,
  onClick,
}: {
  children: ReactNode
  onClick: () => void
}) => (
  <button
    type="button"
    className={clsxm(
      actionClassName,
      'bg-accent font-semibold text-background hover:bg-accent/90',
    )}
    onClick={onClick}
  >
    {children}
  </button>
)

const CardHeader = ({
  icon,
  tone = 'accent',
  title,
  description,
  onDismiss,
}: {
  icon: string
  tone?: 'accent' | 'error'
  title: string
  description?: string
  onDismiss?: () => void
}) => {
  const { t } = useTranslation()
  return (
    <div className="flex items-start gap-2.5">
      <div
        className={clsxm(
          'flex size-7 shrink-0 items-center justify-center rounded-lg',
          tone === 'accent'
            ? 'bg-accent/15 text-accent'
            : 'bg-orange/15 text-orange',
        )}
      >
        <i className={clsxm(icon, 'text-base')} />
      </div>
      <div className="flex min-w-0 grow flex-col gap-0.5">
        <div className="truncate text-[13px] font-semibold text-text">
          {title}
        </div>
        {description && (
          <div
            className="line-clamp-2 text-xs text-text-secondary"
            title={description}
          >
            {description}
          </div>
        )}
      </div>
      {onDismiss && (
        <button
          aria-label={t('updateCard.dismiss')}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-fill-secondary hover:text-text"
          type="button"
          onClick={onDismiss}
        >
          <i className="i-mingcute-close-line text-sm" />
        </button>
      )}
    </div>
  )
}

const CardContent = ({
  state,
  onDismiss,
  onInstall,
  onShowReleaseNotes,
}: FloatingUpdatePillProps & { state: UpdateCardState }) => {
  const { t } = useTranslation()

  switch (state.kind) {
    case 'available': {
      return (
        <>
          <CardHeader
            description={t('updateCard.available.description')}
            icon="i-mingcute-arrow-up-line"
            title={t('updateCard.available.title', { version: state.version })}
            onDismiss={onDismiss}
          />
          <div className="flex justify-end gap-2">
            <SecondaryAction onClick={onShowReleaseNotes}>
              {t('updateCard.whatsNew')}
            </SecondaryAction>
            <PrimaryAction onClick={onInstall}>
              {t('updateCard.available.action')}
            </PrimaryAction>
          </div>
        </>
      )
    }
    case 'preparing': {
      return (
        <CardHeader
          description={t('updateCard.preparing.description')}
          icon="i-mingcute-loading-3-line animate-spin"
          title={t('updateCard.preparing.title')}
        />
      )
    }
    case 'downloading': {
      return (
        <>
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <i className="i-mingcute-download-2-line text-base" />
            </div>
            <div className="min-w-0 grow truncate text-[13px] font-semibold text-text">
              {t('updateCard.downloading.title', { version: state.version })}
            </div>
            <div className="text-xs tabular-nums text-text-secondary">
              {state.percent}%
            </div>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-fill">
            <m.div
              animate={{ width: `${state.percent}%` }}
              className="h-full rounded-full bg-accent"
              initial={false}
              transition={Spring.smooth(0.3)}
            />
          </div>
        </>
      )
    }
    case 'ready': {
      return (
        <>
          <CardHeader
            description={t('updateCard.ready.description')}
            icon="i-mingcute-check-line"
            title={t('updateCard.ready.title', { version: state.version })}
            onDismiss={onDismiss}
          />
          <div className="flex justify-end gap-2">
            <SecondaryAction onClick={onShowReleaseNotes}>
              {t('updateCard.whatsNew')}
            </SecondaryAction>
            <PrimaryAction onClick={onInstall}>
              {t('updateCard.ready.action')}
            </PrimaryAction>
          </div>
        </>
      )
    }
    case 'error': {
      return (
        <>
          <CardHeader
            description={state.message}
            icon="i-mingcute-alert-circle-line"
            title={t('updateCard.error.title')}
            tone="error"
            onDismiss={onDismiss}
          />
          <div className="flex justify-end gap-2">
            <SecondaryAction onClick={onInstall}>
              {t('updateCard.error.retry')}
            </SecondaryAction>
          </div>
        </>
      )
    }
  }
}

export const FloatingUpdatePill = (props: FloatingUpdatePillProps) => {
  const { state } = props

  return (
    <RootPortal>
      <AnimatePresence>
        {state && (
          <m.div
            animate={{ opacity: 1, x: 0, scale: 1 }}
            className="pointer-events-auto fixed bottom-5 left-5 z-50 flex w-80 flex-col gap-3 rounded-xl border border-border bg-material-medium p-3.5 shadow-lg backdrop-blur"
            exit={{ opacity: 0, x: -100, scale: 0.9 }}
            initial={{ opacity: 0, x: -100, scale: 0.9 }}
            transition={Spring.presets.snappy}
          >
            <CardContent {...props} state={state} />
          </m.div>
        )}
      </AnimatePresence>
    </RootPortal>
  )
}

export type { FloatingUpdatePillProps, UpdateCardState }
