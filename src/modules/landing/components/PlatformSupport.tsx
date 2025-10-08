import type { FC } from 'react'

export const PlatformSupport: FC = () => {
  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border">
      <div className="max-w-7xl mx-auto text-center">
        <p className="text-text-secondary mb-8">
          Available on all major platforms
        </p>
        <div className="flex items-center justify-center gap-8 text-text-secondary">
          <div className="flex items-center gap-2">
            <i className="i-lucide-apple text-2xl" />
            <span>macOS</span>
          </div>
          <div className="flex items-center gap-2">
            <i className="i-lucide-server text-2xl" />
            <span>Linux</span>
          </div>
          <div className="flex items-center gap-2">
            <i className="i-lucide-globe text-2xl" />
            <span>Web</span>
          </div>
        </div>
      </div>
    </section>
  )
}
