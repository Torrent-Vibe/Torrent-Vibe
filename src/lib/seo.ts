// SEO Configuration for Torrent Vibe
export const seoConfig = {
  // Primary SEO keywords
  keywords: [
    'qb',
    'webui',
    'vibe',
    'qbittorrent',
    'torrent',
    'bittorrent',
    'web interface',
    'download manager',
    'p2p',
    'file sharing',
    'modern ui',
    'torrent client',
    'qb webui',
    'torrent vibe',
  ],

  // Site metadata
  site: {
    name: 'Torrent Vibe',
    title: 'Torrent Vibe - Modern QB WebUI for BitTorrent Management',
    description:
      'Torrent Vibe is a modern qBittorrent WebUI with enhanced performance and user experience. Manage your torrents with our intuitive web interface featuring real-time monitoring and advanced controls.',
    url: 'https://torrent-vibe.app',
    image: 'https://torrent-vibe.app/og-image.jpg',
    author: 'Torrent Vibe Team',
  },

  // Open Graph default values
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Torrent Vibe',
  },

  // Structured data templates
  structuredData: {
    organization: {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Torrent Vibe',
      url: 'https://torrent-vibe.app',
      description:
        'Modern QB WebUI for qBittorrent with enhanced performance and intuitive design',
      founder: {
        '@type': 'Person',
        name: 'Torrent Vibe Team',
      },
    },

    software: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Torrent Vibe',
      applicationCategory: 'UtilityApplication',
      operatingSystem: 'Web Browser, Windows, macOS, Linux',
      offers: {
        '@type': 'Offer',
        price: 'varies',
        priceCurrency: 'USD',
      },
    },
  },
}

// SEO page templates
export const pageTemplates = {
  home: {
    title: 'Torrent Vibe - Modern QB WebUI for qBittorrent Management',
    description:
      'Experience the future of BitTorrent with Torrent Vibe - a modern qBittorrent WebUI featuring enhanced performance, intuitive design, and powerful torrent management capabilities.',
    keywords: [
      'qb webui',
      'torrent vibe',
      'qbittorrent interface',
      'modern torrent client',
    ],
  },

  features: {
    title: 'Features - Torrent Vibe for Enhanced Torrent Management',
    description:
      'Discover powerful features of Torrent Vibe QB WebUI including real-time monitoring, advanced controls, modern interface, and cross-platform compatibility.',
    keywords: [
      'qb features',
      'webui capabilities',
      'torrent management',
      'vibe interface',
    ],
  },

  download: {
    title: 'Download Torrent Vibe Trial - Modern QB WebUI for qBittorrent',
    description:
      'Download the latest trial version of Torrent Vibe - experience the modern qBittorrent WebUI with enhanced performance, cutting-edge design and powerful torrent management capabilities.',
    keywords: [
      'download qb webui',
      'torrent vibe trial',
      'torrent vibe download',
      'trial version',
      'qbittorrent interface',
    ],
  },
}

// Generate meta tags for specific pages
export function generateMetaTags(template: keyof typeof pageTemplates) {
  const page = pageTemplates[template]
  const { site } = seoConfig

  return {
    title: page.title,
    description: page.description,
    keywords: [...seoConfig.keywords, ...page.keywords].join(', '),
    openGraph: {
      title: page.title,
      description: page.description,
      url: site.url,
      images: [{ url: site.image }],
      siteName: site.name,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.description,
      image: site.image,
    },
  }
}
