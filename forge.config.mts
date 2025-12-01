import { execSync } from 'node:child_process'
import fs, { readdirSync, renameSync, statSync } from 'node:fs'
import { cp, readdir } from 'node:fs/promises'

import { FuseV1Options, FuseVersion } from '@electron/fuses'
import { MakerSquirrel } from '@electron-forge/maker-squirrel'
import { MakerZIP } from '@electron-forge/maker-zip'
import { FusesPlugin } from '@electron-forge/plugin-fuses'
import type { ForgeConfig } from '@electron-forge/shared-types'
import MakerAppImage from '@pengx17/electron-forge-maker-appimage'
import setLanguages from 'electron-packager-languages'
import path, { resolve } from 'pathe'
import { rimraf, rimrafSync } from 'rimraf'

import generateMetadata, {
  collectArtifacts as collectUpdaterArtifacts,
} from './scripts/generate-electron-metadata.js'
import { computeMainHashFromRoots } from './scripts/lib/main-hash.js'

const platform = process.argv
  .find((arg) => arg.startsWith('--platform'))
  ?.split('=')[1]

const keepModules = new Set<string>(['sqlite3'])
const keepLanguages = new Set(['en', 'en_GB', 'en-US', 'en_US'])

/**
 * 递归收集模块及其依赖
 * @param moduleName 模块名称
 * @param rootPath 根路径
 * @param collected 已收集的模块集合
 * @param visited 已访问的模块集合（防止循环依赖）
 */
function collectModuleDependencies(
  moduleName: string,
  rootPath: string,
  collected = new Set<string>(),
  visited = new Set<string>(),
): Set<string> {
  // 防止循环依赖
  if (visited.has(moduleName)) {
    return collected
  }
  visited.add(moduleName)

  const modulePath = path.join(rootPath, 'node_modules', moduleName)
  const packageJsonPath = path.join(modulePath, 'package.json')

  // 如果模块不存在或没有 package.json，跳过
  if (!fs.existsSync(packageJsonPath)) {
    return collected
  }

  // 添加当前模块到收集集合
  collected.add(moduleName)

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    const dependencies = {
      ...packageJson.dependencies,
    }

    // 递归收集依赖
    for (const depName of Object.keys(dependencies || {})) {
      collectModuleDependencies(depName, rootPath, collected, visited)
    }
  } catch (error) {
    console.warn(`Failed to read package.json for ${moduleName}:`, error)
  }

  return collected
}

// remove folders & files not to be included in the app
async function cleanSources(
  buildPath,
  _electronVersion,
  platform,
  _arch,
  callback,
) {
  // folders & files to be included in the app
  const appItems = new Set([
    'dist',
    'node_modules',
    'package.json',
    'resources',
  ])

  if (platform === 'darwin' || platform === 'mas') {
    const frameworkResourcePath = resolve(
      buildPath,
      '../../Frameworks/Electron Framework.framework/Versions/A/Resources',
    )

    for (const file of readdirSync(frameworkResourcePath)) {
      if (file.endsWith('.lproj') && !keepLanguages.has(file.split('.')[0]!)) {
        rimrafSync(resolve(frameworkResourcePath, file))
      }
    }
  }

  // 收集所有需要保留的模块（包括递归依赖）
  const allModulesToKeep = new Set<string>()

  // 为每个基础模块收集其递归依赖
  for (const moduleName of keepModules) {
    const moduleDeps = collectModuleDependencies(moduleName, process.cwd())
    for (const dep of moduleDeps) {
      allModulesToKeep.add(dep)
    }
  }

  console.info(
    `[forge] Keeping ${allModulesToKeep.size} modules (including dependencies):`,
    Array.from(allModulesToKeep).sort(),
  )

  // Keep only node_modules to be included in the app
  await Promise.all([
    ...(await readdir(buildPath).then((items) =>
      items
        .filter((item) => !appItems.has(item))
        .map((item) => rimraf(path.join(buildPath, item))),
    )),
    ...(await readdir(path.join(buildPath, 'node_modules')).then((items) =>
      items
        .filter((item) => !allModulesToKeep.has(item))
        .map((item) => rimraf(path.join(buildPath, 'node_modules', item))),
    )),
  ])

  // copy needed node_modules to be included in the app
  await Promise.all(
    Array.from(allModulesToKeep.values()).map((item) => {
      // Check is exist
      if (fs.existsSync(path.join(buildPath, 'node_modules', item))) {
        // eslint-disable-next-line array-callback-return
        return
      }
      return cp(
        path.join(process.cwd(), 'node_modules', item),
        path.join(buildPath, 'node_modules', item),
        {
          recursive: true,
        },
      )
    }),
  )

  callback()
}
const injectMainHashAfterCopy = async (
  buildPath,
  _electronVersion,
  _platform,
  _arch,
  callback,
) => {
  try {
    const mainDir = path.join(buildPath, 'dist', 'main')
    const preloadDir = path.join(buildPath, 'dist', 'preload')
    const mainHash = computeMainHashFromRoots([mainDir, preloadDir], buildPath)

    if (!mainHash) {
      // No compiled main/preload found; skip
      return callback()
    }
    const pkgPath = path.join(buildPath, 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    pkg.mainHash = mainHash

    console.info('[forge] injectMainHashAfterCopy', mainHash)
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))
  } catch (e) {
    console.warn('[forge] injectMainHashAfterCopy failed:', e)
  } finally {
    callback()
  }
}

