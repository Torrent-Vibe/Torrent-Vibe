import type { ReactNode } from 'react'

export interface LayoutPreferences {
  compactMode: boolean
  detailPanelVisible: boolean
  detailPanelWidth: number
}

// StatusIndicator types
interface FilterStat {
  color: string
  count: number
  icon: string
  label: string
}

export interface HeaderProps {
  className?: string
  currentFilterStat?: FilterStat
  hasSelection?: boolean
  isFilteredView?: boolean
  // StatusIndicator props
  isLoading?: boolean
  onTorrentAction?: (action: 'pause' | 'resume' | 'delete') => void
  showSearch?: boolean
  totalStats?: number
}

export interface MainPanelProps {
  children: ReactNode
  className?: string
}

export interface DetailPanelProps {
  children: ReactNode
  className?: string
  onVisibleChange?: (visible: boolean) => void
  visible?: boolean
}

export interface ResizablePanelProps {
  children: ReactNode
  defaultSize: number
  direction: 'horizontal' | 'vertical'
  maxSize: number
  minSize: number
  onResize?: (size: number) => void
}

// Sidebar types removed - functionality moved to toolbar

// Torrent types moved to ~/types/torrent
