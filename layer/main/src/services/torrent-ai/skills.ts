import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import agentBrowserSkill from './skills/agent-browser/SKILL.md?raw'

export type SkillMeta = { name: string, description: string, dir: string }

const builtinContents = new Map<string, string>([
  ['agent-browser', agentBrowserSkill],
])

function parseFrontmatterField(frontmatter: string, field: string): string {
  const lines = frontmatter.split('\n')
  const startIdx = lines.findIndex(line => line.startsWith(`${field}:`))
  if (startIdx === -1) {
    return ''
  }

  const firstLine = lines[startIdx].slice(field.length + 1).trim()
  if (firstLine === '>' || firstLine === '|') {
    const parts: string[] = []
    for (let i = startIdx + 1; i < lines.length; i++) {
      const line = lines[i]
      if (line === '' || !/^\s/.test(line)) {
        break
      }
      parts.push(line.trim())
    }
    return parts.join(' ')
  }
  return firstLine
}

function parseSkillMd(
  content: string,
): { name: string, description: string } | null {
  if (!content.startsWith('---')) {
    return null
  }
  const end = content.indexOf('\n---', 3)
  if (end === -1) {
    return null
  }
  const frontmatter = content.slice(3, end).replace(/^\n/, '')

  const name = parseFrontmatterField(frontmatter, 'name')
  if (!name) {
    return null
  }
  const description = parseFrontmatterField(frontmatter, 'description')
  return { name, description }
}

export const torrentAiSkillDirs = (): string[] => {
  const here = dirname(fileURLToPath(import.meta.url))
  return [resolve(here, 'skills')]
}

export function loadSkillIndex(
  dirs: string[] = torrentAiSkillDirs(),
): SkillMeta[] {
  const result: SkillMeta[] = []
  const seen = new Set<string>()
  const packagedRoot = torrentAiSkillDirs()[0]

  for (const [name, content] of builtinContents) {
    const parsed = parseSkillMd(content)
    if (!parsed) {
      continue
    }
    seen.add(name)
    result.push({
      name: parsed.name,
      description: parsed.description,
      dir: join(packagedRoot, name),
    })
  }

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      continue
    }
    for (const entry of readdirSync(dir)) {
      const entryDir = resolve(join(dir, entry))
      if (!statSync(entryDir).isDirectory()) {
        continue
      }
      const skillPath = join(entryDir, 'SKILL.md')
      if (!existsSync(skillPath)) {
        continue
      }

      const parsed = parseSkillMd(readFileSync(skillPath, 'utf8'))
      if (!parsed) {
        continue
      }
      if (seen.has(parsed.name)) {
        continue
      }
      seen.add(parsed.name)
      result.push({
        name: parsed.name,
        description: parsed.description,
        dir: entryDir,
      })
    }
  }

  return result.sort((a, b) => a.name.localeCompare(b.name))
}

export function readSkill(index: SkillMeta[], name: string): string | null {
  const meta = index.find(s => s.name === name)
  if (meta) {
    const skillPath = join(meta.dir, 'SKILL.md')
    if (existsSync(skillPath)) {
      return readFileSync(skillPath, 'utf8')
    }
  }
  return builtinContents.get(name) ?? null
}

export const escapeXml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&apos;')

export function renderAvailableSkillsXml(index: SkillMeta[]): string {
  if (index.length === 0) {
    return ''
  }
  const lines = [
    '<available_skills>',
    'The following lists every project skill. Each description explains its purpose and when to use it.',
  ]
  for (const skill of index) {
    const location = join(skill.dir, 'SKILL.md')
    lines.push(
      `  <skill name="${escapeXml(skill.name)}" status="available" location="${escapeXml(location)}">`,
      `    <description>${escapeXml(skill.description)}</description>`,
      `    <invoke>read_skill(name="${escapeXml(skill.name)}")</invoke>`,
      '  </skill>',
    )
  }
  lines.push('</available_skills>')
  return lines.join('\n')
}
