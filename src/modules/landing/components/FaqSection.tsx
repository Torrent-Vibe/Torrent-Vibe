'use client'

import { m } from 'motion/react'
import type { FC } from 'react'
import { useState } from 'react'

import { Spring } from '~/lib/spring'

interface FaqItem {
  question: string
  answer: string
  category: 'general' | 'technical' | 'billing'
}

export const FaqSection: FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const [activeCategory, setActiveCategory] = useState<string>('all')

  const faqs: FaqItem[] = [
    {
      question: 'What is Torrent Vibe and how does it work?',
      answer:
        'Torrent Vibe is a modern web interface for qBittorrent that provides enhanced functionality, better performance, and an intuitive user experience. It connects to your existing qBittorrent client and provides a beautiful, modern interface for managing your torrents.',
      category: 'general',
    },
    {
      question: 'Is Torrent Vibe completely free to use?',
      answer:
        'Torrent Vibe is available as a one-time purchase. You buy the app once and get access to all features, plus ongoing updates within the major version. No subscriptions or recurring fees required.',
      category: 'general',
    },
    {
      question: 'How do I install and set up Torrent Vibe?',
      answer:
        'Installation is simple! Download the appropriate version for your operating system, or use our web interface directly. The setup wizard will guide you through connecting to your qBittorrent client in just a few clicks.',
      category: 'technical',
    },
    {
      question: 'Does Torrent Vibe work with my existing qBittorrent setup?',
      answer:
        'Absolutely! Torrent Vibe is designed to work seamlessly with existing qBittorrent installations. It connects via the qBittorrent Web API, so your existing torrents, settings, and data remain untouched.',
      category: 'technical',
    },
    {
      question: 'What platforms and devices are supported?',
      answer:
        'Torrent Vibe works on Windows, macOS, Linux, and through any modern web browser. We also provide mobile-optimized interfaces for managing your torrents on the go.',
      category: 'technical',
    },
    {
      question: 'How does the one-time purchase work?',
      answer:
        'Torrent Vibe is available as a one-time purchase with no recurring fees. After purchase, you receive lifetime access to all features and ongoing updates within the current major version.',
      category: 'billing',
    },
    {
      question: 'What happens when a new major version is released?',
      answer:
        'When a new major version is released, existing users can continue using their current version with all purchased features. The new major version would be available as a separate purchase with new features and improvements.',
      category: 'billing',
    },
    {
      question: 'Is my data secure and private?',
      answer:
        'Absolutely. Torrent Vibe runs locally on your machine and connects directly to your qBittorrent client. We never store or have access to your torrent data, download history, or personal files.',
      category: 'general',
    },
  ]

  const categories = [
    { key: 'all', name: 'All Questions', icon: 'i-lucide-help-circle' },
    { key: 'general', name: 'General', icon: 'i-lucide-info' },
    { key: 'technical', name: 'Technical', icon: 'i-lucide-settings' },
    { key: 'billing', name: 'Billing', icon: 'i-lucide-credit-card' },
  ]

  const filteredFaqs =
    activeCategory === 'all'
      ? faqs
      : faqs.filter((faq) => faq.category === activeCategory)

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <m.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={Spring.smooth(0.8)}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
              Frequently Asked Questions
            </span>
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Get answers to the most common questions about Torrent Vibe. Can't
            find what you're looking for? Contact our support team.
          </p>
        </m.div>

        {/* Category Filter */}
        <m.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={Spring.smooth(0.6, 0.2)}
          viewport={{ once: true }}
          className="flex flex-wrap justify-center gap-2 mb-12"
        >
          {categories.map((category) => (
            <m.button
              key={category.key}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={Spring.snappy()}
              onClick={() => setActiveCategory(category.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                activeCategory === category.key
                  ? 'bg-accent text-white shadow-lg'
                  : 'bg-fill text-text-secondary hover:bg-accent/10 hover:text-accent'
              }`}
            >
              <i className={`${category.icon} text-sm`} />
              {category.name}
            </m.button>
          ))}
        </m.div>

        {/* FAQ Items */}
        <div className="space-y-4">
          {filteredFaqs.map((faq, index) => (
            <m.div
              key={`${activeCategory}-${index}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={Spring.smooth(0.4, 0.1 + index * 0.05)}
              viewport={{ once: true }}
              className="bg-background border border-border rounded-2xl overflow-hidden hover:border-accent/50 "
            >
              <m.button
                onClick={() => toggleFaq(index)}
                whileHover={{ backgroundColor: 'rgba(var(--fill-rgb), 0.3)' }}
                transition={Spring.snappy()}
                className="w-full px-6 py-6 text-left flex items-center justify-between gap-4 hover:bg-fill/30"
              >
                <h3 className="text-lg font-semibold text-text pr-4">
                  {faq.question}
                </h3>
                <m.i
                  animate={{
                    rotate: openIndex === index ? 180 : 0,
                    color:
                      openIndex === index
                        ? 'rgb(var(--accent-rgb))'
                        : 'rgb(var(--text-secondary-rgb))',
                  }}
                  transition={Spring.snappy()}
                  className="i-lucide-chevron-down text-xl flex-shrink-0"
                />
              </m.button>

              <m.div
                initial={false}
                animate={{
                  height: openIndex === index ? 'auto' : 0,
                  opacity: openIndex === index ? 1 : 0,
                }}
                transition={Spring.smooth(0.3)}
                className="overflow-hidden"
              >
                <div className="px-6 pb-6 pt-0">
                  <div className="border-t border-border pt-4">
                    <p className="text-text-secondary leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </m.div>
            </m.div>
          ))}
        </div>
      </div>
    </section>
  )
}
