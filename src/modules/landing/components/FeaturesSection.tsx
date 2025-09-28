'use client'

import type { FC } from 'react'

interface FeatureCardProps {
  icon: string
  iconColor: string
  title: string
  description: string
}

const FeatureCard: FC<FeatureCardProps> = ({
  icon,
  iconColor,
  title,
  description,
}) => {
  const getIconBgClass = () => {
    const baseClass =
      'w-12 h-12 rounded-xl flex items-center justify-center mb-6'
    switch (iconColor) {
      case 'accent': {
        return `${baseClass} bg-accent/20`
      }
      case 'primary': {
        return `${baseClass} bg-primary/20`
      }
      case 'purple-500': {
        return `${baseClass} bg-purple-500/20`
      }
      case 'orange-500': {
        return `${baseClass} bg-orange-500/20`
      }
      case 'red-500': {
        return `${baseClass} bg-red-500/20`
      }
      case 'cyan-500': {
        return `${baseClass} bg-cyan-500/20`
      }
      case 'green-500': {
        return `${baseClass} bg-green-500/20`
      }
      default: {
        return `${baseClass} bg-accent/20`
      }
    }
  }

  const getIconClass = () => {
    const baseClass = `${icon} text-2xl`
    switch (iconColor) {
      case 'accent': {
        return `${baseClass} text-accent`
      }
      case 'primary': {
        return `${baseClass} text-primary`
      }
      case 'purple-500': {
        return `${baseClass} text-purple-500`
      }
      case 'orange-500': {
        return `${baseClass} text-orange-500`
      }
      case 'red-500': {
        return `${baseClass} text-red-500`
      }
      case 'cyan-500': {
        return `${baseClass} text-cyan-500`
      }
      case 'green-500': {
        return `${baseClass} text-green-500`
      }
      default: {
        return `${baseClass} text-accent`
      }
    }
  }

  return (
    <div className="bg-material-medium border border-border rounded-xl p-8 transition-colors hover:bg-material-thick">
      <div className={getIconBgClass()}>
        <i className={getIconClass()} />
      </div>
      <h3 className="text-xl font-semibold mb-4 text-text">{title}</h3>
      <p className="text-text-secondary">{description}</p>
    </div>
  )
}

export const FeaturesSection: FC = () => {
  const features = [
    {
      icon: 'i-lucide-layout-dashboard',
      iconColor: 'accent',
      title: 'Modern Client Interface',
      description:
        'Beautiful, intuitive qBittorrent client with clean design optimized for desktop and mobile with full dark mode support',
    },

    {
      icon: 'i-lucide-folder-open',
      iconColor: 'purple-500',
      title: 'Smart Organization',
      description:
        'Advanced filtering, categories, tags, and search to organize your torrents efficiently',
    },

    {
      icon: 'i-lucide-monitor',
      iconColor: 'cyan-500',
      title: 'Cross-Platform',
      description:
        'Native desktop apps and web interface that work seamlessly across all platforms',
    },
    {
      icon: 'i-lucide-folder',
      iconColor: 'primary',
      title: 'Path Mapping (App)',
      description:
        'Bridge remote download paths to your local or network storage with seamless file/folder access directly from the desktop app',
    },
    {
      icon: 'i-lucide-server',
      iconColor: 'green-500',
      title: 'Multi-Server Management (App)',
      description:
        'Run multiple qBittorrent servers as one seamless workspace. Effortless switching, unified status monitoring, and secure credential management',
    },
    {
      icon: 'i-lucide-sparkles',
      iconColor: 'orange-500',
      title: 'AI-Powered Metadata Enrichment (App)',
      description:
        'Intelligent torrent name parsing with automatic metadata extraction, TMDB integration, and smart confidence scoring for content recognition',
    },
  ]

  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-5xl font-bold mb-6 text-text">
            Torrent Vibe <span className="text-accent">Features</span>
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Discover powerful qBittorrent client features with modern design,
            real-time monitoring, and advanced torrent management capabilities
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>
    </section>
  )
}