const noopAfterCopy = (
  _buildPath,
  _electronVersion,
  _platform,
  _arch,
  callback,
) => callback()

// 创建动态的忽略模式函数
function createIgnorePattern(modulesToKeep: Set<string>): RegExp {
  return new RegExp(`^/node_modules/(?!${[...modulesToKeep].join('|')})`)
}

// 默认的忽略模式（用于初始化）
const ignorePattern = createIgnorePattern(keepModules)

/**
 * Convert arbitrary version strings (e.g., Git tags like "v20250908155358") into a Windows-friendly
 * dotted numeric file version: A.B.C.D, where each component is an integer within 0..65535.
 *
 * Examples:
 * - "v20250908155358" -> "2025.9.8.1553"
 * - "1.2.3" -> "1.2.3.0"
 */
function toFileVersion(input?: string): string | undefined {
  if (!input) return undefined
  let cleaned = input.trim()
  if (cleaned.startsWith('v') || cleaned.startsWith('V'))
    cleaned = cleaned.slice(1)

  // If already dotted numeric, clamp and pad to 4 parts
  const dotted = cleaned.split('.')
  if (dotted.length > 1 && dotted.every((p) => /^\d+$/.test(p))) {
    const nums = dotted
      .slice(0, 4)
      .map((n) => Math.min(Number.parseInt(n, 10) || 0, 65535))
    while (nums.length < 4) nums.push(0)
    return nums.join('.')
  }

  // Try to parse YYYYMMDDHHMMSS-like numeric timestamps
  const match = cleaned.match(/\d+/g)
  const digits = match ? match.join('') : ''
  if (digits.length >= 8) {
    const year = Math.min(Number.parseInt(digits.slice(0, 4), 10) || 0, 65535)
    const month = Math.min(
      Number.parseInt(digits.slice(4, 6) || '0', 10) || 0,
      65535,
    )
    const day = Math.min(
      Number.parseInt(digits.slice(6, 8) || '0', 10) || 0,
      65535,
    )
    const hour = Number.parseInt(digits.slice(8, 10) || '0', 10) || 0
    const minute = Number.parseInt(digits.slice(10, 12) || '0', 10) || 0
    const hhmm = Math.min(hour * 100 + minute, 65535)
    return [year, month, day, hhmm].join('.')
  }

  // Fallback: put whatever digits we have into A.B.C.D
  const a = Math.min(Number.parseInt(digits.slice(0, 4) || '0', 10) || 0, 65535)
  const b = Math.min(Number.parseInt(digits.slice(4, 6) || '0', 10) || 0, 65535)
  const c = Math.min(Number.parseInt(digits.slice(6, 8) || '0', 10) || 0, 65535)
  const d = Math.min(
    Number.parseInt(digits.slice(8, 12) || '0', 10) || 0,
    65535,
  )
  if (a + b + c + d === 0) return undefined
  return [a, b, c, d].join('.')
}

