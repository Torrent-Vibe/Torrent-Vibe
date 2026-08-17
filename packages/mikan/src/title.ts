export interface ParsedTitle {
  episode: number | null
  season: number | null
  title: string
}

const QUALITY_NUMBERS = new Set([360, 480, 720, 1080, 1440, 2160, 4320])

export function parseMikanTitle(raw: string): ParsedTitle {
  const text = raw.trim()
  if (!text) {
    return { title: '', season: null, episode: null }
  }

  let working = text
  let season: number | null = null
  let episode: number | null = null

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
