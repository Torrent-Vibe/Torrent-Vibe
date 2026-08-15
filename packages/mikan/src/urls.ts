function withTrailingSlash(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

export function joinMikanUrl(baseUrl: string, path: string): string {
  const base = withTrailingSlash(baseUrl)
  if (/^https?:\/\//i.test(path) || path.startsWith('//')) {
    const absolute = path.startsWith('//') ? `https:${path}` : path
    const remote = new URL(absolute)
    return new URL(`${remote.pathname}${remote.search}${remote.hash}`, base)
      .href
  }
  return new URL(path, base).href
}

export function bangumiRssUrl(
  baseUrl: string,
  bangumiId: string,
  subgroupId: string,
): string {
  const url = new URL('RSS/Bangumi', withTrailingSlash(baseUrl))
  url.searchParams.set('bangumiId', bangumiId)
  url.searchParams.set('subgroupid', subgroupId)
  return url.href
}

export function torrentDownloadUrl(baseUrl: string, href: string): string {
  return joinMikanUrl(baseUrl, href)
}
