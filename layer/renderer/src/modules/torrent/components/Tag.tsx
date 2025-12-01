import { memo, useCallback } from 'react'

import { MenuItemText, useShowContextMenu } from '~/atoms/context-menu'
import { getI18n } from '~/i18n'
import { clsxm } from '~/lib/cn'

interface TagProps {
  tag: string
  variant?: 'primary' | 'accent' | 'tertiary'
  onModify?: (tag: string) => void
  onDelete?: (tag: string) => void
  showContextMenu?: boolean
  className?: string
  title?: string
  type?: 'category' | 'tag'
}

const TagComponent = ({
  tag,
  variant = 'primary',
  onModify,
  onDelete,
  showContextMenu = false,
  className,
  title,
  type = 'tag',
}: TagProps) => {
  const showContextMenuHandler = useShowContextMenu()

  const handleContextMenu = useCallback(
    async (e: React.MouseEvent) => {
      if (!showContextMenu || (!onModify && !onDelete)) return

      e.preventDefault()
      e.stopPropagation()

      const { t } = getI18n()

      const menuItems = [
        onModify &&
          new MenuItemText({
            label:
              type === 'category'
                ? t('contextMenu.modifyCategory')
                : t('contextMenu.modifyTag'),
            icon: <i className="i-mingcute-edit-line" />,
            click: () => onModify(tag),
          }),
        onDelete &&
          new MenuItemText({
            label: t('contextMenu.delete'),
            icon: <i className="i-mingcute-delete-line" />,
            click: () => onDelete(tag),
          }),
      ].filter(Boolean)

      if (menuItems.length > 0) {
        await showContextMenuHandler(menuItems, e)
      }
    },
    [showContextMenu, onModify, onDelete, tag, showContextMenuHandler, type],
  )

  const baseClassName =
    'px-2 py-1 rounded-md text-xs font-medium whitespace-pre min-w-0 truncate'

  const variantClassName = {
    primary: 'bg-accent/20 text-accent',
    accent: 'bg-accent/20 text-accent',
    tertiary: 'bg-text-tertiary/20 text-text-tertiary',
  }[variant]

  const interactiveClassName =
    showContextMenu && (onModify || onDelete)
      ? 'hover:opacity-80 transition-opacity'
      : ''

  return (
    <span
      className={clsxm(
        baseClassName,
        variantClassName,
        interactiveClassName,
        className,
      )}
      title={title || tag}
      onContextMenu={handleContextMenu}
    >
      {tag}
    </span>
  )
}

export const Tag = memo(TagComponent)
