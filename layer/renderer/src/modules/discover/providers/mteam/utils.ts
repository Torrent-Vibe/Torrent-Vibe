import type { MTeamProviderConfig } from '~/atoms/settings/discover'

export const invariant = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(message)
  }
}

export const joinPath = (baseUrl: string, path: string) => {
  const normalizedBase = baseUrl.replace(/\/$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}

export const parseNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const cleaned = value.trim()
    if (!cleaned) return null
    const parsed = Number(cleaned)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export const parseDateToIso = (value: unknown): string | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }
  if (typeof value === 'number') {
    // Heuristic: treat seconds vs milliseconds
    const timestamp = value > 1e12 ? value : value * 1000
    const date = new Date(timestamp)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }
  return null
}

export const firstNonEmptyString = (
  ...values: Array<unknown | (() => unknown)>
): string | null => {
  for (const value of values) {
    const resolved = typeof value === 'function' ? value() : value
    if (typeof resolved === 'string') {
      const trimmed = resolved.trim()
      if (trimmed) return trimmed
    }
  }
  return null
}

export const normalizeDescription = (value: string): string => {
  return value
    .replaceAll('\r\n', '\n')
    .replaceAll(/\[img\][\s\S]*?\[\/img\]/gi, '')
    .trim()
}

export const normalizeSynopsis = (value: string): string =>
  value
    .replaceAll('\r\n', ' ')
    .replaceAll('\n', ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()

export const normalizeTags = (input: unknown): string[] => {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  for (const candidate of input) {
    if (typeof candidate !== 'string') continue
    const normalized = candidate.trim()
    if (!normalized) continue
    seen.add(normalized)
  }
  return Array.from(seen)
}

export const extractImdbId = (
  value: string | null | undefined,
): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const match = trimmed.match(/tt\d{7,}/i)
  return match ? match[0] : null
}

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

export const parseCategories = (value: unknown): number[] => {
  if (!value) return []
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'number') return item
        if (typeof item === 'string') {
          const cleaned = item.trim()
          if (!cleaned) return null
          const parsed = Number(cleaned)
          return Number.isFinite(parsed) ? parsed : null
        }
        return null
      })
      .filter((item): item is number => item !== null)
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map(Number)
      .filter((num) => Number.isFinite(num))
  }
  return []
}

export const ensureConfigReady = (config: MTeamProviderConfig) => {
  invariant(config.enabled, 'M-Team provider is disabled')
  invariant(Boolean(config.apiKey.trim()), 'M-Team API key is missing')
  invariant(Boolean(config.baseUrl.trim()), 'M-Team base URL is missing')
}

export const createHeaders = (
  config: MTeamProviderConfig,
  extra?: HeadersInit,
) => ({
  'x-api-key': config.apiKey,
  ...extra,
})

export const handleErrorResponse = async (response: Response) => {
  const fallback = `${response.status} ${response.statusText}`
  try {
    const text = await response.text()
    if (!text) throw new Error(fallback)
    try {
      const json = JSON.parse(text) as { message?: string }
      throw new Error(json.message || fallback)
    } catch {
      throw new Error(text)
    }
  } catch (error) {
    if (error instanceof Error) throw error
    throw new Error(fallback)
  }
}