const inputVersion = process.env.APP_VERSION || process.env.BUILD_VERSION
const fileVersion = toFileVersion(inputVersion)

const config: ForgeConfig = {
  packagerConfig: {
    name: 'Torrent Vibe',
    appCategoryType: 'public.app-category.utilities',
    buildVersion: fileVersion,
    appVersion: fileVersion,
    appBundleId: 'dev.innei.torrentvibe.client',
    icon: 'resources/icon',
    extraResource: [
      './resources/app-update.yml',
    ],
    protocols: [
      {
        name: 'Magnet Link',
        schemes: ['magnet'],
      },
    ],

    afterCopy: [
      injectMainHashAfterCopy,
      cleanSources,
      process.platform !== 'win32'
        ? noopAfterCopy
        : setLanguages([...keepLanguages.values()]),
    ],
    asar: {
      // Unpack native binaries so Electron can load them from app.asar.unpacked
      unpack: '**/*.{node,dylib,so}',
    },
    ignore: [ignorePattern],

    prune: true,
    extendInfo: {
      ITSAppUsesNonExemptEncryption: false,
      // Declare .torrent file associations for macOS
      // 1) 导入 .torrent -> org.bittorrent.torrent 的映射
      UTImportedTypeDeclarations: [
        {
          UTTypeIdentifier: 'org.bittorrent.torrent',
          UTTypeDescription: 'BitTorrent Document',
          UTTypeConformsTo: ['public.data'],
          UTTypeTagSpecification: {
            'public.filename-extension': ['torrent'],
            'public.mime-type': 'application/x-bittorrent',
          },
        },
      ],

      // 2) 声明应用支持该类型
      CFBundleDocumentTypes: [
        {
          CFBundleTypeName: 'BitTorrent Document', // Finder “种类/Kind”里的人类可读名称
          LSItemContentTypes: ['org.bittorrent.torrent'], // 用上面导入的稳定 UTI
          CFBundleTypeRole: 'Viewer',
          // 想强制接管默认打开方式可用 'Owner'；更温和就用 'Default'
          LSHandlerRank: 'Owner',
        },
      ],
    },
    // Notarization moved later to avoid modifying bundle after notarize
    // (we add app.asar.sig post-package, then re-sign bundle here).
  },
  rebuildConfig: {},
  makers: [
    new MakerZIP({}, ['darwin']),
    // @ts-expect-error
    // eslint-disable-next-line new-cap
    new MakerAppImage.default({
      config: {
        // 自定义输出文件名使用 fileVersion
        outputFilename: fileVersion
          ? `Torrent.Vibe-${fileVersion}-linux.AppImage`
          : undefined,
        icons: [
          {
            file: 'resources/icon.png',
            size: 256,
          },
        ],
        // Desktop integration for Linux
        desktop: {
          Name: 'Torrent Vibe',
          Comment: 'A modern qBittorrent Web UI client',
          Categories: 'Network;FileTransfer;P2P;',
          Keywords: 'torrent;bittorrent;p2p;download;',
          MimeType: 'application/x-bittorrent;',
          StartupNotify: 'true',
          Terminal: 'false',
          Type: 'Application',
        },
      },
    } as any),

    // new MakerAppImage({}, ['linux']), // Temporarily commented out due to import issues
    new MakerSquirrel(
      {
        name: 'TorrentVibe',

        setupIcon: 'resources/icon.ico',
        iconUrl: 'https://qb.innei.dev/favicon.ico',
        authors: 'Innei',
        setupExe: `Torrent.Vibe-${fileVersion}-Setup.exe`,
        description:
          'A modern qBittorrent Web UI client with beautiful interface and powerful features',
      },
      ['win32'],
    ),
  ],
  plugins: [
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'Torrent-Vibe',
          name: 'Torrent-Vibe',
        },
        draft: true,
      },
    },
  ],
  hooks: {
    postMake: async (_config, makeResults) => {
      if (!fileVersion) return makeResults

      const newResults = makeResults.map((result) => ({
        ...result,
        artifacts: result.artifacts.map((artifact) => {
          const oldPath = artifact
          const dir = path.dirname(oldPath)

          const arch = result.arch || 'unknown'

          let platformArch = ''

          switch (result.platform) {
            case 'darwin': {
              platformArch = `macos-${arch}`
              break
            }
            case 'linux': {
              platformArch = `linux-${arch}`
              break
            }
            case 'win32': {
              platformArch = `windows-${arch}`
              break
            }
            default: {
              platformArch = result.platform
              break
            }
          }

          let newName: string
          if (oldPath.includes('.dmg')) {
            newName = `Torrent.Vibe-${fileVersion}-${platformArch}.dmg`
          } else if (oldPath.includes('.zip') && result.platform === 'darwin') {
            newName = `Torrent.Vibe-${fileVersion}-${platformArch}.zip`
          } else if (oldPath.includes('.AppImage')) {
            newName = `Torrent.Vibe-${fileVersion}-${platformArch}.AppImage`
          } else if (oldPath.includes('.pkg')) {
            newName = `Torrent.Vibe-${fileVersion}-mas-${arch}.pkg`
          } else if (oldPath.includes('.exe')) {
            newName = `Torrent.Vibe-${fileVersion}-${platformArch}.exe`
          } else {
            return artifact
          }

          const newPath = path.join(dir, newName)
          renameSync(oldPath, newPath)

          console.info(
            `[forge] Renamed: ${path.basename(oldPath)} -> ${newName}`,
          )

          return newPath
        }),
      }))

      console.info(`[forge] New results:`, newResults)

      try {
        const fromResults = collectMetadataEntries(makeResults)
        const fromOutDir = collectUpdaterArtifacts(
          path.join(process.cwd(), 'out', 'make'),
        )
        const combined = dedupeArtifacts([...fromResults, ...fromOutDir])
        if (combined.length > 0) {
          generateMetadata({
            version: fileVersion,
            releaseDate: new Date().toISOString(),
            entries: combined,
          })
        }
      } catch (e) {
        console.warn('[forge] Failed to generate electron-updater metadata:', e)
      }

      return newResults
    },
  },
}

