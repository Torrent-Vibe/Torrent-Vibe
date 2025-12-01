import { useCallback } from 'react'

import {
  MENU_ITEM_SEPARATOR,
  MenuItemText,
  useShowContextMenu,
} from '~/atoms/context-menu'
import { Button } from '~/components/ui/button/Button'
import { cn } from '~/lib/cn'
import type { TorrentInfo } from '~/types/torrent'

import { useMobileFieldConfig } from '../hooks/use-mobile-field-config'
import { MobileFieldSelectorContent } from './MobileFieldSelectorContent'
import { BottomSheet } from './UniversalBottomSheetManager'

interface OverflowMenuButtonProps {
  compact?: boolean
  sortState: {
    sortKey: keyof TorrentInfo
    sortDirection: 'asc' | 'desc'
  }
  onSortFieldChange: (sortKey: string) => void
  onSortDirectionToggle: () => void
}

// Sort options for mobile
const SORT_OPTIONS = [
  { key: 'name', label: 'Name', icon: 'i-mingcute-file-line' }, // 文件
  { key: 'size', label: 'Size', icon: 'i-mingcute-counter-line' }, // 硬盘
  { key: 'progress', label: 'Progress', icon: 'i-mingcute-loading-line' }, // 进度/加载
  { key: 'dlspeed', label: 'DL Speed', icon: 'i-mingcute-download-2-line' }, // 下载
  { key: 'upspeed', label: 'UL Speed', icon: 'i-mingcute-upload-2-line' }, // 上传
  { key: 'eta', label: 'ETA', icon: 'i-mingcute-counter-2-line' }, // 计时器
  { key: 'ratio', label: 'Ratio', icon: 'i-mingcute-time-duration-line' }, // 百分比
  { key: 'state', label: 'Status', icon: 'i-mingcute-information-line' }, // 信息
  { key: 'added_on', label: 'Added', icon: 'i-mingcute-calendar-line' }, // 日历
  { key: 'priority', label: 'Priority', icon: 'i-mingcute-arrow-up-line' }, // 向上箭头
]

// Field selector is now managed directly via BottomSheet.present

export const OverflowMenuButton = ({
  compact = false,
  sortState,
  onSortFieldChange,
  onSortDirectionToggle,
}: OverflowMenuButtonProps) => {
  const showContextMenu = useShowContextMenu()
  const { visibleFields } = useMobileFieldConfig()

  const handleOverflowMenuClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const menuItems = [
        // Sort options - show current sort with checkmark
        ...SORT_OPTIONS.map(
          (option) =>
            new MenuItemText({
              label: `Sort by ${option.label}`,
              icon: <i className={cn(option.icon, 'text-text-secondary')} />,
              checked: sortState.sortKey === option.key,
              click: () => onSortFieldChange(option.key),
            }),
        ),

        MENU_ITEM_SEPARATOR,

        // Sort direction
        new MenuItemText({
          label:
            sortState.sortDirection === 'asc'
              ? 'Sort Descending'
              : 'Sort Ascending',
          icon: (
            <i
              className={cn(
                sortState.sortDirection === 'asc'
                  ? 'i-mingcute-arrow-down-line'
                  : 'i-mingcute-arrow-up-line',
                'text-text-secondary',
              )}
            />
          ),
          click: onSortDirectionToggle,
        }),

        MENU_ITEM_SEPARATOR,

        // Field customization
        new MenuItemText({
          label: `Customize Fields (${visibleFields.length})`,
          icon: (
            <i className="i-mingcute-settings-4-line text-text-secondary" />
          ),
          click: () => BottomSheet.present(MobileFieldSelectorContent),
        }),
      ]

      await showContextMenu(menuItems, e)
    },
    [
      showContextMenu,
      sortState,
      onSortFieldChange,
      onSortDirectionToggle,
      visibleFields.length,
    ],
  )

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleOverflowMenuClick}
      className={cn(
        'shrink-0 text-text-secondary hover:text-text',
        compact ? 'px-1.5 py-1 h-7' : 'px-2 py-1.5 h-9',
      )}
      title="Sort and view options"
    >
      <i
        className={cn(
          'i-mingcute-more-1-line',
          compact ? 'text-xs' : 'text-sm',
        )}
      />
    </Button>
  )
}
