import './globals.css'

import type { Metadata } from 'next'

import { RootProviders } from '~/providers/root-providers'

export const metadata: Metadata = {
  title: 'Modern QB WebUI Vibe - For qBittorrent',
  description:
    'A modern WebUI experience for qBittorrent with enhanced performance and intuitive design. Get real-time monitoring, advanced controls, and cross-platform support.',
  keywords: [
    'qBittorrent',
    'WebUI',
    'torrent client',
    'modern interface',
    'real-time monitoring',
    'cross-platform',
  ],
  authors: [{ name: 'Torrent Vibe Team' }],
  creator: 'Torrent Vibe Team',
  publisher: 'Torrent Vibe Team',
  icons: {
    icon: '/favicon.png',
    apple: '/logo-192.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://torrent-vibe.app',
    title: 'Modern QB WebUI Vibe - For qBittorrent',
    description:
      'A modern WebUI experience for qBittorrent with enhanced performance and intuitive design.',
    siteName: 'QB WebUI Vibe',
    images: [
      {
        url: 'https://torrent-vibe.app/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Modern QB WebUI Vibe - A modern WebUI experience for qBittorrent',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Modern QB WebUI Vibe - For qBittorrent',
    description:
      'A modern WebUI experience for qBittorrent with enhanced performance and intuitive design.',
    images: ['https://torrent-vibe.app/og-image.jpg'],
    creator: '@_oQuery',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="referrer" content="no-referrer" />
      </head>
      <body>
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  )
}
