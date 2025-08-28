'use client'

import { m } from 'motion/react'
import type { FC } from 'react'

import { Spring } from '~/lib/spring'

export const LandingFooter: FC = () => {
  return (
    <footer className="relative px-4 sm:px-6 lg:px-8 bg-gradient-to-t from-fill/30 pb-6 to-transparent border-t border-border">
      <div className="max-w-7xl mx-auto">
        {/* Main footer content */}
        <m.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={Spring.smooth(0.8)}
          viewport={{ once: true }}
          className="flex flex-col md:flex-row items-center justify-between gap-8 pt-8"
        >
          {/* Left side - Brand section */}
          <m.div
            className="flex flex-col items-center md:items-start"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={Spring.smooth(0.6, 0.2)}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-accent to-primary rounded-2xl flex items-center justify-center shadow-lg">
                <i className="i-lucide-download text-white text-xl" />
              </div>
              <span className="text-2xl font-bold text-text">Torrent Vibe</span>
            </div>
            <p className="text-text-secondary text-sm leading-relaxed max-w-md text-center md:text-left">
              The modern web interface for qBittorrent, designed for performance
              and ease of use.
            </p>
          </m.div>

          {/* Right side - Copyright section */}
          <m.div
            className="flex flex-col items-center md:items-end text-center md:text-right"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={Spring.smooth(0.6, 0.4)}
            viewport={{ once: true }}
          >
            <p className="text-text-secondary text-sm">© 2024 Torrent Vibe</p>
            <p className="text-text-secondary text-sm mt-1">
              Created by{' '}
              <a
                href="https://innei.in"
                className="text-accent hover:text-primary transition-colors"
              >
                Innei
              </a>
            </p>
          </m.div>
        </m.div>
      </div>
    </footer>
  )
}
