import { torrentDownloadUrl } from './urls'

export interface BangumiCard {
  bangumiId: string
  coverUrl?: string
  title: string
  weekday?: number
}

export interface SeasonWall {
  groups: Array<{ weekday: number; items: BangumiCard[] }>
  season: string
  year: number
}

export interface BangumiDetail {
  bangumiId: string
  bangumiSubjectId?: string
  coverUrl?: string
  episodes: Array<{
    episodeId: string
    subgroupId: string
    title: string
    torrentUrl: string
    sizeBytes?: number
    publishedAt?: string
  }>
  subgroups: Array<{ id: string; name: string }>
  title: string
}

const SIZE_UNITS: Record<string, number> = {
  b: 1,
  kb: 1024,
  kib: 1024,
  mb: 1024 ** 2,
  mib: 1024 ** 2,
  gb: 1024 ** 3,
  gib: 1024 ** 3,
  tb: 1024 ** 4,
  tib: 1024 ** 4,
}

function decodeHtml(value: string): string {
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

function stripTags(html: string): string {
  return decodeHtml(html.replaceAll(/<[^>]+>/g, '')).trim()
}

function parseSize(text: string): number | undefined {
  const match = text
    .replaceAll(',', '')
    .match(/([\d.]+)\s*(kib|mib|gib|tib|kb|mb|gb|tb|b)\b/i)
  if (!match) {
    return undefined
  }
  const amount = Number(match[1])
  const unit = SIZE_UNITS[match[2].toLowerCase()]
  if (!Number.isFinite(amount) || !unit) {
    return undefined
  }
  return Math.round(amount * unit)
}

function matchAll(html: string, pattern: RegExp): RegExpExecArray[] {
  return [...html.matchAll(pattern)]
}

function parseCardList(chunk: string, weekday?: number): BangumiCard[] {
  const items: BangumiCard[] = []
  const seen = new Set<string>()
  const lis = chunk.match(/<li\b[^>]*>[\S\s]*?<\/li>/gi) ?? []

  for (const li of lis) {
    const bangumiId =
      li.match(/data-bangumiid="(\d+)"/i)?.[1] ??
      li.match(/\/home\/bangumi\/(\d+)/i)?.[1]
    if (!bangumiId || seen.has(bangumiId)) {
      continue
    }

    const titled =
      li.match(/class="an-text"[^>]*title="([^"]*)"/i)?.[1] ??
      li.match(/title="([^"]*)"[^>]*class="an-text"/i)?.[1]
    const titledBlock = li.match(
      /class="an-text"[^>]*>([\S\s]*?)<\/(?:div|a)>/i,
    )?.[1]
    const title =
      decodeHtml(titled ?? '').trim() || stripTags(titledBlock ?? '')
    if (!title) {
      continue
    }

    const coverUrl = li.match(/data-src="([^"]+)"/i)?.[1]
    seen.add(bangumiId)
    const card: BangumiCard = { bangumiId, title }
    if (coverUrl) {
      card.coverUrl = decodeHtml(coverUrl)
    }
    if (weekday !== undefined) {
      card.weekday = weekday
    }
    items.push(card)
  }

  return items
}

export function parseSeasonWall(html: string): SeasonWall {
  const date = html.match(/class="sk-col date-text">\s*(\d{4})\s*([冬夏春秋])/)
  const groups: SeasonWall['groups'] = []
  const groupRe =
    /<div class="sk-bangumi"[^>]*data-dayofweek="(\d+)"[^>]*>([\S\s]*?)(?=<div class="sk-bangumi"|$)/gi

  for (const match of matchAll(html, groupRe)) {
    const weekday = Number(match[1])
    const items = parseCardList(match[2], weekday)
    if (items.length > 0) {
      groups.push({ weekday, items })
    }
  }

  return {
    year: date ? Number(date[1]) : 0,
    season: date?.[2] ?? '',
    groups,
  }
}

