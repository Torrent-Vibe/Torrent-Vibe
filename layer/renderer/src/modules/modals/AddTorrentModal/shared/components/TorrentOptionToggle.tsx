import type { ReactNode } from 'react'

import { Checkbox } from '~/components/ui/checkbox'

interface TorrentOptionToggleProps {
  checked: boolean
  id: string
  label: ReactNode
  onChange: (checked: boolean) => void
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
        checked={checked}
        id={id}
        onCheckedChange={(value) => onChange(Boolean(value))}
      />
      <label className="text-sm ml-3" htmlFor={id}>
        {label}
      </label>
    </div>
  )
}
