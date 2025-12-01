/* eslint-disable unicorn/prefer-code-point */
import { m } from 'motion/react'
import { useCallback, useMemo } from 'react'
import type { Components } from 'react-virtuoso'
import { Virtuoso } from 'react-virtuoso'

import { cn } from '~/lib/cn'
import { formatBytesSmart, formatSpeed } from '~/lib/format'
import type { TorrentPeer } from '~/types/torrent'

interface PeersTabProps {
  peers?: Record<string, TorrentPeer>
  isLoading?: boolean
}

const countryCodeToFlag = (code?: string) => {
  if (!code) return ''
  const cc = code.trim().toUpperCase()
  if (cc.length !== 2 || /[^A-Z]/.test(cc)) return ''
  const OFFSET = 0x1f1e6
  const A = 'A'.codePointAt(0)!
  return (
    String.fromCodePoint(OFFSET + (cc.charCodeAt(0) - A)) +
    String.fromCodePoint(OFFSET + (cc.charCodeAt(1) - A))
  )
}

// A compact single-row layout with aligned columns
// Columns: status dot | ip:port + client (left) | dl speed | up speed
export const PeersTab = ({ peers, isLoading }: PeersTabProps) => {
  const entries = useMemo(() => Object.entries(peers || {}), [peers])
  const itemContent = useCallback((_, [key, peer]: [string, TorrentPeer]) => {
    return (
      <div
        key={key}
        className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 p-3 hover:bg-fill-secondary/30 transition-colors border border-transparent hover:border-separator"
      >
        <m.div
          className={cn(
            'w-2.5 h-2.5 rounded-full shadow-sm',
            peer.dl_speed > 0 || peer.up_speed > 0
              ? 'bg-green'
              : 'bg-fill-quaternary',
          )}
          animate={{
            scale: peer.dl_speed > 0 || peer.up_speed > 0 ? [1, 1.2, 1] : 1,
          }}
          transition={{
            duration: 2,
            repeat: peer.dl_speed > 0 || peer.up_speed > 0 ? Infinity : 0,
            ease: 'easeInOut',
          }}
        />
        <div className="min-w-0">
          <div
            className="text-sm font-medium text-text truncate"
            title={`${peer.ip}:${peer.port}`}
          >
            <span
              className="mr-1"
              title={peer.country}
              aria-label={peer.country}
            >
              {countryCodeToFlag(peer.country_code) || '🌐'}
            </span>
            {peer.ip}:{peer.port}
          </div>
          <div className="text-xs text-text-secondary truncate">
            {peer.client}
          </div>
        </div>
        <div className="text-xs text-right tabular-nums w-[88px]">
          <div className="flex items-center justify-end gap-1 text-blue">
            <i className="i-lucide-cloud-download" />
            <span className="font-medium">{formatSpeed(peer.dl_speed)}</span>
          </div>
          <div className="text-[10px] text-text-secondary">
            {formatBytesSmart(peer.downloaded)}
          </div>
        </div>
        <div className="text-xs text-right tabular-nums w-[88px]">
          <div className="flex items-center justify-end gap-1 text-green">
            <i className="i-lucide-cloud-upload" />
            <span className="font-medium">{formatSpeed(peer.up_speed)}</span>
          </div>
          <div className="text-[10px] text-text-secondary">
            {formatBytesSmart(peer.uploaded)}
          </div>
        </div>
      </div>
    )
  }, [])
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <i className="i-mingcute-loading-3-line animate-spin text-accent size-8" />
      </div>
    )
  }

  if (!peers || Object.keys(peers || {}).length === 0) {
    return (
      <div className="text-sm text-text-secondary text-center p-6 flex flex-col items-center gap-2">
        <i className="i-mingcute-group-line text-2xl text-accent size-8" />
        No peers connected
      </div>
    )
  }

  const Scroller = PeersScroller
  const Item = PeersItem

  return (
    <div className="-mx-4 -my-4 flex-1 min-h-0">
      <Virtuoso<[string, TorrentPeer]>
        style={{ height: '100%' }}
        data={entries}
        components={{ Scroller, Item }}
        itemContent={itemContent}
      />
    </div>
  )
}

// Stable custom components per Virtuoso docs
const PeersScroller: Components<[string, TorrentPeer]>['Scroller'] = ({
  ref,
  style,
  ...props
}) => {
  return (
    <div
      ref={ref as any}
      style={style}
      className={cn('px-4 pb-4 [&>div]:left-0', (props as any).className)}
      {...(props as any)}
    />
  )
}

const PeersItem: Components<[string, TorrentPeer]>['Item'] = ({ ...props }) => (
  <div className={'mb-0.5 last:mb-0'} {...props} />
)