function collectMetadataEntries(makeResults: any[]) {
  const entries: { platform: string; arch: string; path: string }[] = []

  for (const result of makeResults) {
    for (const artifact of result.artifacts) {
      const ext = path.extname(artifact).toLowerCase()
      const { platform } = result
      const arch = result.arch || detectArchFromPath(artifact)
      if (!platform || !arch) continue

      if (platform === 'win32' && ext === '.exe') {
        entries.push({ platform, arch, path: artifact })
      }

      if (platform === 'linux' && ext === '.appimage') {
        entries.push({ platform, arch, path: artifact })
      }

      if (platform === 'darwin' && ext === '.zip') {
        const actualZip = findLatestZip(path.dirname(artifact))
        if (actualZip) {
          entries.push({ platform, arch, path: actualZip })
        }
      }
    }
  }

  return entries
}

function dedupeArtifacts(
  entries: { platform: string; arch: string; path: string }[],
) {
  const seen = new Set<string>()
  const unique: typeof entries = []
  for (const entry of entries) {
    if (!entry) continue
    const key = `${entry.platform}:${entry.arch}:${entry.path}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(entry)
  }
  return unique
}

function detectArchFromPath(p: string) {
  const match = p.match(/-(arm64|x64|ia32|aarch64|amd64)/i)
  if (match) return match[1].toLowerCase()
  return 'x64'
}

function findLatestZip(dir: string) {
  try {
    const zips = fs
      .readdirSync(dir)
      .filter((name) => name.toLowerCase().endsWith('.zip'))
      .map((name) => ({
        name,
        mtime: statSync(path.join(dir, name)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime)
    return zips[0] ? path.join(dir, zips[0].name) : undefined
  } catch {
    return
  }
}

export default config
