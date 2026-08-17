import type { ReactNode } from 'react'

import { Checkbox } from '~/components/ui/checkbox'
import { Label } from '~/components/ui/label/Label'

import { SettingField } from './SettingField'

interface SettingCheckboxFieldProps {
  checked: boolean
  description?: ReactNode
  disabled?: boolean
  id?: string
  label: ReactNode
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
    <SettingField description={description} label={label}>
      <div className="flex items-center gap-2 justify-end w-full">
        <Checkbox
          checked={checked}
          disabled={disabled}
          id={id}
          onCheckedChange={(v) => onCheckedChange(Boolean(v))}
        />
        {id ? <Label className="text-xs text-text" htmlFor={id} /> : null}
      </div>
    </SettingField>
  )
}
