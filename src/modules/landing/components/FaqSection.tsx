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
      question: 'What is Torrent Vibe?',
      answer:
        'Torrent Vibe is a modern, enhanced web interface for qBittorrent with improved design, performance, and features. It connects to your existing qBittorrent client and provides a beautiful, intuitive torrent management experience.',
      category: 'general',
    },
    {
      question: 'How do I get started?',
      answer:
        'Download and install Torrent Vibe for your platform (macOS, Linux), or use the web version. The setup wizard will guide you through connecting to your existing qBittorrent client in minutes.',
      category: 'technical',
    },
    {
      question: 'Is Torrent Vibe free?',
      answer:
        'We offer an unlimited trial version so you can try the basic features without restrictions. After the trial, purchase once for lifetime access to all current features and updates within the major version. No subscriptions or recurring fees.',
      category: 'general',
    },
    {
      question: 'Is my data safe?',
      answer:
        'Yes, completely. Torrent Vibe runs locally and never stores or accesses your torrent data, download history, or personal files. It only connects to your qBittorrent client.',
      category: 'general',
    },
    {
      question: 'What versions of qBittorrent does Torrent Vibe support?',
      answer:
        'Torrent Vibe supports qBittorrent API version 2, which is compatible with qBittorrent 4.1.0 and later versions. This ensures full compatibility with the latest qBittorrent features and improvements.',
      category: 'technical',
    },
    {
      question: 'How does the lifetime purchase work?',
      answer:
        'Buy once, use forever. Your purchased app will continue working indefinitely without any subscription fees or expiration dates. However, due to limited resources, we may not be able to provide continuous updates or new versions for the current major version. Major version upgrades (if any) would be separate purchases.',
      category: 'billing',
    },
    {
      question: 'What do I get after purchasing?',
      answer:
        "After purchasing, you'll receive a license key via email. Once you download and install the app, enter your license key, email, and GitHub username within the app. You'll then receive an invitation email to join our private GitHub repository, giving you access to future updates and the complete source code for custom integrations with qBittorrent.",
      category: 'billing',
    },
    {
      question: 'Do you offer refunds?',
      answer:
        "We don't offer refunds due to the digital nature of our software and unlimited trial. Please try the trial version thoroughly before purchasing to ensure it meets your needs.",
      category: 'billing',
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
              key={faq.question}
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
