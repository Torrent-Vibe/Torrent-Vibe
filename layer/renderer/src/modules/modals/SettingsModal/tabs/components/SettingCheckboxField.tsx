import type { ReactNode } from 'react'

import { Checkbox } from '~/components/ui/checkbox'
import { Label } from '~/components/ui/label/Label'

import { SettingField } from './SettingField'

interface SettingCheckboxFieldProps {
  id?: string
  label: ReactNode
  description?: ReactNode
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}

export const SettingCheckboxField = ({
  id,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: SettingCheckboxFieldProps) => {
  return (
    <SettingField label={label} description={description}>
      <div className="flex items-center gap-2 justify-end w-full">
        <Checkbox
          id={id}
          checked={checked}
          disabled={disabled}
          onCheckedChange={(v) => onCheckedChange(Boolean(v))}
        />
        {id ? <Label htmlFor={id} className="text-xs text-text" /> : null}
      </div>
    </SettingField>
  )
}
