import en from '@locales/native/en.json'
import zhCn from '@locales/native/zh-CN.json'

import type { MainSupportedLanguages, ns } from './constants'

export const resources = {
  en: {
    native: en,
  },
  'zh-CN': {
    native: zhCn,
  },
} satisfies Record<
  MainSupportedLanguages,
  Record<(typeof ns)[number], Record<string, string>>
>
