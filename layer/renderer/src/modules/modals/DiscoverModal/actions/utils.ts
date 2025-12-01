import type { DiscoverItem } from '~/modules/discover'

export const findItemById = (items: DiscoverItem[], id: string) =>
  items.find((item) => item.id === id)
