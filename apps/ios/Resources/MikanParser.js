'use strict'
var MikanParser = (() => {
  var __defProp = Object.defineProperty
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor
  var __getOwnPropNames = Object.getOwnPropertyNames
  var __hasOwnProp = Object.prototype.hasOwnProperty
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true })
  }
  var __copyProps = (to, from, except, desc) => {
    if ((from && typeof from === 'object') || typeof from === 'function') {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, {
            get: () => from[key],
            enumerable:
              !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
          })
    }
    return to
  }
  var __toCommonJS = (mod) =>
    __copyProps(__defProp({}, '__esModule', { value: true }), mod)

  // src/jscore.ts
  var jscore_exports = {}
  __export(jscore_exports, {
    bridgeVersion: () => bridgeVersion,
    invoke: () => invoke,
  })

  // src/urls.ts
  function withTrailingSlash(baseUrl) {
    return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  }
  function parseHttpBase(baseUrl) {
    const match = baseUrl
      .trim()
      .match(/^(https?):\/\/([^/?#]+)(\/[^?#]*)?(?:\?[^#]*)?(?:#.*)?$/i)
    if (!match) {
      throw new TypeError(`Invalid Mikan base URL: ${baseUrl}`)
    }
    return {
      origin: `${match[1].toLowerCase()}://${match[2]}`,
      directory: withTrailingSlash(match[3] || '/'),
    }
  }
  function pathFromAbsoluteUrl(value) {
    const match = value.match(
      /^(?:https?:)?\/\/[^/?#]+(\/[^?#]*)?(\?[^#]*)?(#.*)?$/i,
    )
    if (!match) {
      return void 0
    }
    return `${match[1] || '/'}${match[2] || ''}${match[3] || ''}`
  }
  function joinMikanUrl(baseUrl, path) {
    const base = parseHttpBase(baseUrl)
    const remotePath = pathFromAbsoluteUrl(path)
    const normalizedPath = remotePath ?? path
    if (normalizedPath.startsWith('/')) {
      return `${base.origin}${normalizedPath}`
    }
    return `${base.origin}${base.directory}${normalizedPath}`
  }
  function torrentDownloadUrl(baseUrl, href) {
    return joinMikanUrl(baseUrl, href)
  }

  // src/html.ts
  var SIZE_UNITS = {
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
  function decodeHtml(value) {
    return value
      .replaceAll(/&#x([\dA-Fa-f]+);/g, (_, hex) =>
        String.fromCodePoint(Number.parseInt(hex, 16)),
      )
      .replaceAll(/&#(\d+);/g, (_, dec) =>
        String.fromCodePoint(Number.parseInt(dec, 10)),
      )
      .replaceAll('&nbsp;', ' ')
      .replaceAll('&quot;', '"')
      .replaceAll('&apos;', "'")
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&amp;', '&')
  }
  function stripTags(html) {
    return decodeHtml(html.replaceAll(/<[^>]+>/g, '')).trim()
  }
  function parseSize(text) {
    const match = text
      .replaceAll(',', '')
      .match(/([\d.]+)\s*(kib|mib|gib|tib|kb|mb|gb|tb|b)\b/i)
    if (!match) {
      return void 0
    }
    const amount = Number(match[1])
    const unit = SIZE_UNITS[match[2].toLowerCase()]
    if (!Number.isFinite(amount) || !unit) {
      return void 0
    }
    return Math.round(amount * unit)
  }
  function matchAll(html, pattern) {
    return [...html.matchAll(pattern)]
  }
  function parseCardList(chunk, weekday) {
    const items = []
    const seen = /* @__PURE__ */ new Set()
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
      const card = { bangumiId, title }
      if (coverUrl) {
        card.coverUrl = decodeHtml(coverUrl)
      }
      if (weekday !== void 0) {
        card.weekday = weekday
      }
      items.push(card)
    }
    return items
  }
  function parseSeasonWall(html) {
    const date = html.match(
      /class="sk-col date-text">\s*(\d{4})\s*([冬夏春秋])/,
    )
    const groups = []
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
  function parseSearchBangumi(html) {
    const lists =
      html.match(/<ul[^>]*class="[^"]*an-ul[^"]*"[^>]*>[\S\s]*?<\/ul>/gi) ?? []
    const cards = []
    const seen = /* @__PURE__ */ new Set()
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
  function parseEpisodeRows(chunk, subgroupId, baseUrl) {
    const rows = chunk.match(/<tr\b[^>]*>[\S\s]*?<\/tr>/gi) ?? []
    const episodes = []
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
      const episode = {
        episodeId,
        subgroupId,
        title: stripTags(titleHtml),
        torrentUrl: torrentDownloadUrl(baseUrl, torrentHref),
      }
      for (const cell of row.matchAll(/<td\b[^>]*>([\S\s]*?)<\/td>/gi)) {
        const text = stripTags(cell[1])
        const sizeBytes = parseSize(text)
        if (sizeBytes !== void 0) {
          episode.sizeBytes = sizeBytes
        } else if (/\d{4}(?:\/\d{1,2}){2}/.test(text)) {
          episode.publishedAt = text
        }
      }
      episodes.push(episode)
    }
    return episodes
  }
  function parseBangumiDetail(html, bangumiId, baseUrl) {
    const title = stripTags(
      html.match(/<p class="bangumi-title">([\S\s]*?)<\/p>/i)?.[1] ?? '',
    )
    const coverUrl = html.match(
      /bangumi-poster"[^>]*style="[^"]*url\(\s*["']?([^\s"')]+)["']?\s*\)/i,
    )?.[1]
    const bangumiSubjectId = html.match(/bgm\.tv\/subject\/(\d+)/i)?.[1]
    const subgroups = []
    const seen = /* @__PURE__ */ new Set()
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
    const episodes = []
    const headers = matchAll(html, /<div class="subgroup-text" id="(\d+)"/gi)
    for (const [index, header] of headers.entries()) {
      const id = header[1]
      const start = header.index ?? 0
      const end = headers[index + 1]?.index ?? html.length
      episodes.push(...parseEpisodeRows(html.slice(start, end), id, baseUrl))
    }
    const detail = {
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

  // src/rss.ts
  function decodeXml(value) {
    return value
      .replaceAll(/&#x([\dA-Fa-f]+);/g, (_, hex) =>
        String.fromCodePoint(Number.parseInt(hex, 16)),
      )
      .replaceAll(/&#(\d+);/g, (_, dec) =>
        String.fromCodePoint(Number.parseInt(dec, 10)),
      )
      .replaceAll('&nbsp;', ' ')
      .replaceAll('&quot;', '"')
      .replaceAll('&apos;', "'")
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&amp;', '&')
  }
  function tagText(xml, name) {
    const match = xml.match(
      new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'),
    )
    return match?.[1] === void 0 ? void 0 : decodeXml(match[1])
  }
  function attr(tag, name) {
    const match =
      tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i')) ??
      tag.match(new RegExp(`${name}\\s*=\\s*'([^']*)'`, 'i'))
    return match?.[1] === void 0 ? void 0 : decodeXml(match[1])
  }
  function parseBangumiRss(xml, baseUrl) {
    const items = xml.match(/<item\b[^>]*>[\S\s]*?<\/item>/gi) ?? []
    const episodes = []
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
      const episode = {
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

  // src/title.ts
  var QUALITY_NUMBERS = /* @__PURE__ */ new Set([
    360, 480, 720, 1080, 1440, 2160, 4320,
  ])
  function parseMikanTitle(raw) {
    const text = raw.trim()
    if (!text) {
      return { title: '', season: null, episode: null }
    }
    let working = text
    let season = null
    let episode = null
    const se = working.match(/s(\d{1,2})e(\d{1,4})/i)
    if (se) {
      season = Number(se[1])
      episode = Number(se[2])
      working = working.replace(se[0], ' ')
    }
    if (season === null) {
      const numbered = working.match(/第(\d{1,2})季/)
      const named = working.match(/season\s*(\d{1,2})/i)
      const hit = numbered ?? named
      if (hit) {
        season = Number(hit[1])
        working = working.replace(hit[0], ' ')
      }
    }
    if (episode === null) {
      const ji = working.match(/第\s*(\d{1,4})\s*[期話话集]/)
      if (ji) {
        episode = Number(ji[1])
        working = working.replace(ji[0], ' ')
      }
    }
    if (episode === null) {
      const dash = working.match(/(?:^|\D)-\s*(\d{1,4})(?=\s*(?:\[|$|v\d))/i)
      if (dash) {
        episode = Number(dash[1])
        working = working.replace(new RegExp(`-\\s*${dash[1]}`), ' ')
      }
    }
    if (episode === null) {
      for (const tag of working.matchAll(/\[(\d{1,4})(?:v\d+)?]/gi)) {
        const value = Number(tag[1])
        if (!QUALITY_NUMBERS.has(value) && value < 1900) {
          episode = value
          working = working.replace(tag[0], ' ')
          break
        }
      }
    }
    let title = working.replaceAll(/\[[^\]]*]/g, ' ')
    title = title.replaceAll(/第\s*\d+\s*[季期話话集]/g, ' ')
    title = title.replaceAll(/(?:^|\D)-\s*\d+\b/g, ' ')
    title = title.replaceAll(/\s+/g, ' ').trim()
    if (title.includes('/')) {
      const parts = title
        .split('/')
        .map((part) => part.trim())
        .filter(Boolean)
      const cjk = parts.find((part) => /[\u3400-\u9FFF]/.test(part))
      title = (cjk ?? parts.at(-1) ?? title).trim()
    }
    title = title.replaceAll(/^[/:–—：-]+|[/:–—：-]+$/g, '').trim()
    return { title, season, episode }
  }

  // src/jscore.ts
  var bridgeVersion = 1
  function messageOf(error) {
    return error instanceof Error ? error.message : String(error)
  }
  function invoke(operation, inputJSON) {
    try {
      const input = JSON.parse(inputJSON)
      let value
      switch (operation) {
        case 'seasonWall': {
          const { html } = input
          value = parseSeasonWall(html)
          break
        }
        case 'searchBangumi': {
          const { html } = input
          value = parseSearchBangumi(html)
          break
        }
        case 'bangumiDetail': {
          const { html, bangumiId, baseUrl } = input
          value = parseBangumiDetail(html, bangumiId, baseUrl)
          break
        }
        case 'bangumiRss': {
          const { xml, baseUrl } = input
          value = parseBangumiRss(xml, baseUrl)
          break
        }
        case 'parseTitle': {
          const { title } = input
          value = parseMikanTitle(title)
          break
        }
        default:
          throw new Error(
            `Unsupported Mikan parser operation: ${String(operation)}`,
          )
      }
      return JSON.stringify({ ok: true, value })
    } catch (error) {
      return JSON.stringify({
        ok: false,
        error: {
          code: 'parserFailure',
          message: messageOf(error),
        },
      })
    }
  }
  return __toCommonJS(jscore_exports)
})()
