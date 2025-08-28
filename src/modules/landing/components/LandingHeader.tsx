import type { FC } from 'react'

interface LandingHeaderProps {
  className?: string
}

export const LandingHeader: FC<LandingHeaderProps> = ({ className }) => {
  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border ${className || ''}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-accent to-primary rounded-lg flex items-center justify-center">
              <i className="i-lucide-download text-white text-lg" />
            </div>
            <span className="text-xl font-bold text-text">Torrent Vibe</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a
              href="#features"
              className="text-text-secondary hover:text-text transition-colors"
            >
              Features
            </a>

            <a
              href="#faq"
              className="text-text-secondary hover:text-text transition-colors"
            >
              FAQ
            </a>
          </nav>
        </div>
      </div>
    </header>
  )
}
