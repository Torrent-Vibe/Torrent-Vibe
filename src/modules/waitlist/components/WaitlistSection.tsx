import { WaitlistForm } from './WaitlistForm'

interface WaitlistSectionProps {
  title?: string
  description?: string
  className?: string
}

export function WaitlistSection({
  title = 'Join the Waitlist',
  description = 'Be the first to know when we launch. Get early access and exclusive updates.',
  className,
}: WaitlistSectionProps) {
  return (
    <section className={`py-16 px-4 ${className || ''}`}>
      <div className="max-w-md mx-auto text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-text mb-4">
          {title}
        </h2>
        <p className="text-text-secondary mb-8">{description}</p>
        <WaitlistForm />
      </div>
    </section>
  )
}
