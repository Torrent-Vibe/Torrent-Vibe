import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { MainSupportedLanguages } from '~/@types/constants'
import type { AppColorStyle } from '~/atoms/settings/appearance'
import {
  ACCENT_COLOR_PRESETS,
  COLOR_STYLE_OPTIONS,
  setAccentColor,
  setColorStyle,
  useAccentColor,
  useColorStyle,
} from '~/atoms/settings/appearance'
import type { SegmentTabItem } from '~/components/ui/segment-tab'
import { SegmentTab } from '~/components/ui/segment-tab'
import { SelectItem } from '~/components/ui/select'
import {
  useIsDark,
  useSetTheme,
  useThemeAtomValue,
} from '~/hooks/common/useDark'
import { useLanguage } from '~/hooks/common/useLanguage'
import { cn } from '~/lib/cn'

import { SettingField, SettingSectionCard, SettingSelectField } from '.'

type ThemeMode = 'system' | 'light' | 'dark'

const getReadableTextColor = (hexColor: string) => {
  const normalized = hexColor.replace('#', '')

  if (normalized.length !== 3 && normalized.length !== 6) {
    return '#ffffff'
  }

  const expand = (value: string) =>
    value.length === 1 ? `${value}${value}` : value

  const safeParse = (value: string) => {
    const parsed = Number.parseInt(value, 16)
    return Number.isNaN(parsed) ? null : parsed
  }

  const r = safeParse(
    expand(normalized.slice(0, normalized.length === 3 ? 1 : 2)),
  )
  const g = safeParse(
    expand(
      normalized.slice(
        normalized.length === 3 ? 1 : 2,
        normalized.length === 3 ? 2 : 4,
      ),
    ),
  )
  const b = safeParse(
    expand(
      normalized.slice(
        normalized.length === 3 ? 2 : 4,
        normalized.length === 3 ? 3 : 6,
      ),
    ),
  )

  if (r === null || g === null || b === null) {
    return '#ffffff'
  }

  const linear = (channel: number) => {
    const scaled = channel / 255
    return scaled <= 0.03928
      ? scaled / 12.92
      : Math.pow((scaled + 0.055) / 1.055, 2.4)
  }

  const luminance = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)

  return luminance > 0.55 ? '#000000' : '#ffffff'
}

export const AppearanceSection = () => {
  const { t } = useTranslation('setting')

  const theme = useThemeAtomValue()
  const setTheme = useSetTheme()
  const isDarkMode = useIsDark()

  const accentColor = useAccentColor()
  const colorStyle = useColorStyle()

  const { currentLanguage, changeLanguage, supportedLanguages } = useLanguage()

  const appearanceItems: SegmentTabItem<ThemeMode>[] = [
    {
      value: 'system',
      label: t('general.appearance.theme.system'),
      icon: <i className="i-mingcute-computer-line" />,
    },
    {
      value: 'light',
      label: t('general.appearance.theme.light'),
      icon: <i className="i-mingcute-sun-line" />,
    },
    {
      value: 'dark',
      label: t('general.appearance.theme.dark'),
      icon: <i className="i-mingcute-moon-line" />,
    },
  ]

  const colorStyleItems: SegmentTabItem<AppColorStyle>[] = useMemo(
    () =>
      COLOR_STYLE_OPTIONS.map((option) => ({
        value: option.id,
        label: t(option.labelKey),
        icon:
          option.id === 'default' ? (
            <i className="i-lucide-palette" />
          ) : option.id === 'low' ? (
            <i className="i-lucide-ice-cream" />
          ) : (
            <i className="i-lucide-contrast" />
          ),
      })),
    [t],
  )

  const selectedColorStyle = COLOR_STYLE_OPTIONS.find(
    (option) => option.id === colorStyle,
  )

  return (
    <div className="space-y-4">
      <SettingSectionCard title={t('general.appearance.title')}>
        <SettingField
          label={t('general.appearance.theme.label')}
          controlClassName="md:max-w-[320px]"
        >
          <SegmentTab
            size="md"
            variant="compact"
            items={appearanceItems}
            value={theme as ThemeMode}
            onChange={(mode) => setTheme(mode)}
          />
        </SettingField>

        <SettingField
          label={t('general.appearance.accent.label')}
          description={t('general.appearance.accent.description')}
          controlClassName="md:max-w-none md:justify-end"
        >
          <div className="flex flex-wrap gap-3 md:justify-end">
            {ACCENT_COLOR_PRESETS.map((preset) => {
              const isSelected = preset.id === accentColor
              const gradient = `linear-gradient(135deg, ${preset.lightColor} 0%, ${preset.darkColor} 100%)`
              const accentShade = isDarkMode
                ? preset.darkColor
                : preset.lightColor
              const foreground = getReadableTextColor(accentShade)

              return (
                <button
                  key={preset.id}
                  type="button"
                  className={cn(
                    'relative size-7 rounded-full border border-border shadow-sm transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent',
                    'hover:scale-105',
                    isSelected &&
                      'ring-2 ring-offset-2 ring-accent scale-105 border-transparent',
                  )}
                  style={{ background: gradient }}
                  onClick={() => setAccentColor(preset.id)}
                  aria-pressed={isSelected}
                  title={t(preset.labelKey)}
                >
                  <span className="sr-only">{t(preset.labelKey)}</span>
                  {isSelected ? (
                    <span
                      className="absolute inset-0 flex items-center justify-center text-sm"
                      style={{ color: foreground }}
                    >
                      <i className="i-mingcute-check-fill" />
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </SettingField>

        <SettingField
          label={t('general.appearance.colorStyle.label')}
          description={t('general.appearance.colorStyle.description')}
          controlClassName="md:max-w-[320px]"
        >
          <div className="w-full space-y-2 text-left md:text-right">
            <SegmentTab
              size="md"
              variant="compact"
              items={colorStyleItems}
              value={colorStyle}
              onChange={(style) => setColorStyle(style)}
              containerClassName="w-full"
              className="shadow-sm"
            />
            {selectedColorStyle ? (
              <p className="text-xs text-text-secondary">
                {t(selectedColorStyle.descriptionKey)}
              </p>
            ) : null}
          </div>
        </SettingField>

        <SettingSelectField
          label={t('general.appearance.language.label')}
          value={currentLanguage}
          onValueChange={(language) =>
            changeLanguage(language as MainSupportedLanguages)
          }
          renderItems={() =>
            supportedLanguages.map((lang) => (
              <SelectItem key={lang} value={lang}>
                <div className="flex items-center gap-2">
                  {t(`general.appearance.language.${lang}`)}
                </div>
              </SelectItem>
            ))
          }
        />
      </SettingSectionCard>
    </div>
  )
}
