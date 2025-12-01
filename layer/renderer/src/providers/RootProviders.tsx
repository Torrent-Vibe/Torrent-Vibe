import { QueryClientProvider } from '@tanstack/react-query'
import { Provider } from 'jotai'
import { domMax, LazyMotion, MotionConfig } from 'motion/react'
import type { FC, PropsWithChildren } from 'react'

import { AuthFailureAlert } from '~/components/common/AuthFailureAlert'
import { AuthInitializer } from '~/components/common/AuthInitializer'
import { ModalContainer } from '~/components/ui/modal/ModalContainer'
import { Toaster } from '~/components/ui/sonner'
import { jotaiStore } from '~/lib/jotai'
import { queryClient } from '~/lib/query/query-client'
import { Spring } from '~/lib/spring'
import { HotkeyProvider } from '~/modules/hotkey'

import { ContextMenuProvider } from './ContextMenuProvider'
import { EventProvider } from './EventProvider'
import { GlobalDropProvider } from './GlobalDropProvider'
import { I18nProvider } from './i18Provider'
import { MultiServerInitializer } from './MultiServerInitializer'
import { OpenWithProvider } from './OpenWithProvider'
import { SettingSync } from './SettingSync'
import { StableRouterProvider } from './StableRouterProvider'
import { UpdateContainer } from './UpdateContainer'

export const RootProviders: FC<PropsWithChildren> = ({ children }) => {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig transition={Spring.presets.smooth}>
        <QueryClientProvider client={queryClient}>
          {/* <ReactQueryDevtools initialIsOpen={false} /> */}
          <Provider store={jotaiStore}>
            <HotkeyProvider>
              <I18nProvider>
                <MultiServerInitializer />
                <AuthInitializer />
                <EventProvider />
                <StableRouterProvider />
                <SettingSync />
                <ContextMenuProvider />
                <GlobalDropProvider />
                {children}
                <ModalContainer />
                <AuthFailureAlert />
                {ELECTRON && <UpdateContainer />}
                {/* Invite modal now triggered from Activation section when activated */}
                {ELECTRON && <OpenWithProvider />}
              </I18nProvider>
            </HotkeyProvider>
          </Provider>
        </QueryClientProvider>
      </MotionConfig>
      <Toaster />
    </LazyMotion>
  )
}
