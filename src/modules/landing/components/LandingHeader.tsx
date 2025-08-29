'use client'
import { RiQuestionLine, RiSparkling2Fill } from '@remixicon/react'
import Image from 'next/image'
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
      // 当滚动超过 50px 时显示背景和边框
      setIsScrolled(scrollTop > 50)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-background/80 backdrop-blur-md border-b border-border'
          : 'bg-transparent border-b border-transparent'
      } ${className || ''}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Image
              src="/logo-192.png"
              alt="Torrent Vibe Logo"
              width={32}
              height={32}
              className="rounded-lg transition-transform duration-200 hover:scale-105"
            />
            <span className="text-xl font-bold text-text">Torrent Vibe</span>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            <a
              href="#features"
              className="group flex items-center gap-2 px-4 py-2 text-text-secondary hover:text-text transition-all duration-200 hover:bg-background/50 rounded-lg"
            >
              <RiSparkling2Fill className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
              <span className="font-medium">Features</span>
            </a>

            <a
              href="#faq"
              className="group flex items-center gap-2 px-4 py-2 text-text-secondary hover:text-text transition-all duration-200 hover:bg-background/50 rounded-lg"
            >
              <RiQuestionLine className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
              <span className="font-medium">FAQ</span>
            </a>
          </nav>
        </div>
      </div>
    </header>
  )
}
