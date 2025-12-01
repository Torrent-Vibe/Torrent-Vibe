const langs = ['en', 'zh-CN'] as const
export const currentSupportedLanguages = [...langs].sort() as string[]
export type MainSupportedLanguages = (typeof langs)[number]

export const ns = ['app', 'setting'] as const
export const defaultNS = 'app' as const
