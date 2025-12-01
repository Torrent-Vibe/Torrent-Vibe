import type { ReactNode } from 'react'

export interface LayoutPreferences {
  detailPanelVisible: boolean
  detailPanelWidth: number
  compactMode: boolean
}

// StatusIndicator types
interface FilterStat {
  label: string
  count: number
  icon: string
  color: string
}

export interface HeaderProps {
  className?: string
  showSearch?: boolean
  hasSelection?: boolean
  onTorrentAction?: (action: 'pause' | 'resume' | 'delete') => void
  // StatusIndicator props
  isLoading?: boolean
  currentFilterStat?: FilterStat
  totalStats?: number
  isFilteredView?: boolean
}

export interface MainPanelProps {
  className?: string
  children: ReactNode
}

export interface DetailPanelProps {
  className?: string
  visible?: boolean
  onVisibleChange?: (visible: boolean) => void
  children: ReactNode
}

export interface ResizablePanelProps {
  direction: 'horizontal' | 'vertical'
  minSize: number
  maxSize: number
  defaultSize: number
  onResize?: (size: number) => void
  children: ReactNode
}

// Sidebar types removed - functionality moved to toolbar

// Torrent types moved to ~/types/torrent
