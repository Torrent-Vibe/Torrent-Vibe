import { useMemo, useState } from 'react'

import { useControlled } from '~/hooks/common/useControlled'
import { useMobile } from '~/hooks/common/useMobile'
import { clsxm, focusRing } from '~/lib/cn'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './Select'

export type ResponsiveSelectItem = {
  label: string
  value: string
}
export interface ResponsiveSelectProps {
  contentClassName?: string
  defaultValue?: string
  disabled?: boolean
  items: ResponsiveSelectItem[]
  onValueChange?: (value: string) => void
  placeholder?: string
  renderItem?: (item: ResponsiveSelectItem) => React.ReactNode
  renderValue?: (value: string) => React.ReactNode

  size?: 'sm' | 'default'
  triggerClassName?: string
  value?: string
}
export const ResponsiveSelect = ({
  defaultValue,
  value,
  onValueChange,
  items,
  renderValue,
  renderItem,
  disabled,
  size = 'default',
  triggerClassName,
  contentClassName,
  placeholder,
}: ResponsiveSelectProps) => {
  const [valueInner] = useControlled(value, defaultValue ?? '', onValueChange)

  const isMobile = useMobile()

  const valueToLabelMap = useMemo(
    () =>
      items.reduce(
        (acc, item) => {
          acc[item.value] = item.label
          return acc
        },
        {} as Record<string, string>,
      ),
    [items],
  )

  const [realSelectRef, setRealSelectRef] = useState<HTMLSelectElement | null>(
    null,
  )
  if (isMobile) {
    return (
      <button
        type="button"
        className={clsxm(
          'placeholder:text-text-secondary flex w-full items-center justify-between whitespace-nowrap rounded-md bg-transparent disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
          focusRing,
          'border-border border',
          size === 'sm' ? 'h-7 p-2 text-sm' : 'h-9 px-3 py-2 text-sm',
          'hover:border-accent/80',
          'relative',
          triggerClassName,
        )}
        onClick={() => realSelectRef?.click()}
      >
        <span className="flex">
          {(renderValue?.(valueInner) ?? valueToLabelMap[valueInner]) || (
            <span className="text-text-tertiary">{placeholder}</span>
          )}
        </span>
        <i className="i-mingcute-down-line ml-2 size-4 shrink-0 opacity-50" />
        <select
          className="absolute inset-0 opacity-0"
          ref={setRealSelectRef}
          value={valueInner}
          onChange={(e) => onValueChange?.(e.target.value)}
        >
          {items.map((item) => (
            <option key={item.value} value={item.value}>
              {renderItem?.(item) ?? item.label}
            </option>
          ))}
        </select>
      </button>
    )
  }

  return (
    <Select
      defaultValue={defaultValue}
      disabled={disabled}
      value={valueInner}
      onValueChange={onValueChange}
    >
      <SelectTrigger className={triggerClassName} size={size}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className={contentClassName} position="item-aligned">
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {renderItem?.(item) ?? item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
