import { torrentDownloadUrl } from './urls'

export interface RssEpisode {
  episodeId: string
  publishedAt?: string
  sizeBytes?: number
  title: string
  torrentUrl: string
}

function decodeXml(value: string): string {
  return value
    .replaceAll(/&#x([\dA-Fa-f]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replaceAll(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    )
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}

function tagText(xml: string, name: string): string | undefined {
  const match = xml.match(
    new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'),
  )
  return match?.[1] === undefined ? undefined : decodeXml(match[1])
}

function attr(tag: string, name: string): string | undefined {
  const match =
    tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i')) ??
    tag.match(new RegExp(`${name}\\s*=\\s*'([^']*)'`, 'i'))
  return match?.[1] === undefined ? undefined : decodeXml(match[1])
}

export function parseBangumiRss(xml: string, baseUrl: string): RssEpisode[] {
  const items = xml.match(/<item\b[^>]*>[\S\s]*?<\/item>/gi) ?? []
  const episodes: RssEpisode[] = []

  for (const item of items) {
    const title = tagText(item, 'title')
    const pageLink = tagText(item, 'link') ?? ''
    const enclosureTag = item.match(/<enclosure\b[^>]*>/i)?.[0] ?? ''
    const enclosureUrl = attr(enclosureTag, 'url')
    const episodeId =
      pageLink.match(/\/home\/episode\/([\da-f]+)/i)?.[1] ??
      enclosureUrl?.match(/\/download\/\d+\/([\da-f]+)\.torrent/i)?.[1]
    const torrentHref = enclosureUrl ?? pageLink
    if (!title || !episodeId || !torrentHref) {
      continue
    }

    const episode: RssEpisode = {
      episodeId,
      title,
      torrentUrl: torrentDownloadUrl(baseUrl, torrentHref),
    }

    const publishedAt = tagText(item, 'pubDate')
    if (publishedAt) {
      episode.publishedAt = publishedAt
    }

    const sizeRaw =
      tagText(item, 'contentLength') ?? attr(enclosureTag, 'length')
    const sizeBytes = Number(sizeRaw)
    if (Number.isFinite(sizeBytes) && sizeBytes > 0) {
      episode.sizeBytes = sizeBytes
    }

    episodes.push(episode)
  }

  return episodes
}
