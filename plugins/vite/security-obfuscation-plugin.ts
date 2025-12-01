import type { ObfuscatorOptions } from 'javascript-obfuscator'
import type { Plugin } from 'vite'

/**
 * Security obfuscation plugin
 * - No-op unless `process.env.SECURITY_OBFUSCATION === '1'`
 * - Gracefully degrades if `javascript-obfuscator` is not installed
 * - Does NOT apply in development
 */
export interface SecurityObfuscationOptions {
  include?: (fileName: string) => boolean
  obfuscator?: ObfuscatorOptions
}

export function securityObfuscationPlugin(
  options: SecurityObfuscationOptions = {},
): Plugin {
  const shouldEnable =
    process.env.NODE_ENV === 'production' &&
    process.env.SECURITY_OBFUSCATION === '1'

  return {
    name: 'security-obfuscation',
    apply: 'build',
    enforce: 'post',
    async generateBundle(_buildOptions, bundle) {
      if (!shouldEnable) return

      let obfuscate:
        | undefined
        | ((
            code: string,
            opts: ObfuscatorOptions,
          ) => { getObfuscatedCode: () => string })
      try {
        const mod = await import('javascript-obfuscator')
        obfuscate = (mod?.default?.obfuscate ?? mod?.obfuscate) as any
        if (typeof obfuscate !== 'function') {
          console.warn(
            '[security-obfuscation] Could not load obfuscate() from javascript-obfuscator. Skipping.',
          )
          return
        }
        console.info(
          '[security-obfuscation] javascript-obfuscator loaded: enabling protection',
        )
      } catch {
        console.warn(
          '[security-obfuscation] javascript-obfuscator not installed. Plugin will be a no-op.',
        )
        return
      }

      const shouldInclude = options.include ?? ((file) => file.endsWith('.js'))

      for (const fileName of Object.keys(bundle)) {
        const chunk = bundle[fileName]
        if (chunk.type !== 'chunk') continue
        if (!shouldInclude(fileName)) continue

        try {
          const result = obfuscate(chunk.code, {
            // 输出紧凑与否对速度影响小，可按需设置
            compact: true,

            // 标识符重命名：简单且速度快
            identifierNamesGenerator: 'hexadecimal', // 'hex' 或 'mangled'（通常都快）

            // 只启用字符串数组混淆（对硬编码字符串生效）
            stringArray: true,
            stringArrayThreshold: 1, // 1 表示尽可能把字符串放到数组里
            stringArrayEncoding: [], // 禁用额外编码（如 base64），节省时间
            stringArrayIndexesType: ['hexadecimal-number'], // 可选，影响编码表现但速度快

            // 关闭昂贵的转换（节省大量时间）
            controlFlowFlattening: false,
            deadCodeInjection: false,
            debugProtection: false,
            debugProtectionInterval: 0,
            transformObjectKeys: false, // 关闭对象键名变换 —— 昂贵且通常不需要
            stringArrayShuffle: false, // 关闭洗牌（耗时）
            stringArrayRotate: false, // 关闭旋转（耗时）

            // 其它可能影响性能的也关闭
            rotateStringArray: false,
            unicodeEscapeSequence: false,

            ...options.obfuscator,
          })
          ;(chunk as any).code = result.getObfuscatedCode()

          console.info(`[security-obfuscation] Obfuscated: ${fileName}`)
        } catch (err) {
          console.warn(
            `[security-obfuscation] Failed to obfuscate ${fileName}:`,
            err,
          )
        }
      }
    },
  }
}
