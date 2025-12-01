import en from '@locales/app/en.json'
import zhCn from '@locales/app/zh-CN.json'
import settingEn from '@locales/setting/en.json'
import settingZhCn from '@locales/setting/zh-CN.json'

import type { MainSupportedLanguages, ns } from './constants'

export const resources = {
  en: {
    app: en,
    setting: settingEn,
  },
  'zh-CN': {
    app: zhCn,
    setting: settingZhCn,
  },
} satisfies Record<MainSupportedLanguages, Record<(typeof ns)[number], any>>
