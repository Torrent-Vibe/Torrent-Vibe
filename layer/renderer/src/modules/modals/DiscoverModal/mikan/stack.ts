export type MikanStackFrame
  = { type: 'subscriptions' } | { type: 'bangumi', bangumiId: string }

export type MikanBrowseBody = 'wall' | 'search'

export const emptyMikanBrowseScroll = (): { wall: number, search: number } => ({
  wall: 0,
  search: 0,
})

export const mikanStackTop = (
  stack: readonly MikanStackFrame[],
): MikanStackFrame | null => stack.at(-1) ?? null

export const mikanDetailBangumiId = (
  stack: readonly MikanStackFrame[],
): string | null => {
  const top = mikanStackTop(stack)
  return top?.type === 'bangumi' ? top.bangumiId : null
}

export const nextStackAfterSubscriptions = (
  stack: readonly MikanStackFrame[],
): MikanStackFrame[] => {
  const top = mikanStackTop(stack)
  if (top?.type === 'bangumi' || top?.type === 'subscriptions') {
    return [...stack]
  }
  return [{ type: 'subscriptions' }]
}

export const nextStackAfterBangumi = (
  stack: readonly MikanStackFrame[],
  bangumiId: string,
): MikanStackFrame[] => {
  const top = mikanStackTop(stack)
  if (top?.type === 'bangumi') {
    return [...stack.slice(0, -1), { type: 'bangumi', bangumiId }]
  }
  if (top?.type === 'subscriptions') {
    if (stack.length >= 2) {
      return [...stack]
    }
    return [...stack, { type: 'bangumi', bangumiId }]
  }
  return [{ type: 'bangumi', bangumiId }]
}

export const popMikanStack = (
  stack: readonly MikanStackFrame[],
): MikanStackFrame[] => stack.slice(0, -1)

export const mikanSeasonControlsVisible = (keyword: string) => !keyword.trim()

export const mikanBrowseBody = (
  committedKeyword: string | null | undefined,
): MikanBrowseBody => (committedKeyword?.trim() ? 'search' : 'wall')