export function parseSearchBangumi(html: string): BangumiCard[] {
  const lists =
    html.match(/<ul[^>]*class="[^"]*an-ul[^"]*"[^>]*>[\S\s]*?<\/ul>/gi) ?? []
  const cards: BangumiCard[] = []
  const seen = new Set<string>()

  for (const list of lists) {
    for (const card of parseCardList(list)) {
      if (seen.has(card.bangumiId)) {
        continue
      }
      seen.add(card.bangumiId)
      cards.push(card)
    }
  }

  return cards
}

function parseEpisodeRows(
  chunk: string,
  subgroupId: string,
  baseUrl: string,
): BangumiDetail['episodes'] {
  const rows = chunk.match(/<tr\b[^>]*>[\S\s]*?<\/tr>/gi) ?? []
  const episodes: BangumiDetail['episodes'] = []

  for (const row of rows) {
    if (/<th\b/i.test(row)) {
      continue
    }
    const episodeId = row.match(/\/home\/episode\/([\da-f]+)/i)?.[1]
    const titleHtml = row.match(/magnet-link-wrap[^>]*>([\S\s]*?)<\/a>/i)?.[1]
    const torrentHref =
      row.match(/href="(\/download\/[^"]+\.torrent)"/i)?.[1] ??
      row.match(/href="(https?:\/\/[^"]+\.torrent)"/i)?.[1]
    if (!episodeId || !titleHtml || !torrentHref) {
      continue
    }

    const episode: BangumiDetail['episodes'][number] = {
      episodeId,
      subgroupId,
      title: stripTags(titleHtml),
      torrentUrl: torrentDownloadUrl(baseUrl, torrentHref),
    }

    for (const cell of row.matchAll(/<td\b[^>]*>([\S\s]*?)<\/td>/gi)) {
      const text = stripTags(cell[1])
      const sizeBytes = parseSize(text)
      if (sizeBytes !== undefined) {
        episode.sizeBytes = sizeBytes
      } else if (/\d{4}(?:\/\d{1,2}){2}/.test(text)) {
        episode.publishedAt = text
      }
    }

    episodes.push(episode)
  }

  return episodes
}

export function parseBangumiDetail(
  html: string,
  bangumiId: string,
  baseUrl: string,
): BangumiDetail {
  const title = stripTags(
    html.match(/<p class="bangumi-title">([\S\s]*?)<\/p>/i)?.[1] ?? '',
  )
  const coverUrl = html.match(
    /bangumi-poster"[^>]*style="[^"]*url\(\s*["']?([^\s"')]+)["']?\s*\)/i,
  )?.[1]
  const bangumiSubjectId = html.match(/bgm\.tv\/subject\/(\d+)/i)?.[1]

  const subgroups: BangumiDetail['subgroups'] = []
  const seen = new Set<string>()
  for (const match of matchAll(
    html,
    /<div class="subgroup-text" id="(\d+)">/gi,
  )) {
    const id = match[1]
    if (seen.has(id)) {
      continue
    }
    const start = match.index ?? 0
    const slice = html.slice(start, start + 800)
    const name = stripTags(
      slice.match(
        /<a href="\/home\/publishgroup\/\d+"[^>]*>([\S\s]*?)<\/a>/i,
      )?.[1] ?? '',
    )
    seen.add(id)
    subgroups.push({ id, name })
  }

  const episodes: BangumiDetail['episodes'] = []
  const headers = matchAll(html, /<div class="subgroup-text" id="(\d+)"/gi)
  for (const [index, header] of headers.entries()) {
    const id = header[1]
    const start = header.index ?? 0
    const end = headers[index + 1]?.index ?? html.length
    episodes.push(...parseEpisodeRows(html.slice(start, end), id, baseUrl))
  }

  const detail: BangumiDetail = {
    bangumiId,
    title,
    subgroups,
    episodes,
  }
  if (coverUrl) {
    detail.coverUrl = decodeHtml(coverUrl)
  }
  if (bangumiSubjectId) {
    detail.bangumiSubjectId = bangumiSubjectId
  }
  return detail
}
