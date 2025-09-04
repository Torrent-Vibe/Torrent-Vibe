'use client'

import type { FC } from 'react'
import { useEffect, useState } from 'react'

interface LandingHeaderProps {
  className?: string
}

export const LandingHeader: FC<LandingHeaderProps> = ({ className }) => {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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

          {/* Category Navigation */}
          <nav className="hidden lg:flex items-center gap-2">
            <a
              href="#features"
              className="flex items-center gap-2 px-3 py-2 text-text-secondary hover:text-text hover:bg-fill-secondary rounded-lg transition-all group"
            >
              <i className="i-lucide-sparkles w-4 h-4 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium">Features</span>
            </a>
            <a
              href="#pricing"
              className="flex items-center gap-2 px-3 py-2 text-text-secondary hover:text-text hover:bg-fill-secondary rounded-lg transition-all group"
            >
              <i className="i-lucide-credit-card w-4 h-4 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium">Pricing</span>
            </a>
            <a
              href="#faq"
              className="flex items-center gap-2 px-3 py-2 text-text-secondary hover:text-text hover:bg-fill-secondary rounded-lg transition-all group"
            >
              <i className="i-lucide-help-circle w-4 h-4 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium">FAQ</span>
            </a>
          </nav>

          {/* Desktop CTAs - Minimalist Linear Design */}
          <div className="hidden lg:flex items-center gap-6">
            {/* Subtle text link */}
            <a
              href="#demo"
              className="text-sm text-text-tertiary hover:text-text-secondary border-b border-transparent hover:border-text-tertiary transition-all duration-200 pb-0.5"
            >
              Try Demo
            </a>

            {/* Minimalist primary button */}
            <a
              href="https://github.com/Torrent-Vibe/Torrent-Vibe/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="relative group px-5 py-2 bg-text text-background rounded-lg text-sm font-medium transition-all duration-200 hover:bg-text/90 flex items-center gap-2 shadow-sm hover:shadow-md"
            >
              <i className="i-lucide-arrow-right w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              <span>Get Started</span>
            </a>
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-text-secondary hover:text-text hover:bg-fill-secondary rounded-lg transition-all"
              aria-label="Toggle mobile menu"
            >
              {isMobileMenuOpen ? (
                <i className="i-lucide-x w-6 h-6" />
              ) : (
                <i className="i-lucide-menu w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-border bg-material-medium/95 backdrop-blur-xl">
            <div className="px-4 py-4 space-y-2">
              <nav className="space-y-1">
                <a
                  href="#features"
                  className="flex items-center gap-3 px-4 py-3 text-text-secondary hover:text-text hover:bg-fill-secondary rounded-lg transition-all"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <i className="i-lucide-sparkles w-5 h-5" />
                  <span className="font-medium">Features</span>
                </a>
                <a
                  href="#pricing"
                  className="flex items-center gap-3 px-4 py-3 text-text-secondary hover:text-text hover:bg-fill-secondary rounded-lg transition-all"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <i className="i-lucide-credit-card w-5 h-5" />
                  <span className="font-medium">Pricing</span>
                </a>
                <a
                  href="#faq"
                  className="flex items-center gap-3 px-4 py-3 text-text-secondary hover:text-text hover:bg-fill-secondary rounded-lg transition-all"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <i className="i-lucide-help-circle w-5 h-5" />
                  <span className="font-medium">FAQ</span>
                </a>
              </nav>

              {/* Mobile CTAs - Minimalist Design */}
              <div className="pt-4 border-t border-border space-y-3">
                <a
                  href="#demo"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-text-secondary hover:text-text hover:bg-fill-secondary rounded-lg transition-all"
                >
                  <i className="i-lucide-play-circle w-5 h-5" />
                  <span className="font-medium">Try Demo</span>
                </a>

                <a
                  href="https://github.com/Torrent-Vibe/Torrent-Vibe/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 bg-text text-background rounded-lg font-medium hover:bg-text/90 transition-all shadow-sm"
                >
                  <i className="i-lucide-arrow-right w-5 h-5" />
                  <span>Get Started</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
