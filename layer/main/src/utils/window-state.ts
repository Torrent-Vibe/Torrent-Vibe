import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type { BrowserWindow } from 'electron'
import { app, screen } from 'electron'

interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

interface WindowStateData extends WindowBounds {
  isMaximized?: boolean
}

interface RestoreOptions {
  defaultWidth: number
  defaultHeight: number
  minWidth?: number
  minHeight?: number
}

const getStateFile = (name?: string) =>
  join(
    app.getPath('userData'),
    name ? `${name}-window-state.json` : 'window-state.json',
  )

function readState(name?: string): WindowStateData | null {
  try {
    const file = getStateFile(name)
    if (!existsSync(file)) return null
    const raw = readFileSync(file, 'utf-8')
    const data = JSON.parse(raw) as WindowStateData
    if (
      typeof data.x === 'number' &&
      typeof data.y === 'number' &&
      typeof data.width === 'number' &&
      typeof data.height === 'number'
    ) {
      return data
    }
  } catch {
    // ignore corrupted state
  }
  return null
}

function writeState(state: WindowStateData, name?: string) {
  try {
    const file = getStateFile(name)
    writeFileSync(file, JSON.stringify(state))
  } catch {
    // ignore write errors
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function ensureVisible(
  bounds: WindowBounds,
  opts: RestoreOptions,
): WindowBounds {
  // Find the nearest display to the window center
  const center = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  }
  const display = screen.getDisplayNearestPoint(center)
  const area = display.workArea // use workArea to avoid taskbars/docks

  // Ensure size is within the work area (respect min sizes if provided)
  const minW = Math.max(100, opts.minWidth ?? 100)
  const minH = Math.max(100, opts.minHeight ?? 100)
  const width = clamp(Math.floor(bounds.width), minW, area.width)
  const height = clamp(Math.floor(bounds.height), minH, area.height)

  // Adjust position to keep the window fully within the work area
  const x = clamp(Math.floor(bounds.x), area.x, area.x + area.width - width)
  const y = clamp(Math.floor(bounds.y), area.y, area.y + area.height - height)

  return { x, y, width, height }
}

export function restoreWindowState(options: RestoreOptions): {
  bounds: WindowBounds
  isMaximized: boolean
} {
  const saved = readState()
  if (!saved) {
    // Center defaults on the primary display's work area
    const area = screen.getPrimaryDisplay().workArea
    const width = clamp(Math.floor(options.defaultWidth), 100, area.width)
    const height = clamp(Math.floor(options.defaultHeight), 100, area.height)
    const x = area.x + Math.floor((area.width - width) / 2)
    const y = area.y + Math.floor((area.height - height) / 2)
    return { bounds: { x, y, width, height }, isMaximized: false }
  }

  const safe = ensureVisible(saved, options)
  return { bounds: safe, isMaximized: !!saved.isMaximized }
}

export function trackWindowState(win: BrowserWindow, opts: RestoreOptions) {
  // Debounced writer
  let writeTimer: NodeJS.Timeout | null = null
  const scheduleWrite = (state: WindowStateData) => {
    if (writeTimer) clearTimeout(writeTimer)
    writeTimer = setTimeout(() => writeState(state), 150)
  }

  const writeCurrent = () => {
    if (win.isDestroyed()) return
    // Only persist normal bounds (not minimized/maximized/fullscreen)
    const isMaximized = win.isMaximized()
    const isFull = win.isFullScreen()
    const isMin = win.isMinimized()
    let bounds = win.getBounds()
    if (!isMaximized && !isFull && !isMin) {
      // sanitize before storing
      bounds = ensureVisible(bounds, opts)
    }
    scheduleWrite({ ...bounds, isMaximized })
  }

  win.on('resize', writeCurrent)
  win.on('move', writeCurrent)
  win.on('maximize', writeCurrent)
  win.on('unmaximize', writeCurrent)
  win.on('close', writeCurrent)
}

// Named variants for multiple windows (e.g., 'float')
export function restoreNamedWindowState(
  name: string,
  options: RestoreOptions,
): {
  bounds: WindowBounds
  isMaximized: boolean
} {
  const saved = readState(name)
  if (!saved) {
    const area = screen.getPrimaryDisplay().workArea
    const width = clamp(Math.floor(options.defaultWidth), 100, area.width)
    const height = clamp(Math.floor(options.defaultHeight), 100, area.height)
    const x = area.x + Math.floor((area.width - width) / 2)
    const y = area.y + Math.floor((area.height - height) / 2)
    return { bounds: { x, y, width, height }, isMaximized: false }
  }
  const safe = ensureVisible(saved, options)
  return { bounds: safe, isMaximized: !!saved.isMaximized }
}

export function trackNamedWindowState(
  win: BrowserWindow,
  name: string,
  opts: RestoreOptions,
) {
  let writeTimer: NodeJS.Timeout | null = null
  const scheduleWrite = (state: WindowStateData) => {
    if (writeTimer) clearTimeout(writeTimer)
    writeTimer = setTimeout(() => writeState(state, name), 150)
  }

  const writeCurrent = () => {
    if (win.isDestroyed()) return
    const isMaximized = win.isMaximized()
    const isFull = win.isFullScreen()
    const isMin = win.isMinimized()
    let bounds = win.getBounds()
    if (!isMaximized && !isFull && !isMin) {
      bounds = ensureVisible(bounds, opts)
    }
    scheduleWrite({ ...bounds, isMaximized })
  }

  win.on('resize', writeCurrent)
  win.on('move', writeCurrent)
  win.on('maximize', writeCurrent)
  win.on('unmaximize', writeCurrent)
  win.on('close', writeCurrent)
}

export type { RestoreOptions,WindowBounds }
