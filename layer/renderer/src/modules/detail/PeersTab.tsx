import { m } from 'motion/react'
import { useCallback, useMemo } from 'react'

import { VirtualList } from '~/components/ui/virtual-list/VirtualList'
import { cn } from '~/lib/cn'
import { formatBytesSmart, formatSpeed } from '~/lib/format'
import type { TorrentPeer } from '~/types/torrent'

interface PeersTabProps {
  peers?: Record<string, TorrentPeer>
  isLoading?: boolean
}

const countryCodeToFlag = (code?: string) => {
  if (!code) {
    return ''
  }
  const cc = code.trim().toUpperCase()
  if (cc.length !== 2 || /[^A-Z]/.test(cc)) {
    return ''
  }
  const OFFSET = 0x1F1E6
  const A = 'A'.codePointAt(0)!
  return (
    String.fromCodePoint(OFFSET + (cc.charCodeAt(0) - A))
    + String.fromCodePoint(OFFSET + (cc.charCodeAt(1) - A))
  )
}

// A compact single-row layout with aligned columns
// Columns: status dot | ip:port + client (left) | dl speed | up speed
export const PeersTab = ({ peers, isLoading }: PeersTabProps) => {
  const entries = useMemo(() => Object.entries(peers || {}), [peers])
  const renderItem = useCallback(([, peer]: [string, TorrentPeer]) => {
    return (
      <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 p-3 hover:bg-fill-secondary/30 transition-colors border border-transparent hover:border-separator">
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
            {peer.ip}
            :
            {peer.port}
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

  return (
    <div className="-mx-4 -my-4 flex-1 min-h-0">
      <VirtualList<[string, TorrentPeer]>
        data={entries}
        renderItem={renderItem}
        getItemKey={([key]) => key}
        estimateSize={58}
        className="px-4 pb-4"
        itemClassName="pb-0.5 last:pb-0"
      />
    </div>
  )
}
