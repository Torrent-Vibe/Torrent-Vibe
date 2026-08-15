import { exec as nodeExec } from 'node:child_process'
import { homedir } from 'node:os'
import { dirname } from 'node:path'
import { promisify } from 'node:util'

import type { AgentTool, AgentToolResult } from '@earendil-works/pi-agent-core'
import { Type } from '@earendil-works/pi-ai'

import { detectAgentBrowserCli } from '~/manager/agent-browser-manager'

const nodeExecAsync = promisify(nodeExec)
const OUTPUT_TRUNCATE_CHARS = 30_000
const BASH_TIMEOUT_MS = 120_000
const BASH_MAX_BUFFER = 10 * 1024 * 1024
const REJECTED_PATTERNS = [/>>?/, /\btee\s/, /\brm\s/, /\bmv\s/, /\bcp\s/]

const bashSchema = Type.Object({ command: Type.String() })

const textResult = (text: string): AgentToolResult<Record<string, never>> => ({
  content: [{ type: 'text', text }],
  details: {},
})

const truncateOutput = (text: string): string => {
  if (text.length <= OUTPUT_TRUNCATE_CHARS) {
    return text
  }
  return `${text.slice(0, OUTPUT_TRUNCATE_CHARS)}\n...[truncated]`
}

const resolveExecPath = (): string => {
  const extra: string[] = []
  const agentBrowser = detectAgentBrowserCli()
  if (agentBrowser) {
    extra.push(dirname(agentBrowser))
  }
  const current = process.env.PATH ?? ''
  return extra.length > 0 ? `${extra.join(':')}:${current}` : current
}

export function buildBashTool(): AgentTool<typeof bashSchema> {
  return {
    name: 'bash',
    label: 'Bash',
    description:
      'Run a shell command. Use this to follow skill instructions such as agent-browser. Do not write, move, or delete files.',
    parameters: bashSchema,
    execute: async (_id, params) => {
      const command = params.command.trim()
      if (!command) {
        return textResult('rejected: empty command')
      }
      if (REJECTED_PATTERNS.some(re => re.test(command))) {
        return textResult(
          `rejected: command "${command}" matches a disallowed write pattern`,
        )
      }
      try {
        const { stdout, stderr } = await nodeExecAsync(command, {
          cwd: homedir(),
          timeout: BASH_TIMEOUT_MS,
          maxBuffer: BASH_MAX_BUFFER,
          env: { ...process.env, PATH: resolveExecPath() },
        })
        return textResult(
          truncateOutput(`${stdout}${stderr ? `\n[stderr]\n${stderr}` : ''}`),
        )
      }
      catch (error) {
        return textResult(
          `command failed: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    },
  }
}
