import {
  parseBangumiDetail,
  parseBangumiRss,
  parseMikanTitle,
  parseSearchBangumi,
  parseSeasonWall,
} from './index'

export const bridgeVersion = 1

type BridgeOperation =
  'bangumiDetail' | 'bangumiRss' | 'parseTitle' | 'searchBangumi' | 'seasonWall'

interface BangumiDetailInput {
  bangumiId: string
  baseUrl: string
  html: string
}

interface BangumiRssInput {
  baseUrl: string
  xml: string
}

interface DocumentInput {
  html: string
}

interface TitleInput {
  title: string
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function invoke(operation: BridgeOperation, inputJSON: string): string {
  try {
    const input = JSON.parse(inputJSON) as unknown
    let value: unknown

    switch (operation) {
      case 'seasonWall': {
        const { html } = input as DocumentInput
        value = parseSeasonWall(html)
        break
      }
      case 'searchBangumi': {
        const { html } = input as DocumentInput
        value = parseSearchBangumi(html)
        break
      }
      case 'bangumiDetail': {
        const { html, bangumiId, baseUrl } = input as BangumiDetailInput
        value = parseBangumiDetail(html, bangumiId, baseUrl)
        break
      }
      case 'bangumiRss': {
        const { xml, baseUrl } = input as BangumiRssInput
        value = parseBangumiRss(xml, baseUrl)
        break
      }
      case 'parseTitle': {
        const { title } = input as TitleInput
        value = parseMikanTitle(title)
        break
      }
      default: {
        throw new Error(
          `Unsupported Mikan parser operation: ${String(operation)}`,
        )
      }
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
