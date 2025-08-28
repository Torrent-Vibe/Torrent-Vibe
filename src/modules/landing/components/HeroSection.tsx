'use client'

import { m } from 'motion/react'
import Image from 'next/image'
import type { FC } from 'react'

import { CanvasBackground } from '~/components/common/CanvasBackground'
import { WaitlistForm } from '~/modules/waitlist'

const Screenshot = 'https://object.innei.in/bed/2025/08/22/1755878366885.png'

export const HeroSection: FC = () => {
  return (
    <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Canvas Background Animation */}
      <CanvasBackground />

      <div className="max-w-7xl mx-auto text-center relative">
        {/* Main content container with stagger animation */}
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          {/* Hero Title with natural cascade effect */}
          <m.h1
            className="text-4xl sm:text-6xl lg:text-7xl font-bold leading-tight mb-6"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              ease: [0.21, 1.11, 0.81, 0.99],
              delay: 0.1,
            }}
          >
            <m.span
              className="text-text inline-block"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                ease: 'easeOut',
                delay: 0.2,
              }}
            >
              Modern{' '}
            </m.span>
            <m.span
              className="bg-gradient-to-r ml-4 from-accent via-primary to-accent bg-clip-text text-transparent inline-block"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: 0.5,
                ease: [0.34, 1.56, 0.64, 1],
                delay: 0.3,
              }}
            >
              QB WebUI Vibe
            </m.span>
            <br />
            <m.span
              className="text-text inline-block"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                ease: 'easeOut',
                delay: 0.4,
              }}
            >
              For qBittorrent
            </m.span>
          </m.h1>

          {/* Description section with smooth fade-in */}
          <div className="max-w-4xl mx-auto mb-12">
            <m.p
              className="text-lg sm:text-xl text-text-secondary mb-6 leading-relaxed"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.5,
                ease: 'easeOut',
                delay: 0.5,
              }}
            >
              A modern WebUI experience for qBittorrent with enhanced
              performance and intuitive design.
            </m.p>

            {/* Feature badges with staggered animation */}
            <m.div
              className="flex flex-wrap items-center justify-center gap-4 text-sm sm:text-base text-text-secondary/80"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 0.4,
                delay: 0.6,
              }}
            >
              {[
                {
                  icon: 'i-lucide-clock',
                  text: 'Real-time monitoring',
                  color: 'text-accent',
                  delay: 0,
                },
                {
                  icon: 'i-lucide-settings',
                  text: 'Advanced controls',
                  color: 'text-primary',
                  delay: 0.1,
                },
                {
                  icon: 'i-lucide-monitor',
                  text: 'Cross-platform',
                  color: 'text-accent',
                  delay: 0.2,
                },
              ].map((item) => (
                <m.span
                  key={item.text}
                  className="flex items-center gap-2 bg-fill/50 px-3 py-1 rounded-full border border-border/50"
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    duration: 0.3,
                    ease: [0.25, 0.46, 0.45, 0.94],
                    delay: 0.7 + item.delay,
                  }}
                  whileHover={{
                    scale: 1.05,
                    transition: { duration: 0.2 },
                  }}
                >
                  <i className={`${item.icon} ${item.color}`} />
                  {item.text}
                </m.span>
              ))}
            </m.div>
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

          {/* Waitlist Section with natural animation flow */}
          <m.div
            className="max-w-lg mx-auto mb-16"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              ease: [0.25, 0.46, 0.45, 0.94],
              delay: 0.8,
            }}
          >
            {/* Call-to-action badge with pulse effect */}
            <m.div
              className="flex justify-center mb-8"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.4,
                ease: [0.34, 1.56, 0.64, 1],
                delay: 0.9,
              }}
            >
              <m.span
                className="flex items-center gap-2 bg-gradient-to-r from-accent/10 to-primary/10 text-accent px-4 py-2 rounded-full border border-accent/20 font-medium text-sm"
                whileHover={{
                  scale: 1.05,
                  backgroundColor: 'rgba(var(--accent-rgb), 0.15)',
                  transition: { duration: 0.2 },
                }}
                whileTap={{ scale: 0.95 }}
              >
                <m.i
                  className="i-lucide-zap text-accent"
                  animate={{
                    scale: [1, 1.1, 1],
                    rotate: [0, 5, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
                Early Access Available
              </m.span>
            </m.div>

            {/* Waitlist form with refined animation */}
            <m.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                ease: 'easeOut',
                delay: 1,
              }}
              className="relative"
            >
              {/* Subtle background glow */}
              <m.div
                className="absolute inset-0 bg-gradient-to-r from-accent/5 via-primary/5 to-accent/5 rounded-2xl blur-xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  duration: 0.8,
                  delay: 1.1,
                }}
              />

              {/* Main form container */}
              <div className="relative bg-material-medium backdrop-blur-xl border border-border/30 rounded-2xl p-8 shadow-2xl">
                <m.div
                  className="text-center mb-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.4,
                    ease: 'easeOut',
                    delay: 1.05,
                  }}
                >
                  <h3 className="text-xl font-bold text-text mb-2">
                    Join the Future of qBittorrent
                  </h3>
                  <p className="text-text-secondary text-sm">
                    Get notified when early access becomes available
                  </p>
                </m.div>

                <m.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.4,
                    ease: 'easeOut',
                    delay: 1.15,
                  }}
                >
                  <WaitlistForm
                    placeholder="your@email.com"
                    buttonText="Get Early Access"
                    successMessage="🎉 You're in! We'll notify you as soon as early access is ready."
                  />
                </m.div>
              </div>
            </m.div>
          </m.div>
        </m.div>

        {/* App Screenshot with elegant reveal */}
        <m.div
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: 0.6,
            ease: [0.25, 0.46, 0.45, 0.94],
            delay: 1.3,
          }}
          className="relative"
          whileHover={{
            scale: 1.02,
            transition: { duration: 0.3, ease: 'easeOut' },
          }}
        >
          <m.div
            className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent rounded-2xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.5 }}
          />
          <Image
            src={Screenshot}
            alt="qBittorrent WebUI Screenshot"
            width={3024}
            height={2024}
            className="rounded-2xl w-full h-auto shadow-2xl"
          />
        </m.div>
      </div>
    </section>
  )
}
