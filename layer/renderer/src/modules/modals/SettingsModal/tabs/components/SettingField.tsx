import type { PropsWithChildren, ReactNode } from 'react'

import { Label } from '~/components/ui/label/Label'
import { cn } from '~/lib/cn'

export interface SettingFieldProps extends PropsWithChildren {
  label: ReactNode
  description?: ReactNode
  descriptionTrailing?: ReactNode
  htmlFor?: string
  controlAlign?: 'start' | 'end'
  controlClassName?: string
  dense?: boolean
}

export const SettingField = ({
  label,
  description,
  descriptionTrailing,
  htmlFor,
  children,
  controlAlign = 'end',
  controlClassName,
  dense = false,
}: SettingFieldProps) => {
  return (
    <div
      className={cn(
        'flex flex-col md:flex-row md:items-center md:justify-between',
        dense ? 'gap-1.5' : 'gap-2',
      )}
    >
      <div>
        <Label
          htmlFor={htmlFor}
          className={cn('text-text', dense && 'text-[13px]')}
        >
          {label}
        </Label>
        {description
          ? (
              <div className="mt-1 text-xs text-text-secondary flex items-center gap-2">
                <div className="min-w-0">{description}</div>
                {descriptionTrailing
                  ? (
                      <div className="ml-auto shrink-0">{descriptionTrailing}</div>
                    )
                  : null}
              </div>
            )
          : null}
      </div>
      <div
        className={cn(
          'w-full md:ml-8 md:max-w-[20rem] min-w-0 md:flex md:items-center',
          controlAlign === 'end' ? 'md:justify-end' : 'md:justify-start',
          controlClassName,
        )}
      >
        {children}
      </div>
    </div>
  )
}
