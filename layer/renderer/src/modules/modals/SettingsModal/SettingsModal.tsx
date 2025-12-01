import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import type { ModalComponent } from '~/components/ui/modal'
import { ScrollArea } from '~/components/ui/scroll-areas/ScrollArea'
import { cn } from '~/lib/cn'

import type { SettingsSection } from './configs'
import {
  getTabConfig,
  SIDEBAR_GROUPS,
} from './configs'

export const SettingsModal: ModalComponent<{ tab: SettingsSection }> = ({
  tab,
}) => {
  const { t } = useTranslation()
  const { t: tSetting } = useTranslation('setting')
  const sidebarOrder = SIDEBAR_GROUPS.flatMap((group) => group.keys)
  const initialTab =
    (tab && (sidebarOrder as SettingsSection[]).includes(tab)
      ? tab
      : sidebarOrder[0]) || 'appearance'
  const [active, setActive] = useState<SettingsSection>(initialTab)

  const TAB_CONFIG = getTabConfig(tSetting)

  return (
    <div className="flex h-[70vh] min-h-[520px] overflow-hidden [*]:select-none">
      {/* Sidebar - macOS style */}
      <aside className="w-48 shrink-0 border-r border-border">
        <ScrollArea rootClassName="h-full" viewportClassName="px-2 py-4">
          <div className="mb-4 mt-1 flex items-center gap-2 px-2">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <i className="i-mingcute-settings-3-line text-white text-lg" />
            </div>
            <div className="font-semibold ml-0.5">
              {t('modals.settings.title')}
            </div>
          </div>
          <nav className="flex flex-col gap-4">
            {SIDEBAR_GROUPS.map((group, groupIndex) => (
              <div key={group.id} className="flex flex-col gap-1">
                <div
                  className={cn(
                    'px-2 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary',
                    groupIndex === 0 ? 'pt-0 pb-1' : 'pt-3 pb-1',
                  )}
                >
                  {tSetting(group.translationKey)}
                </div>
                {group.keys.map((settingsKey: SettingsSection) => {
                  const item = TAB_CONFIG[settingsKey]

                  return (
                    <button
                      type="button"
                      key={settingsKey}
                      className={cn(
                        'flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sm text-left',
                        active === settingsKey
                          ? 'bg-fill-tertiary text-text hc:text-white hc:dark:text-black'
                          : 'text-text-secondary',
                      )}
                      onClick={() => setActive(settingsKey)}
                    >
                      <div className="flex items-center gap-2">
                        <i className={cn('text-base', item.icon)} />
                        <span>{item.label}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </nav>
        </ScrollArea>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <DialogHeader className="py-6 px-6">
          <DialogTitle className="flex items-center gap-2">
            <i className={TAB_CONFIG[active].icon} />
            {TAB_CONFIG[active].label}
          </DialogTitle>
          <DialogDescription className="text-text-secondary">
            <span>{TAB_CONFIG[active].description}</span>
          </DialogDescription>
        </DialogHeader>
        <ScrollArea rootClassName="flex-1" viewportClassName="p-6 pt-0">
          {(() => {
            const { Component } = TAB_CONFIG[active]
            return <Component />
          })()}
        </ScrollArea>
      </div>
    </div>
  )
}

SettingsModal.contentClassName = 'w-[1024px] max-w-full p-0 overflow-hidden'
SettingsModal.disableOverlayClickToClose = true
SettingsModal.disableTransition = true
