import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '~/components/ui/input/Input'
import { cn } from '~/lib/cn'
import {
  torrentDataStoreSetters,
  useTorrentDataStore,
} from '~/modules/torrent/stores/torrent-data-store'

export const MobileSearchInput: React.FC = () => {
  const { t } = useTranslation()
  const searchQuery = useTorrentDataStore((s) => s.searchQuery ?? '')

  const [value, setValue] = React.useState(searchQuery)
  const [isPending, startTransition] = React.useTransition()
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Auto-focus when component mounts (when search is expanded)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 150) // Small delay for smooth animation

    return () => clearTimeout(timer)
  }, [])

  // Debounce commit to store
  React.useEffect(() => {
    const id = setTimeout(() => {
      startTransition(() => {
        torrentDataStoreSetters.setSearchQuery(value)
      })
    }, 200)
    return () => clearTimeout(id)
  }, [value])

  // Keep in sync when external store changes
  React.useEffect(() => {
    setValue(searchQuery)
  }, [searchQuery])

  const clearSearch = React.useCallback(() => {
    setValue('')
    inputRef.current?.focus()
  }, [])

  return (
    <div className="relative mt-1">
      <Input
        ref={inputRef}
        type="search"
        placeholder={t('mobile.search.placeholder')}
        inputClassName={cn('pl-8 pr-10 h-10 text-base', isPending && 'pr-16')}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        // Prevent losing focus on mobile
        onBlur={(e) => {
          // Only blur if not clicking on clear button
          const relatedTarget = e.relatedTarget as HTMLElement
          if (relatedTarget?.dataset.clearButton !== 'true') {
            // Allow blur
          }
        }}
      />

      {/* Loading spinner or clear button */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {isPending && (
          <i className="i-mingcute-loading-line animate-spin text-text-tertiary" />
        )}

        {value && (
          <button
            type="button"
            data-clear-button="true"
            onClick={clearSearch}
            className={cn(
              'p-1 rounded-full hover:bg-material-medium transition-colors',
              'text-text-tertiary hover:text-text-secondary',
              'touch-manipulation min-w-[24px] min-h-[24px] flex items-center justify-center',
            )}
            aria-label={t('mobile.search.clear')}
          >
            <i className="i-mingcute-close-circle-fill text-base" />
          </button>
        )}
      </div>
    </div>
  )
}
