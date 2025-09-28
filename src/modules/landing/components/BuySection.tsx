'use client'

import type { FC } from 'react'

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
        'Alternative Web UI for qBittorrent',
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
        'No recurring fees ever',
        'AI-powered advanced torrent management',
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
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-5xl font-bold mb-6 text-text">
            Buy Once, <span className="text-accent">Own Forever</span>
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Try the trial version first, then purchase once for lifetime access.
            Get all current major version updates included, with separate
            purchases for major version upgrades.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col bg-background border rounded-xl p-8 transition-all hover:shadow-lg ${
                plan.popular
                  ? 'border-accent shadow-md ring-1 ring-accent/10'
                  : 'border-border hover:border-accent/30'
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
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-accent/20 rounded-full flex items-center justify-center">
                      <i className="i-lucide-check text-accent text-sm" />
                    </div>
                    <span className="text-text-secondary text-sm">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex-1" />
              <button
                type="button"
                onClick={plan.onClick}
                className={`w-full py-3 px-6 rounded-lg font-semibold transition-all ${
                  plan.buttonVariant === 'primary'
                    ? 'bg-accent text-white hover:bg-accent/90 shadow-md hover:shadow-lg'
                    : 'border border-border text-text hover:bg-accent/10 hover:border-accent/50'
                }`}
              >
                {plan.buttonText}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
