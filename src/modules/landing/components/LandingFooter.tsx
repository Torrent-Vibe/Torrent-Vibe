'use client'

import Image from 'next/image'
import type { FC } from 'react'

export const LandingFooter: FC = () => {
  return (
    <footer className="relative px-4 sm:px-6 lg:px-8 bg-gradient-to-t from-fill/30 pb-6 to-transparent border-t border-border">
      <div className="max-w-7xl mx-auto">
        {/* Main footer content */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-8">
          {/* Left side - Brand section */}
          <div className="flex flex-col items-center md:items-start">
            <div className="flex items-center gap-3 mb-4">
              <Image
                src="/base.png"
                alt="Torrent Vibe Logo"
                width={48}
                height={48}
              />
              <span className="text-2xl font-bold text-text">Torrent Vibe</span>
            </div>
            <p className="text-text-secondary text-sm leading-relaxed max-w-md text-center md:text-left">
              The modern web interface for qBittorrent, designed for performance
              and ease of use.
            </p>
          </div>

          {/* Right side - Copyright section */}
          <div className="flex flex-col items-center md:items-end text-center md:text-right">
            <p className="text-text-secondary text-sm">© 2025 Torrent Vibe</p>
            <p className="text-text-secondary text-sm mt-1">
              Created by{' '}
              <a
                href="https://github.com/torrent-vibe"
                className="text-accent hover:text-primary transition-colors"
              >
                Torrent Vibe Team
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
