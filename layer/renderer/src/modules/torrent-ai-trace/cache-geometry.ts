import type { AiCallSegment, AiCallSnapshot } from '@torrent-vibe/shared'

export const GPT56_CACHE_FLOOR = 1024

export const formatTraceTokens = (value: number): string => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1).replace(/\.0$/, '')}k`
  }
  return String(value)
}

export type VisualCallSegment = AiCallSegment & {
  covered: 'full' | 'none'
  toolCallId?: string
}

export type PrefixCacheLayout = {
  visualTokens: number
  segments: VisualCallSegment[]
  underlineTokens: number
  cacheRead: number
  prompt: number
  percent: number
  lastCoveredSource?: VisualCallSegment['source']
  remainderSource?: VisualCallSegment['source']
  remainderTokens: number
}

export type CacheHintKind
  = 'near-floor' | 'missed-after-prefix' | 'below-floor' | 'page-remainder'

export type CacheHint = {
  kind: CacheHintKind
  tokens: number
}

const providerPrompt = (snapshot?: AiCallSnapshot) => {
  if (!snapshot?.usage) {
    return null
  }
  return snapshot.usage.input + snapshot.usage.cacheRead
}

export const buildPrefixCacheLayout = (
  snapshot: AiCallSnapshot,
  extras: VisualCallSegment[] = [],
): PrefixCacheLayout => {
  const estimate = Math.max(
    0,
    snapshot.segments.reduce((sum, segment) => sum + segment.tokens, 0),
  )
  const prompt = providerPrompt(snapshot)
  const cacheRead = snapshot.usage?.cacheRead ?? 0
  const overhead = prompt != null && prompt > estimate ? prompt - estimate : 0
  const base: VisualCallSegment[] = extras.length
    ? extras
    : snapshot.segments.map(segment => ({
        ...segment,
        covered: 'none',
      }))

  const withSchema
    = overhead > 0
      ? [
          {
            source: 'tool-schema' as const,
            tokens: overhead,
            cached: false,
            injected: false,
            covered: 'none' as const,
          },
          ...base,
        ]
      : base

  const visualTokens = withSchema.reduce(
    (sum, segment) => sum + segment.tokens,
    0,
  )
  const budget
    = prompt != null && prompt > 0 && cacheRead > 0
      ? Math.min(cacheRead, visualTokens)
      : 0

  let remaining = budget
  let underlineTokens = 0
  let lastCoveredSource: VisualCallSegment['source'] | undefined
  let remainderSource: VisualCallSegment['source'] | undefined
  let remainderTokens = 0

  const segments = withSchema.map((segment) => {
    if (remaining <= 0 || segment.tokens <= 0) {
      return { ...segment, covered: 'none' as const }
    }
    if (remaining >= segment.tokens) {
      remaining -= segment.tokens
      underlineTokens += segment.tokens
      lastCoveredSource = segment.source
      return { ...segment, covered: 'full' as const }
    }
    remainderSource = segment.source
    remainderTokens = remaining
    remaining = 0
    return { ...segment, covered: 'none' as const }
  })

  const percent
    = prompt != null && prompt > 0 ? Math.round((cacheRead / prompt) * 100) : 0

  return {
    visualTokens,
    segments,
    underlineTokens,
    cacheRead,
    prompt: prompt ?? visualTokens,
    percent,
    lastCoveredSource,
    remainderSource,
    remainderTokens,
  }
}

export const detectCacheHint = ({
  callIndex,
  snapshot,
  previous,
}: {
  callIndex: number
  snapshot?: AiCallSnapshot
  previous?: AiCallSnapshot
}): CacheHint | null => {
  const prompt = providerPrompt(snapshot)
  const cacheRead = snapshot?.usage?.cacheRead
  const previousPrompt = providerPrompt(previous)

  if (callIndex <= 1 && prompt != null && cacheRead === 0) {
    if (prompt > 0 && prompt < GPT56_CACHE_FLOOR) {
      return { kind: 'below-floor', tokens: prompt }
    }
    if (prompt >= GPT56_CACHE_FLOOR && prompt < GPT56_CACHE_FLOOR * 2) {
      return { kind: 'near-floor', tokens: prompt }
    }
    return null
  }

  if (cacheRead === 0 && previousPrompt != null && previousPrompt > 0) {
    if (previousPrompt < GPT56_CACHE_FLOOR) {
      return { kind: 'below-floor', tokens: previousPrompt }
    }
    return { kind: 'missed-after-prefix', tokens: previousPrompt }
  }

  if (
    cacheRead != null
    && cacheRead > 0
    && previousPrompt != null
    && previousPrompt > cacheRead
  ) {
    const remain = previousPrompt - cacheRead
    if (remain > 0 && remain < GPT56_CACHE_FLOOR) {
      return { kind: 'page-remainder', tokens: remain }
    }
  }

  return null
}
