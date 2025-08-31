'use client'

import { m } from 'motion/react'
import type { FC } from 'react'

import { Spring } from '~/lib/spring'

interface PricingPlan {
  name: string
  price: string
  period: string
  description: string
  features: string[]
  popular?: boolean
  buttonText: string
  buttonVariant: 'primary' | 'secondary'
  onClick: () => void
}

export const BuySection: FC = () => {
  const plans: PricingPlan[] = [
    {
      name: 'Trial',
      price: '$0',
      period: 'forever',
      description: 'Try all features without restrictions before buying',
      features: [
        'Basic features included',
        'Unlimited trial period',
        'No feature limitations',
        'Test before you buy',
      ],
      buttonText: 'Start Free Trial',
      buttonVariant: 'secondary',
      onClick: () => {
        window.open('https://github.com/torrent-vibe/torrent-vibe', '_blank')
      },
    },
    {
      name: 'Lifetime',
      price: '$9.99',
      period: 'one-time',
      description:
        'Buy once, own forever. Includes all current major version updates',
      features: [
        'One-time purchase, no subscriptions',
        'All features unlocked permanently',
        'Lifetime updates within major version',
        'Private GitHub repository access',
        'Complete source code included',
        'Alternative Web UI for qBittorrent',
        'No recurring fees ever',
      ],
      popular: true,
      buttonText: 'Buy Lifetime Access',
      buttonVariant: 'primary',
      onClick: () => {
        window.open(
          'https://www.creem.io/payment/prod_3MvxEew9LAj3kofPW6vqia',
          '_blank',
        )
      },
    },
  ]

  return (
    <section
      id="pricing"
      className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background to-fill/30"
    >
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
              Buy Once, Own Forever
            </span>
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Try the trial version first, then purchase once for lifetime access.
            Get all current major version updates included, with separate
            purchases for major version upgrades.
          </p>
        </m.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <m.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={Spring.smooth(0.6, 0.2 + index * 0.1)}
              whileHover={{
                scale: 1.02,
                y: -10,
                transition: Spring.presets.smooth,
              }}
              viewport={{ once: true }}
              className={`relative flex flex-col bg-background border rounded-2xl p-8 hover:shadow-2xl hover:-translate-y-1 ${
                plan.popular
                  ? 'border-accent shadow-xl ring-2 ring-accent/20'
                  : 'border-border hover:border-accent/50'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-accent to-primary text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-2xl font-bold text-text mb-2">
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-4xl font-bold text-text">
                    {plan.price}
                  </span>
                  <span className="text-text-secondary">/{plan.period}</span>
                </div>
                <p className="text-text-secondary">{plan.description}</p>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <m.li
                    key={feature}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={Spring.smooth(
                      0.4,
                      0.4 + index * 0.1 + featureIndex * 0.05,
                    )}
                    viewport={{ once: true }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-5 h-5 bg-accent/20 rounded-full flex items-center justify-center">
                      <i className="i-lucide-check text-accent text-sm" />
                    </div>
                    <span className="text-text-secondary text-sm">
                      {feature}
                    </span>
                  </m.li>
                ))}
              </ul>

              <div className="flex-1" />
              <m.button
                onClick={plan.onClick}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={Spring.snappy()}
                className={`w-full py-3 px-6 rounded-full font-semibold ${
                  plan.buttonVariant === 'primary'
                    ? 'bg-gradient-to-r from-accent to-primary text-white shadow-lg hover:shadow-xl'
                    : 'border border-border text-text hover:bg-accent/10 hover:border-accent/50'
                }`}
              >
                {plan.buttonText}
              </m.button>
            </m.div>
          ))}
        </div>
      </div>
    </section>
  )
}
