import Fuse from 'fuse.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '~/components/ui/input'
import { clsxm } from '~/lib/cn'

import { DiscoverModalActions } from '../actions'
import { useDiscoverModalStore } from '../store'

interface DiscoverSearchInputProps {
  autoSearchOnSelect?: boolean
}

export const DiscoverSearchInput = ({
  autoSearchOnSelect = true,
}: DiscoverSearchInputProps) => {
  // 原 props 下沉：状态、动作、i18n、历史、禁用/搜索中标记
  const actions = DiscoverModalActions.shared
  const { form, search: searchSlice, history: historySlice } = actions.slices
  const keyword = useDiscoverModalStore((s) => s.keyword)
  const searchHistory = useDiscoverModalStore((s) => s.searchHistory)
  const providerReady = useDiscoverModalStore((s) => s.providerReady)
  const isSearching = useDiscoverModalStore((s) => s.isSearching)
  const { t } = useTranslation('app')

  const disabled = !providerReady

  const submitSearch = useCallback(() => {
    void searchSlice.performSearch()
  }, [searchSlice])

  // 将原本通过 props 传入的数据替换
  const value = keyword
  const onChange = (v: string) => form.updateKeyword(v)
  const onSelect = (v: string) => {
    form.updateKeyword(v)
    if (autoSearchOnSelect) submitSearch()
  }
  const onSubmit = submitSearch
  const clearHistory = () => historySlice.clearSearchHistory()
  const i18n = {
    recent: t('discover.modal.recentSearches'),
    clear: t('discover.modal.clearRecentSearches'),
  }
  const searching = isSearching
  const history = searchHistory
  const id = 'discover-modal-keyword'
  const placeholder = t('discover.modal.keywordPlaceholder')

  const inputRef = useRef<HTMLInputElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [panelMouseDown, setPanelMouseDown] = useState(false)

  // 去重（保留原顺序）
  const uniqueHistory = useMemo(() => {
    const seen = new Set<string>()
    return history.filter((h) => {
      if (seen.has(h)) return false
      seen.add(h)
      return true
    })
  }, [history])

  const fuse = useMemo(() => {
    if (uniqueHistory.length === 0) return null
    return new Fuse(uniqueHistory, {
      includeScore: true,
      threshold: 0.4,
    })
  }, [uniqueHistory])

  const filteredHistory = useMemo(() => {
    if (!value.trim()) return uniqueHistory
    if (!fuse) return uniqueHistory
    return fuse.search(value.trim()).map((r) => r.item)
  }, [value, fuse, uniqueHistory])

  const hasData = filteredHistory.length > 0

  useEffect(() => {
    if (!hasData) {
      setActiveIndex(-1)
    } else if (activeIndex >= filteredHistory.length) {
      setActiveIndex(filteredHistory.length - 1)
    }
  }, [filteredHistory, hasData, activeIndex])

  const openPanel = useCallback(() => {
    if (disabled) return
    if (!hasData) return
    setOpen(true)
  }, [disabled, hasData])

  const closePanel = useCallback(() => {
    setOpen(false)
    setActiveIndex(-1)
  }, [])

  // 点击外部关闭
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current?.contains(e.target as Node) ||
        inputRef.current?.contains(e.target as Node)
      )
        return
      closePanel()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, closePanel])

  const handleBlur = (_e: React.FocusEvent<HTMLInputElement>) => {
    // 延迟，允许 panel 内元素点击
    requestAnimationFrame(() => {
      if (!panelMouseDown) {
        closePanel()
      }
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown': {
        if (!open) {
          openPanel()
          setActiveIndex(0)
        } else if (hasData) {
          setActiveIndex((prev) => {
            const next = prev + 1
            return next >= filteredHistory.length ? 0 : next
          })
        }
        e.preventDefault()
        break
      }
      case 'ArrowUp': {
        if (open && hasData) {
          setActiveIndex((prev) => {
            const next = prev - 1
            return next < 0 ? filteredHistory.length - 1 : next
          })
          e.preventDefault()
        }
        break
      }
      case 'Enter': {
        if (open && activeIndex >= 0 && filteredHistory[activeIndex]) {
          e.preventDefault()
          onSelect(filteredHistory[activeIndex])
          closePanel()
        } else if (!open) {
          onSubmit()
        } else if (activeIndex === -1) {
          onSubmit()
        }
        break
      }
      case 'Escape': {
        if (open) {
          e.preventDefault()
          closePanel()
        }
        break
      }
      case 'Tab': {
        if (open && activeIndex >= 0 && filteredHistory[activeIndex]) {
          onSelect(filteredHistory[activeIndex])
          closePanel()
        }
        break
      }
    }
  }

  return (
    <div className="relative flex-1">
      <Input
        id={id}
        ref={inputRef}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        onFocus={() => {
          if (hasData) openPanel()
        }}
        onBlur={handleBlur}
        onChange={(e) => {
          onChange(e.target.value)
          // 输入过程中动态展开/收起
          if (!open && e.target.value && filteredHistory.length > 0) {
            openPanel()
          } else if (open && !hasData) {
            closePanel()
          }
        }}
        onKeyDown={handleKeyDown}
      />

      {open && hasData && (
        <div
          ref={panelRef}
          role="listbox"
          aria-label={i18n.recent}
          className="bg-material-medium backdrop-blur-background absolute top-full z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border p-1 shadow-context-menu"
          onMouseDown={() => setPanelMouseDown(true)}
          onMouseUp={() => setPanelMouseDown(false)}
        >
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
              {i18n.recent}
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-text-secondary transition hover:bg-background-secondary hover:text-text"
              onClick={() => {
                clearHistory()
                closePanel()
              }}
              disabled={searching}
            >
              <i className="i-mingcute-delete-2-line size-3" />
              {i18n.clear}
            </button>
          </div>
          <div className="my-1 h-px bg-border/60" />
          {filteredHistory.map((h, idx) => {
            const active = idx === activeIndex
            return (
              <button
                key={h}
                type="button"
                role="option"
                aria-selected={active}
                data-active={active || undefined}
                className={clsxm(
                  'text-left text-sm w-full rounded-[5px] px-2 py-1 transition flex items-center',
                  'cursor-menu',
                  active
                    ? 'bg-accent text-white'
                    : 'hover:bg-accent/80 hover:text-white',
                )}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => {
                  onSelect(h)
                  closePanel()
                }}
              >
                <span className="line-clamp-1 text-ellipsis" title={h}>
                  {h}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
