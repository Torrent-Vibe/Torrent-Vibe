import type { Stats } from 'node:fs'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { FileFilter } from 'electron'
import { dialog, shell } from 'electron'
import type { IpcContext } from 'electron-ipc-decorator'
import { IpcMethod, IpcService } from 'electron-ipc-decorator'

const URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i

const isUrl = (value: string) => URL_PATTERN.test(value.trim())

type PathAction = 'open' | 'reveal' | 'open-folder'

interface PathActionPayload {
  candidates: string[]
  action: PathAction
}

interface PathActionResult {
  ok: boolean
  usedPath?: string
  details?: string
  message?: string
}

interface DirectoryDialogOptions {
  title?: string
  defaultPath?: string
}

interface DirectoryDialogResult {
  canceled: boolean
  path?: string
}

interface SaveTextFilePayload {
  title?: string
  defaultPath?: string
  filters?: FileFilter[]
  content: string
}

interface SaveTextFileResult {
  canceled: boolean
  filePath?: string
}

const tryOpenCandidate = async (
  candidate: string,
  action: PathAction,
): Promise<PathActionResult> => {
  const trimmed = candidate?.trim()
  if (!trimmed) return { ok: false, message: 'EMPTY_PATH' }

  if (isUrl(trimmed)) {
    try {
      await shell.openExternal(trimmed)
      return { ok: true, usedPath: trimmed, details: 'external' }
    } catch {
      return { ok: false, message: 'OPEN_EXTERNAL_FAILED' }
    }
  }

  const normalized = path.normalize(trimmed)
  let stats: Stats | null = null
  try {
    stats = await fs.stat(normalized)
  } catch {
    stats = null
  }

  if (action === 'open-folder') {
    const folderPath = stats?.isDirectory()
      ? normalized
      : path.dirname(normalized)
    if (!folderPath) return { ok: false, message: 'NO_FOLDER' }
    const error = await shell.openPath(folderPath)
    if (error) {
      return { ok: false, message: error }
    }
    return { ok: true, usedPath: folderPath, details: 'folder-opened' }
  }

  if (action === 'reveal') {
    if (stats?.isDirectory()) {
      const error = await shell.openPath(normalized)
      if (error) return { ok: false, message: error }
      return { ok: true, usedPath: normalized, details: 'directory-opened' }
    }
    shell.showItemInFolder(normalized)
    return { ok: true, usedPath: normalized, details: 'revealed' }
  }

  // action === 'open'
  if (stats?.isDirectory()) {
    const error = await shell.openPath(normalized)
    if (error) return { ok: false, message: error }
    return { ok: true, usedPath: normalized, details: 'directory-opened' }
  }

  const error = await shell.openPath(normalized)
  if (!error) {
    return { ok: true, usedPath: normalized, details: 'opened' }
  }

  // Fallback: try reveal when open fails, e.g., network share
  shell.showItemInFolder(normalized)
  return { ok: true, usedPath: normalized, details: 'revealed-fallback' }
}

export class FileSystemService extends IpcService {
  static override readonly groupName = 'fileSystem'

  @IpcMethod()
  async selectDirectory(
    _context: IpcContext,
    options?: DirectoryDialogOptions,
  ): Promise<DirectoryDialogResult> {
    const result = await dialog.showOpenDialog({
      title: options?.title ?? 'Select folder',
      defaultPath: options?.defaultPath,
      properties: [
        'openDirectory',
        'createDirectory',
        'treatPackageAsDirectory',
        'dontAddToRecent',
      ],
    })

    if (result.canceled || !result.filePaths?.length) {
      return { canceled: true }
    }

    return {
      canceled: false,
      path: path.normalize(result.filePaths[0]!),
    }
  }

  @IpcMethod()
  async handlePathAction(
    _context: IpcContext,
    payload: PathActionPayload,
  ): Promise<PathActionResult> {
    if (
      !Array.isArray(payload?.candidates) ||
      payload.candidates.length === 0
    ) {
      return { ok: false, message: 'NO_CANDIDATES' }
    }

    const action: PathAction = payload.action ?? 'open'
    let lastError: string | undefined
    for (const candidate of payload.candidates) {
      try {
        const result = await tryOpenCandidate(candidate, action)
        if (result.ok) {
          return result
        }
        lastError = result.message
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }

    return {
      ok: false,
      message: lastError ?? 'FAILED_ALL_CANDIDATES',
    }
  }

  @IpcMethod()
  async saveTextFile(
    _context: IpcContext,
    payload: SaveTextFilePayload,
  ): Promise<SaveTextFileResult> {
    if (typeof payload?.content !== 'string') {
      return { canceled: true }
    }

    const result = await dialog.showSaveDialog({
      title: payload.title ?? 'Save file',
      defaultPath: payload.defaultPath,
      filters: payload.filters,
      showsTagField: false,
    })

    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }

    await fs.writeFile(result.filePath, payload.content, 'utf8')

    return {
      canceled: false,
      filePath: result.filePath,
    }
  }
}
