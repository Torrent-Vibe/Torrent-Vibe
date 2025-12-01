import { useTranslation } from 'react-i18next'
import { Drawer } from 'vaul'

import { Button } from '~/components/ui/button'
import { ScrollArea } from '~/components/ui/scroll-areas/ScrollArea'
import { cn } from '~/lib/cn'

import { DiscoverModalActions } from '../actions'
import { useDiscoverModalStore } from '../store'
import { DiscoverPreviewContent } from './DiscoverPreviewContent'

export const DiscoverPreviewSheet = () => {
  const { t } = useTranslation('app')
  const actions = DiscoverModalActions.shared
  const { preview } = actions.slices
  const previewId = useDiscoverModalStore((state) => state.previewId)
  const previewDetail = useDiscoverModalStore((state) => state.previewDetail)
  const items = useDiscoverModalStore((state) => state.items)

  const previewTitle = t('discover.modal.previewTitle')
  const previewSubtitle =
    previewDetail?.title ?? items.find((item) => item.id === previewId)?.title

  const open = Boolean(previewId)

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          preview.closePreview()
        }
      }}
      modal
      shouldScaleBackground
    >
      <Drawer.Portal>
        <Drawer.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/40 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          )}
        />
        <Drawer.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex justify-center',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-0',
            'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-0',
          )}
        >
          <div className="w-full max-w-xl rounded-t-2xl border border-border bg-background shadow-xl">
            <div className="flex justify-center py-2.5">
              <Drawer.Handle className="h-1.5 w-10 rounded-full bg-border" />
            </div>
            <div className="border-t border-border">
              <header className="flex items-center justify-between px-4 py-2.5">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-semibold text-text">
                    {previewTitle}
                  </h3>
                  {previewSubtitle ? (
                    <p className="text-xs text-text-tertiary">
                      {previewSubtitle}
                    </p>
                  ) : null}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8"
                  onClick={() => preview.closePreview()}
                  aria-label={t('discover.modal.close')}
                >
                  <i className="i-mingcute-close-line" />
                </Button>
              </header>
              <ScrollArea
                rootClassName="max-h-[70vh]"
                viewportClassName="px-4 pb-4"
              >
                <DiscoverPreviewContent />
              </ScrollArea>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
