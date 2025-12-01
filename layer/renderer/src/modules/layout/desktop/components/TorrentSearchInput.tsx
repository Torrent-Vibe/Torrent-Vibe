import { m } from 'motion/react'
import * as React from 'react'
import type { VariantProps } from 'tailwind-variants'
import { tv } from 'tailwind-variants'

import { Input } from '~/components/ui/input/Input'
import { cn } from '~/lib/cn'
import { Spring } from '~/lib/spring'
import {
  torrentDataStoreSetters,
  useTorrentDataStore,
} from '~/modules/torrent/stores/torrent-data-store'

const torrentSearchInputStyles = tv({
  slots: {
    container: 'overflow-hidden flex relative',
    input: '',
    loadingIcon:
      'i-mingcute-loading-line absolute right-2 top-1/2 -translate-y-1/2 animate-spin',
  },
  variants: {
    variant: {
      default: {
        container: '',
        input: '',
        loadingIcon: '',
      },
      compact: {
        container: '[&_svg]:size-3.5',
        input: 'text-xs py-1.5',
        loadingIcon: 'size-3',
      },
    },
    fullRounded: {
      true: {
        container: 'rounded-full',
        input: 'rounded-full',
        loadingIcon: '',
      },
    },
  },
  defaultVariants: {
    variant: 'default',
    fullRounded: false,
  },
})

interface TorrentSearchInputProps
  extends VariantProps<typeof torrentSearchInputStyles> {
  className?: string
}

export const TorrentSearchInput: React.FC<TorrentSearchInputProps> = ({
  variant = 'default',
  fullRounded = false,
  className,
}) => {
  const searchQuery = useTorrentDataStore((s) => s.searchQuery ?? '')

  const [value, setValue] = React.useState(searchQuery)
  const [focused, setFocused] = React.useState(false)

  const [isPending, startTransition] = React.useTransition()
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

  const styles = torrentSearchInputStyles({ variant, fullRounded })

  // Adjust widths based on variant
  const widths =
    variant === 'compact'
      ? { focused: 200, unfocused: 160 }
      : { focused: 240, unfocused: 192 }

  return (
    <m.div
      initial={false}
      animate={{ width: focused ? widths.focused : widths.unfocused }}
      transition={Spring.presets.smooth}
      className={cn(styles.container(), className)}
      data-layout-id="torrent-search-input"
    >
      <Input
        type="search"
        placeholder={'Search torrents...'}
        inputClassName={cn(styles.input(), {
          'pr-8': isPending,
          'pr-6': isPending && variant === 'compact',

          'h-8': variant === 'compact',
        })}
        className={styles.input()}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />

      {isPending && <i className={cn(styles.loadingIcon())} />}
    </m.div>
  )
}
