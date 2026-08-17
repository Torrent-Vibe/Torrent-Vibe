function withTrailingSlash(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

interface HttpBase {
  directory: string
  origin: string
}

function parseHttpBase(baseUrl: string): HttpBase {
  const match = baseUrl
    .trim()
    .match(/^(https?):\/\/([^#/?]+)(\/[^#?]*)?(?:\?[^#]*)?(?:#.*)?$/i)
  if (!match) {
    throw new TypeError(`Invalid Mikan base URL: ${baseUrl}`)
  }

  return {
    origin: `${match[1].toLowerCase()}://${match[2]}`,
    directory: withTrailingSlash(match[3] || '/'),
  }
}

function pathFromAbsoluteUrl(value: string): string | undefined {
  const match = value.match(
    /^(?:https?:)?\/\/[^#/?]+(\/[^#?]*)?(\?[^#]*)?(#.*)?$/i,
  )
  if (!match) {
    return undefined
  }
  return `${match[1] || '/'}${match[2] || ''}${match[3] || ''}`
}

export function joinMikanUrl(baseUrl: string, path: string): string {
  const base = parseHttpBase(baseUrl)
  const remotePath = pathFromAbsoluteUrl(path)
  const normalizedPath = remotePath ?? path

  if (normalizedPath.startsWith('/')) {
    return `${base.origin}${normalizedPath}`
  }
  return `${base.origin}${base.directory}${normalizedPath}`
}

export function bangumiRssUrl(
  baseUrl: string,
  bangumiId: string,
  subgroupId: string,
): string {
  const url = joinMikanUrl(baseUrl, 'RSS/Bangumi')
  return `${url}?bangumiId=${encodeURIComponent(bangumiId)}&subgroupid=${encodeURIComponent(subgroupId)}`
}

export function torrentDownloadUrl(baseUrl: string, href: string): string {
  return joinMikanUrl(baseUrl, href)
}
