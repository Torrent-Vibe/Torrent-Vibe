import type { HTMLMotionProps } from 'motion/react'
import { AnimatePresence, m } from 'motion/react'
import type { FC } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import { ScrollArea } from '~/components/ui/scroll-areas/ScrollArea'
import { Spring } from '~/lib/spring'

import { DiscoverModalActions } from '../actions'
import { useDiscoverModalStore } from '../store'
import { DiscoverPreviewContent } from './DiscoverPreviewContent'

export const DiscoverPreviewPanel: FC<HTMLMotionProps<'aside'>> = (props) => {
  const { t } = useTranslation('app')
  const actions = DiscoverModalActions.shared
  const { preview } = actions.slices
  const previewId = useDiscoverModalStore((state) => state.previewId)
  const previewDetail = useDiscoverModalStore((state) => state.previewDetail)
  const items = useDiscoverModalStore((state) => state.items)

  const previewTitle = t('discover.modal.previewTitle')
  const previewSubtitle =
    previewDetail?.title ?? items.find((item) => item.id === previewId)?.title

  return (
    <AnimatePresence mode="popLayout">
      {previewId && (
        <m.aside
          key="discover-preview"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={Spring.presets.smooth}
          className="flex w-[300px] flex-col grow h-0 @container bg-background border-l border-border"
          {...props}
        >
          <div className="flex items-center justify-between border-b border-border px-3.5 h-14">
            <div className="space-y-0.5">
              <h3 className="text-sm font-semibold text-text">
                {previewTitle}
              </h3>
              {previewSubtitle ? (
                <p className="text-xs text-text-tertiary line-clamp-2">
                  {previewSubtitle}
                </p>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="size-7"
              onClick={() => preview.closePreview()}
              aria-label={t('discover.modal.close')}
            >
              <i className="i-mingcute-close-line shrink-0" />
            </Button>
          </div>
          <ScrollArea flex rootClassName="flex-1 h-0">
            <ErrorBoundary fallback={<div>Something went wrong.</div>}>
              <DiscoverPreviewContent className="p-3.5" />
            </ErrorBoundary>
          </ScrollArea>
        </m.aside>
      )}
    </AnimatePresence>
  )
}
