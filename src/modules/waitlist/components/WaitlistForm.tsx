'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { addToWaitlist } from '~/lib/actions/waitlist'

interface WaitlistFormProps {
  className?: string
  placeholder?: string
  buttonText?: string
  successMessage?: string
}

export function WaitlistForm({
  className,
  placeholder = 'Enter your email',
  buttonText = 'Join Waitlist',
  successMessage = "Thanks for joining! We'll be in touch soon.",
}: WaitlistFormProps) {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      toast.error('Please enter your email address')
      return
    }

    setIsLoading(true)

    try {
      const result = await addToWaitlist(email.trim())

      if (result.success) {
        setIsSuccess(true)
        setEmail('')
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className={`text-center p-6 ${className || ''}`}>
        <div className="mb-3 mx-auto w-12 h-12 bg-green/10 rounded-full flex items-center justify-center">
          <i className="i-lucide-check w-6 h-6 text-green" />
        </div>
        <h3 className="text-lg font-medium text-text mb-2">
          You're on the list!
        </h3>
        <p className="text-text-secondary">{successMessage}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-3 ${className || ''}`}>
      <div className="relative">
        <Input
          autoFocus
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          disabled={isLoading}
          required
        />
      </div>

      <Button
        type="submit"
        isLoading={isLoading}
        loadingText="Joining..."
        className="w-full"
        disabled={!email.trim() || isLoading}
      >
        {buttonText}
      </Button>
    </form>
  )
}
