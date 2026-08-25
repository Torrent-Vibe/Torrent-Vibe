import type { ComponentProps } from 'react'
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom'

import { Button } from '~/components/ui/button/Button'
import { cn } from '~/lib/cn'

// Adapted from Vercel AI Elements Conversation.
export const Conversation = ({
  className,
  ...props
}: ComponentProps<typeof StickToBottom>) => (
  <StickToBottom
    initial="smooth"
    resize="smooth"
    className={cn(
      'relative min-h-0 min-w-0 flex-1 overflow-hidden [&>div]:min-w-0 [&>div]:overflow-x-hidden [&>div]:overflow-y-auto [&>div]:![scrollbar-gutter:stable]',
      className,
    )}
    {...props}
  />
)

export const ConversationContent = ({
  className,
  ...props
}: ComponentProps<typeof StickToBottom.Content>) => (
  <StickToBottom.Content
    className={cn('flex min-h-full min-w-0 flex-col', className)}
    {...props}
  />
)

export const ConversationScrollButton = () => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext()
  if (isAtBottom) return null

  return (
    <Button
      aria-label="Scroll to latest message"
      className="absolute bottom-3 left-1/2 z-10 size-8 -translate-x-1/2 rounded-full p-0"
      variant="secondary"
      onClick={() => void scrollToBottom()}
    >
      <i className="i-mingcute-arrow-down-line" />
    </Button>
  )
}
