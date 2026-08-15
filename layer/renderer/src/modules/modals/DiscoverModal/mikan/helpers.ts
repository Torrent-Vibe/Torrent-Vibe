import { joinMikanUrl } from '@torrent-vibe/mikan'

import { getDiscoverProviderConfig } from '~/atoms/settings/discover'
import type { DiscoverItem } from '~/modules/discover'
import { asMikanBangumiExtra } from '~/modules/discover/providers/mikan/utils'

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0, 7]

const WEEKDAY_KEYS = {
  0: 'discover.modal.mikan.weekday.sun',
  1: 'discover.modal.mikan.weekday.mon',
  2: 'discover.modal.mikan.weekday.tue',
  3: 'discover.modal.mikan.weekday.wed',
  4: 'discover.modal.mikan.weekday.thu',
  5: 'discover.modal.mikan.weekday.fri',
  6: 'discover.modal.mikan.weekday.sat',
  7: 'discover.modal.mikan.weekday.movie',
} as const

export const resolveMikanCoverUrl = (coverUrl?: string) => {
  if (!coverUrl) {
    return null
  }
  try {
    return joinMikanUrl(getDiscoverProviderConfig('mikan').baseUrl, coverUrl)
  }
  catch {
    return coverUrl
  }
}

export const weekdayLabelKey = (weekday?: number): I18nKeys => {
  if (weekday === undefined || weekday === null) {
    return WEEKDAY_KEYS[7]
  }
  return WEEKDAY_KEYS[weekday as keyof typeof WEEKDAY_KEYS] ?? WEEKDAY_KEYS[7]
}

export const groupItemsByWeekday = (items: DiscoverItem[]) => {
  const groups = new Map<number, DiscoverItem[]>()
  for (const item of items) {
    const extra = asMikanBangumiExtra(item.extra)
    const weekday = extra?.weekday ?? 7
    const list = groups.get(weekday)
    if (list) {
      list.push(item)
    }
    else {
      groups.set(weekday, [item])
    }
  }

  const ordered = WEEKDAY_ORDER.filter(day => groups.has(day)).map(day => ({
    weekday: day,
    items: groups.get(day)!,
  }))

  for (const [weekday, grouped] of groups) {
    if (!WEEKDAY_ORDER.includes(weekday)) {
      ordered.push({ weekday, items: grouped })
    }
  }

  return ordered
}
