import { spawn } from 'node:child_process'
import { existsSync, statSync, watch } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(projectRoot, 'package.json'))
const electronBin = require('electron')

const MAIN_BUNDLE = join(projectRoot, 'dist', 'main', 'index.js')
const PRELOAD_BUNDLE = join(projectRoot, 'dist', 'preload', 'index.cjs')

let electron = null
let restarting = false
let shuttingDown = false

const npx = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

const renderer = spawn(
  npx,
  [
    'exec',
    'vite',
    '--config',
    'vite.config.electron.ts',
    '--port',
    '5173',
    '--strictPort',
  ],
  { cwd: projectRoot, stdio: 'inherit' },
)
renderer.on('exit', (code) => {
  if (!shuttingDown) { shutdown(code ?? 1) }
})

const tsdown = spawn(npx, ['exec', 'tsdown', '--watch'], {
  cwd: projectRoot,
  stdio: 'inherit',
})
tsdown.on('exit', (code) => {
  if (!shuttingDown) { shutdown(code ?? 1) }
})

function shutdown(code) {
  if (shuttingDown) { return }
  shuttingDown = true
  electron?.kill()
  tsdown.kill()
  renderer.kill()
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

function startElectron() {
  electron = spawn(electronBin, ['.'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development', ELECTRON_DEV: '1' },
  })
  electron.on('exit', (code) => {
    if (shuttingDown) { return }
    if (restarting) {
      restarting = false
      startElectron()
      return
    }
    console.log('[electron-dev] electron exited, stopping dev watcher')
    shutdown(code ?? 0)
  })
}

let debounce = null
function scheduleRestart() {
  clearTimeout(debounce)
  debounce = setTimeout(() => {
    if (shuttingDown || !electron) { return }
    console.log('[electron-dev] bundle changed, restarting electron')
    restarting = true
    electron.kill()
  }, 400)
}

function watchBundles() {
  for (const dir of [dirname(MAIN_BUNDLE), dirname(PRELOAD_BUNDLE)]) {
    watch(dir, scheduleRestart)
  }
}

const started = Date.now()
let lastChange = Date.now()
let lastSignature = ''
const poll = setInterval(() => {
  if (Date.now() - started > 60_000) {
    console.error(
      '[electron-dev] initial build did not produce bundles within 60s',
    )
    shutdown(1)
    return
  }
  if (!existsSync(MAIN_BUNDLE) || !existsSync(PRELOAD_BUNDLE)) { return }
  const signature = [MAIN_BUNDLE, PRELOAD_BUNDLE]
    .map(f => statSync(f).mtimeMs)
    .join(':')
  if (signature !== lastSignature) {
    lastSignature = signature
    lastChange = Date.now()
    return
  }
  if (Date.now() - lastChange < 1_000) { return }
  clearInterval(poll)
  watchBundles()
  startElectron()
}, 200)
