const VIDEO_EXT = new Set([
  '.mkv',
  '.mp4',
  '.avi',
  '.ts',
  '.m2ts',
  '.mts',
  '.webm',
  '.mov',
  '.wmv',
  '.flv',
])

const SUB_EXT = new Set([
  '.srt',
  '.ass',
  '.ssa',
  '.sub',
  '.vtt',
  '.idx',
  '.sup',
])

const EXTRA_TOKEN = /(?:^|[\\/._\-\s])(?:sample|ncop|nced)(?:[\\/._\-\s]|$)/i

export function formatEpisodeName(
  title: string,
  season: number,
  episode: number,
): string {
  return `${title} - S${pad2(season)}E${pad2(episode)}`
}

export function formatSavePath(
  libraryRoot: string,
  title: string,
  season: number,
): string {
  const seasonDir = `Season ${pad2(season)}`
  const safeTitle = sanitizePathSegment(title)
  if (!libraryRoot) {
    return `${safeTitle}/${seasonDir}`
  }
  const sep
    = libraryRoot.includes('\\') && !libraryRoot.includes('/') ? '\\' : '/'
  return `${trimSlash(libraryRoot)}${sep}${safeTitle}${sep}${seasonDir}`
}

export function isSkippedExtra(filePath: string): boolean {
  return filePath.split(/[/\\]/).some(part => EXTRA_TOKEN.test(part))
}

export function planEpisodeRenames(input: {
  displayName: string
  files: Array<{ name: string, size: number }>
}): Array<{ from: string, to: string }> {
  const usable = input.files.filter(file => !isSkippedExtra(file.name))
  const videos = usable.filter(file => VIDEO_EXT.has(extname(file.name)))
  if (videos.length === 0) {
    return []
  }

  const primary = videos.reduce((best, file) =>
    file.size > best.size ? file : best)
  const primaryStem = stem(primary.name)
  const dir = dirname(primary.name)
  const plans: Array<{ from: string, to: string }> = []

  const videoTo = joinDir(dir, `${input.displayName}${extname(primary.name)}`)
  if (primary.name !== videoTo) {
    plans.push({ from: primary.name, to: videoTo })
  }

  for (const file of usable) {
    if (!SUB_EXT.has(extname(file.name))) {
      continue
    }
    const subStem = stem(file.name)
    if (subStem !== primaryStem && !subStem.startsWith(primaryStem)) {
      continue
    }
    const extra = subStem.slice(primaryStem.length)
    const subTo = joinDir(
      dir,
      `${input.displayName}${extra}${extname(file.name)}`,
    )
    if (file.name !== subTo) {
      plans.push({ from: file.name, to: subTo })
    }
  }

  return plans
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function sanitizePathSegment(name: string): string {
  return name.replaceAll(/[\\/:*?"<>|]/g, '_').trim()
}

function trimSlash(path: string): string {
  return path.replace(/[/\\]+$/, '')
}

function extname(filePath: string): string {
  const base = basename(filePath)
  const index = base.lastIndexOf('.')
  return index >= 0 ? base.slice(index).toLowerCase() : ''
}

function basename(filePath: string): string {
  const index = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return index >= 0 ? filePath.slice(index + 1) : filePath
}

function dirname(filePath: string): string {
  const index = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return index >= 0 ? filePath.slice(0, index) : ''
}

function stem(filePath: string): string {
  const base = basename(filePath)
  const index = base.lastIndexOf('.')
  return index >= 0 ? base.slice(0, index) : base
}

function joinDir(dir: string, name: string): string {
  if (!dir) {
    return name
  }
  const sep = dir.includes('\\') && !dir.includes('/') ? '\\' : '/'
  return `${dir}${sep}${name}`
}
