'use client'

import { m } from 'motion/react'
import Image from 'next/image'
import type { FC } from 'react'

const Screenshot = 'https://object.innei.in/bed/2025/09/01/1756656617018.png'

export const HeroSection: FC = () => {
  return (
    <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background with subtle geometric elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-fill/20" />
      <div className="absolute top-20 left-10 w-32 h-32 bg-accent/5 rounded-full blur-xl" />
      <div className="absolute top-40 right-20 w-24 h-24 bg-primary/5 rounded-full blur-lg" />
      <div className="absolute bottom-40 left-1/4 w-16 h-16 bg-accent/10 rounded-full blur-md" />

      <div className="max-w-7xl mx-auto text-center relative z-10">
        {/* Main content container */}
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {/* Hero Title */}
          <div className="relative mb-8">
            {/* Decorative elements */}
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-accent/20 rounded-full" />
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold leading-tight">
              <span className="text-accent relative">
                Torrent Vibe
                <div className="absolute -bottom-2 left-0 w-full h-0.5 bg-accent/30 rounded-full" />
              </span>
              <br />
              <span className="text-text-secondary font-normal text-2xl sm:text-3xl lg:text-4xl">
                Modern qBittorrent Client
              </span>
            </h1>
          </div>

          {/* Description section */}
          <div className="max-w-4xl mx-auto mb-12">
            <div className="bg-material-medium/50 backdrop-blur-sm border border-border/30 rounded-2xl p-6 mb-8">
              <p className="text-lg sm:text-xl text-text-secondary mb-0 leading-relaxed">
                Experience qBittorrent like never before with our modern client
                featuring enhanced performance, intuitive design, and powerful
                torrent management.
              </p>
            </div>

            {/* Feature badges */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm sm:text-base">
              {[
                {
                  icon: 'i-lucide-clock',
                  text: 'Real-time monitoring',
                  bgColor: 'bg-accent/10',
                  iconColor: 'text-accent',
                  borderColor: 'border-accent/20',
                },
                {
                  icon: 'i-lucide-settings',
                  text: 'Advanced controls',
                  bgColor: 'bg-primary/10',
                  iconColor: 'text-primary',
                  borderColor: 'border-primary/20',
                },
                {
                  icon: 'i-lucide-monitor',
                  text: 'Cross-platform',
                  bgColor: 'bg-accent/10',
                  iconColor: 'text-accent',
                  borderColor: 'border-accent/20',
                },
              ].map((item) => (
                <span
                  key={item.text}
                  className={`flex items-center gap-2 ${item.bgColor} px-3 py-1 text-sm rounded-full border ${item.borderColor} text-text-secondary cursor-default`}
                >
                  <i className={`${item.icon} ${item.iconColor}`} />
                  {item.text}
                </span>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
              <a
                href="https://github.com/Torrent-Vibe/Torrent-Vibe/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="relative group bg-gradient-to-r from-accent to-primary text-white px-8 h-12 flex items-center rounded-full font-bold text-lg border border-white/20 hover:border-white/40"
              >
                <span className="flex items-center gap-2">
                  <i className="i-lucide-download w-5 h-5" />
                  Download Client
                </span>
              </a>
              <a
                href="#pricing"
                className="border border-border text-text px-6 h-12 flex items-center rounded-full font-semibold text-lg hover:bg-accent/10 hover:border-accent/50 transition-all"
              >
                View Pricing
              </a>
            </div>
          </div>

          {/* <m.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={Spring.smooth(0.8, 0.6)}
          >
            <m.button
              whileHover={{
                scale: 1.05,
                boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
              }}
              whileTap={{ scale: 0.95 }}
              transition={Spring.snappy()}
              className="bg-gradient-to-r from-accent to-primary text-white px-8 py-3 rounded-full font-semibold text-lg shadow-xl hover:shadow-2xl transition-all duration-300"
            >
              Get Early Access
            </m.button>
          </m.div> */}
        </m.div>

        {/* App Screenshot */}
        <div className="relative mt-16">
          {/* Decorative frame */}
          <div className="absolute -inset-4 bg-gradient-to-r from-accent/5 via-primary/5 to-accent/5 rounded-3xl blur-lg" />
          <div className="relative bg-material-medium/30 backdrop-blur-sm border border-border/50 rounded-2xl p-2">
            <Image
              src={Screenshot}
              alt="qBittorrent WebUI Screenshot"
              width={3024}
              height={2024}
              className="rounded-xl w-full h-auto shadow-xl"
            />
            {/* Corner decorative elements */}
            <div className="absolute -top-2 -left-2 w-4 h-4 bg-accent rounded-full opacity-20" />
            <div className="absolute -top-2 -right-2 w-3 h-3 bg-primary rounded-full opacity-30" />
            <div className="absolute -bottom-2 -left-2 w-3 h-3 bg-primary rounded-full opacity-25" />
            <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-accent rounded-full opacity-15" />
          </div>
        </div>
      </div>
    </section>
  )
}
