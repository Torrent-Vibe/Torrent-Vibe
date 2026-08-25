import type { ComponentProps, ElementType } from 'react'
import type { Components } from 'streamdown'

import { cn } from '~/lib/cn'

type MarkdownNodeProps<T extends ElementType> = ComponentProps<T> & {
  node?: unknown
}

const heading =
  <T extends 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'>(
    Tag: T,
    className: string,
  ) =>
  ({
    children,
    className: extra,
    node: _node,
    ...props
  }: MarkdownNodeProps<T>) => (
    <Tag className={cn(extra, className)} {...props}>
      {children}
    </Tag>
  )

export const chatMarkdownComponents: Components = {
  h1: heading(
    'h1',
    'mt-3 mb-1.5 text-[15px] font-semibold leading-5 tracking-tight text-balance text-text',
  ),
  h2: heading(
    'h2',
    'mt-3 mb-1 text-sm font-semibold leading-5 tracking-tight text-balance text-text',
  ),
  h3: heading(
    'h3',
    'mt-2.5 mb-1 text-sm font-semibold leading-5 text-balance text-text',
  ),
  h4: heading(
    'h4',
    'mt-2 mb-1 text-xs font-medium leading-4 text-text-secondary',
  ),
  h5: heading(
    'h5',
    'mt-2 mb-1 text-xs font-medium leading-4 text-text-secondary',
  ),
  h6: heading(
    'h6',
    'mt-2 mb-1 text-xs font-medium leading-4 text-text-secondary',
  ),
  hr: ({ className, node: _node, ...props }: MarkdownNodeProps<'hr'>) => (
    <hr className={cn(className, 'my-2.5 border-border')} {...props} />
  ),
  blockquote: ({
    children,
    className,
    node: _node,
    ...props
  }: MarkdownNodeProps<'blockquote'>) => (
    <blockquote
      className={cn(
        className,
        'my-2 border-l-2 border-border pl-2.5 text-text-tertiary',
      )}
      {...props}
    >
      {children}
    </blockquote>
  ),
  ul: ({
    children,
    className,
    node: _node,
    ...props
  }: MarkdownNodeProps<'ul'>) => (
    <ul
      className={cn(
        className,
        'my-1.5 list-inside list-disc whitespace-normal [li_&]:pl-4',
      )}
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({
    children,
    className,
    node: _node,
    ...props
  }: MarkdownNodeProps<'ol'>) => (
    <ol
      className={cn(
        className,
        'my-1.5 list-inside list-decimal whitespace-normal [li_&]:pl-4',
      )}
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({
    children,
    className,
    node: _node,
    ...props
  }: MarkdownNodeProps<'li'>) => (
    <li className={cn(className, 'py-0.5 [&>p]:inline')} {...props}>
      {children}
    </li>
  ),
}

export const chatMarkdownClassName =
  'min-w-0 max-w-full overflow-x-hidden break-words [&_p]:my-1.5 [&_p]:break-words [&_code]:break-all [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_[data-streamdown=table-wrapper]]:min-w-0 [&_[data-streamdown=table-wrapper]]:max-w-full [&_[data-streamdown=table-header-cell]]:px-2.5 [&_[data-streamdown=table-header-cell]]:py-1.5 [&_[data-streamdown=table-header-cell]]:text-xs [&_[data-streamdown=table-cell]]:px-2.5 [&_[data-streamdown=table-cell]]:py-1.5 [&_[data-streamdown=table-cell]]:text-xs [&_[data-streamdown=inline-code]]:break-all [&_[data-streamdown=inline-code]]:text-[12px]'
