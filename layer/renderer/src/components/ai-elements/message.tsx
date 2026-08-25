import { cjk } from '@streamdown/cjk'
import { code } from '@streamdown/code'
import { math } from '@streamdown/math'
import { mermaid } from '@streamdown/mermaid'
import type { ComponentProps } from 'react'
import { memo } from 'react'
import { Streamdown } from 'streamdown'

import { cn } from '~/lib/cn'

// Adapted from Vercel AI Elements Message for this app's design tokens.
export const Message = ({
  className,
  from,
  ...props
}: ComponentProps<'div'> & { from: 'assistant' | 'user' }) => (
  <div
    className={cn(
      'group flex w-full items-end gap-2',
      from === 'user' ? 'justify-end' : 'justify-start',
      className,
    )}
    {...props}
  />
)

export const MessageContent = ({
  children,
  className,
  from,
  ...props
}: ComponentProps<'div'> & { from: 'assistant' | 'user' }) => (
  <div
    className={cn(
      'min-w-0 text-sm leading-6',
      from === 'user'
        ? 'max-w-[88%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2.5 text-background shadow-sm'
        : 'w-full text-text-secondary',
      className,
    )}
    {...props}
  >
    {children}
  </div>
)

const plugins = { cjk, code, math, mermaid }

export const MessageResponse = memo(
  ({ className, ...props }: ComponentProps<typeof Streamdown>) => (
    <Streamdown
      animated
      plugins={plugins}
      className={cn(
        'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2',
        className,
      )}
      {...props}
    />
  ),
  (previous, next) =>
    previous.children === next.children &&
    previous.isAnimating === next.isAnimating,
)

MessageResponse.displayName = 'MessageResponse'
