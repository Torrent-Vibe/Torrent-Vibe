'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { Provider } from 'jotai'
import { LazyMotion, MotionConfig } from 'motion/react'
import { ThemeProvider } from 'next-themes'
import type { FC, PropsWithChildren } from 'react'

import { ModalContainer } from '~/components/ui/modal'
import { Toaster } from '~/components/ui/sonner'
import { jotaiStore } from '~/lib/jotai'
import { queryClient } from '~/lib/query-client'
import { Spring } from '~/lib/spring'

import loadFeatures from '../framer-lazy-feature'
import { ContextMenuProvider } from './context-menu-provider'
import { EventProvider } from './event-provider'
import { SettingSync } from './setting-sync'

export const RootProviders: FC<PropsWithChildren> = ({ children }) => (
  <LazyMotion features={loadFeatures} strict>
    <MotionConfig transition={Spring.presets.smooth}>
      <QueryClientProvider client={queryClient}>
        <Provider store={jotaiStore}>
          <ThemeProvider
            attribute="data-theme"
            defaultTheme="system"
            enableSystem
            enableColorScheme
          >
            <EventProvider />
            <SettingSync />
            <ContextMenuProvider />
            <ModalContainer />
            {children}
          </ThemeProvider>
        </Provider>
      </QueryClientProvider>
    </MotionConfig>
    <Toaster />
  </LazyMotion>
)
