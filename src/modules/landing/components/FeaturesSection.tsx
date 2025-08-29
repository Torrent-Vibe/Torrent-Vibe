'use client'

import { m } from 'motion/react'
import type { FC } from 'react'

import { Spring } from '~/lib/spring'

interface FeatureCardProps {
  icon: string
  iconColor: string
  title: string
  description: string
  delay?: number
}

const FeatureCard: FC<FeatureCardProps> = ({
  icon,
  iconColor,
  title,
  description,
  delay = 0,
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
      default: {
        return `${baseClass} text-accent`
      }
    }
  }

  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{
        ...Spring.smooth(0.6),
        delay,
      }}
      viewport={{ once: true }}
      className="bg-material-medium backdrop-blur-sm border border-border rounded-2xl p-8 hover:bg-material-thick"
    >
      <div className={getIconBgClass()}>
        <i className={getIconClass()} />
      </div>
      <h3 className="text-xl font-semibold mb-4 text-text">{title}</h3>
      <p className="text-text-secondary">{description}</p>
    </m.div>
  )
}

export const FeaturesSection: FC = () => {
  const features = [
    {
      icon: 'i-lucide-layout-dashboard',
      iconColor: 'accent',
      title: 'Modern QB WebUI Interface',
      description:
        'Enhanced qBittorrent web interface with clean, intuitive design optimized for desktop and mobile with dark mode support',
    },
    {
      icon: 'i-lucide-clock',
      iconColor: 'primary',
      title: 'Real-time Monitoring',
      description:
        'Live tracking of download/upload speeds, progress, and detailed torrent statistics',
    },
    {
      icon: 'i-lucide-folder-open',
      iconColor: 'purple-500',
      title: 'Smart Organization',
      description:
        'Advanced filtering, categories, tags, and search to organize your torrents efficiently',
    },
    {
      icon: 'i-lucide-settings',
      iconColor: 'orange-500',
      title: 'Advanced QB Controls',
      description:
        'Fine-grained control over bandwidth, scheduling, and qBittorrent preferences through our enhanced WebUI vibe',
    },
    {
      icon: 'i-lucide-shield',
      iconColor: 'red-500',
      title: 'Secure & Private',
      description:
        'Built-in security features with support for VPN, encryption, and privacy settings',
    },
    {
      icon: 'i-lucide-monitor',
      iconColor: 'cyan-500',
      title: 'Cross-Platform',
      description:
        'Native desktop apps and web interface that work seamlessly across all platforms',
    },
  ]

  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <m.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={Spring.smooth(0.8)}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
              QB WebUI Vibe Features
            </span>
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Experience enhanced qBittorrent WebUI functionality with modern
            design, real-time monitoring, and advanced torrent management
            capabilities
          </p>
        </m.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <FeatureCard
              key={feature.title}
              {...feature}
              delay={0.1 * (index + 1)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
