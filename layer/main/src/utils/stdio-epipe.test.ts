import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { describe, expect, it } from 'vitest'

const guardUrl = pathToFileURL(
  fileURLToPath(new URL('./stdio-epipe.ts', import.meta.url)),
).href

async function runChild(installGuard: boolean) {
  const source = `
    ${installGuard ? `import { installStdioEpipeGuard } from ${JSON.stringify(guardUrl)}; installStdioEpipeGuard()` : ''}
    process.on('uncaughtException', (error) => {
      process.stderr.write('UNCAUGHT ' + error.code + '\\n')
      process.exit(2)
    })
    const timer = setInterval(() => {
      console.info('tick')
    }, 15)
    setTimeout(() => {
      clearInterval(timer)
      process.exit(0)
    }, 350)
  `
  const child = spawn(
    process.execPath,
    ['--experimental-strip-types', '--input-type=module', '-e', source],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )
  let stderr = ''
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk) => {
    stderr += chunk
  })
  await new Promise(resolve => setTimeout(resolve, 60))
  child.stdout.destroy()
  const [code] = await once(child, 'exit')
  return { code, stderr }
}

describe('installStdioEpipeGuard', () => {
  it('console.info after stdout pipe closes is uncaught without a guard', async () => {
    const { code, stderr } = await runChild(false)
    expect(code).toBe(2)
    expect(stderr).toMatch(/UNCAUGHT EPIPE/)
  })

  it('console.info after stdout pipe closes does not crash with the guard', async () => {
    const { code, stderr } = await runChild(true)
    expect(code, stderr).toBe(0)
    expect(stderr).not.toMatch(/UNCAUGHT/)
  })
})
