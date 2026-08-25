import type { ComponentProps } from 'react'

import { cn } from '~/lib/cn'

import { MessageResponse } from './message'

// Adapted from Vercel AI Elements Reasoning using native disclosure behavior.
export const Reasoning = ({
  children,
  className,
  isStreaming,
  label = 'Reasoning',
  ...props
}: Omit<ComponentProps<'details'>, 'children'> & {
  children: string
  isStreaming?: boolean
  label?: string
}) => (
  <details
    className={cn('mb-3 text-xs text-text-tertiary', className)}
    open={isStreaming || undefined}
    {...props}
  >
    <summary className="cursor-pointer select-none py-1 font-medium text-text-secondary">
      {label}
    </summary>
    <MessageResponse
      className="mt-1 border-l border-border pl-3 text-xs"
      isAnimating={isStreaming}
    >
      {children}
    </MessageResponse>
  </details>
)
