import { normalizeHelperBaseUrl } from './api'
import { ownerOfHelperUrl } from './bindings'
import type { HelperBinding } from './types'

export interface MdnsRow {
  host: string
  name: string
  port: number
  version: string
}

export const decorateMdnsRows = (
  rows: MdnsRow[],
  bindings: Record<string, HelperBinding>,
  currentServerId: string,
  serverNames: Record<string, string>,
) =>
  rows.map((row) => {
    const url = normalizeHelperBaseUrl(`http://${row.host}:${row.port}`)
    const owner = ownerOfHelperUrl(url, bindings, currentServerId)
    return {
      ...row,
      url,
      disabled: Boolean(owner),
      ownerName: owner ? (serverNames[owner] ?? owner) : undefined,
    }
  })
