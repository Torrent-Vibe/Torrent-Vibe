import type { ReactNode } from 'react'

import { Checkbox } from '~/components/ui/checkbox'

interface TorrentOptionToggleProps {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
}

export const TorrentOptionToggle = ({
  id,
  checked,
  onChange,
  label,
}: TorrentOptionToggleProps) => {
  return (
    <div className="flex items-center">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onChange(Boolean(value))}
      />
      <label htmlFor={id} className="text-sm ml-3">
        {label}
      </label>
    </div>
  )
}
