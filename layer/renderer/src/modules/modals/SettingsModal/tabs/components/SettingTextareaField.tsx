import type { ReactNode,TextareaHTMLAttributes } from 'react'

import { Textarea } from '~/components/ui/input/Textarea'

import { SettingField } from './SettingField'

interface SettingTextareaFieldProps
  extends Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    'onChange' | 'value'
  > {
  id?: string
  label: ReactNode
  description?: ReactNode
  value: string
  onChange: (value: string) => void
  rows?: number
}

export const SettingTextareaField = ({
  id,
  label,
  description,
  value,
  onChange,
  rows = 4,
  ...rest
}: SettingTextareaFieldProps) => {
  return (
    <SettingField label={label} description={description} htmlFor={id}>
      <Textarea
        id={id}
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs"
        {...rest}
      />
    </SettingField>
  )
}
