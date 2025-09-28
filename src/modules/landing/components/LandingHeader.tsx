'use client'

import type { FC } from 'react'
import { useEffect, useState } from 'react'

interface LandingHeaderProps {
  className?: string
}

export const LandingHeader: FC<LandingHeaderProps> = ({ className }) => {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY
      setIsScrolled(scrollTop > 50)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-material-medium/80 backdrop-blur-xl border-b border-border'
          : 'bg-transparent border-b border-transparent'
      } ${className || ''}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Enhanced Brand Section */}
          <div className="flex items-center gap-3">
            <img
              src="/base.png"
              alt="Torrent Vibe Logo"
              width={32}
              height={32}
            />
            <div>
              <div className="font-bold text-text">Torrent Vibe</div>
              <div className="text-xs text-text-secondary">qBittorrent UI</div>
            </div>
          </div>

          {/* Desktop CTAs - Minimalist Linear Design */}
          <div className="flex items-center">
            {/* Minimalist primary button */}
            <a
              href="https://github.com/Torrent-Vibe/Torrent-Vibe/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="relative group px-5 py-2 bg-text text-background rounded-lg text-sm font-medium transition-all duration-200 hover:bg-text/90 flex items-center gap-2 shadow-sm hover:shadow-md"
            >
              <span>Get Started</span>
            </a>
          </div>
        </div>
      </div>
    </header>
  )
}
