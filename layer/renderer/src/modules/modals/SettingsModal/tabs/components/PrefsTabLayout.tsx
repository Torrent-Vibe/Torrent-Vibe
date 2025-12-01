import { AnimatePresence, m } from 'motion/react'
import type { PropsWithChildren } from 'react'
import { useMemo } from 'react'
import { toast } from 'sonner'

import { useQBittorrentPrefsManager } from '~/atoms/settings/qbittorrent-prefs'
import { Button } from '~/components/ui/button'
import { getI18n } from '~/i18n'
import { Spring } from '~/lib/spring'

type PrefsTabLayoutProps = PropsWithChildren<{
  saveSuccessI18nKey?: string
  saveErrorI18nKey?: string
  saveLabel?: string
}>

export const PrefsTabLayout = ({
  children,
  saveSuccessI18nKey,
  saveErrorI18nKey,
  saveLabel,
}: PrefsTabLayoutProps) => {
  const { dirty, save, isLoading, isSaving, reset } =
    useQBittorrentPrefsManager()
  const hasDirty = useMemo(() => Object.keys(dirty || {}).length > 0, [dirty])

  return (
    <div className="mt-2 space-y-6">
      {children}
      <div className="sticky bottom-0 h-14 z-10">
        <AnimatePresence>
          {hasDirty && (
            // Panel
            <m.div
              className="inline-flex items-center h-14 px-3 rounded-full backdrop-blur-background bg-background/50 absolute right-0 bottom-0"
              initial={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              exit={{ opacity: 0, translateY: 10 }}
              transition={Spring.presets.smooth}
            >
              <div className="flex items-center gap-2">
                {/* Reset button */}
                <Button
                  size="sm"
                  variant="secondary"
                  isLoading={isSaving}
                  disabled={isLoading}
                  onClick={reset}
                >
                  <i className="i-mingcute-refresh-line" />
                  Reset
                </Button>

                <Button
                  size="sm"
                  variant="primary"
                  isLoading={isSaving}
                  disabled={isLoading}
                  onClick={async () => {
                    try {
                      await save()
                      if (saveSuccessI18nKey) {
                        toast.success(getI18n().t(saveSuccessI18nKey as any))
                      }
                    } catch (err) {
                      console.error(err)
                      if (saveErrorI18nKey) {
                        toast.error(getI18n().t(saveErrorI18nKey as any))
                      }
                    }
                  }}
                >
                  {saveLabel ?? 'Save'}
                </Button>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
