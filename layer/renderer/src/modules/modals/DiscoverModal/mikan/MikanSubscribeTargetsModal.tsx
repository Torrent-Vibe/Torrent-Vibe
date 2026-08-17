import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import { DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import type { ModalComponent } from '~/components/ui/modal/types'
import { useServerHelperTargets } from '~/modules/helper-client/hooks'

export const MikanSubscribeTargetsModal: ModalComponent<{
  title?: string
  initialIds: string[]
  onConfirm: (serverIds: string[]) => void | Promise<void>
}> = ({ dismiss, title, initialIds, onConfirm }) => {
  const { t } = useTranslation('app')
  const targets = useServerHelperTargets().filter((target) => target.paired)
  const [selected, setSelected] = useState<string[]>(() =>
    initialIds.filter((id) => targets.some((target) => target.id === id)),
  )
  const [submitting, setSubmitting] = useState(false)
  const selectedSet = useMemo(() => new Set(selected), [selected])

  const toggle = (id: string) => {
    setSelected((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id)
      }
      return [...current, id]
    })
  }

  return (
    <div className="w-full max-w-md">
      <DialogHeader>
        <DialogTitle>
          {title ?? t('discover.modal.mikan.selectTargets')}
        </DialogTitle>
      </DialogHeader>
      <p className="mb-3 text-sm text-text-secondary">
        {t('discover.modal.mikan.selectTargetsDescription')}
      </p>
      <div className="space-y-2">
        {targets.map((target) => (
          <label
            className="flex items-center gap-2 rounded-md px-1 py-1.5 text-sm text-text"
            key={target.id}
          >
            <Checkbox
              checked={selectedSet.has(target.id)}
              size="sm"
              onCheckedChange={() => toggle(target.id)}
            />
            <span>{target.name}</span>
          </label>
        ))}
      </div>
      <DialogFooter className="mt-4">
        <Button disabled={submitting} variant="ghost" onClick={dismiss}>
          {t('common.cancel')}
        </Button>
        <Button
          disabled={selected.length === 0 || submitting}
          onClick={async () => {
            setSubmitting(true)
            try {
              await onConfirm(selected)
              dismiss()
            } finally {
              setSubmitting(false)
            }
          }}
        >
          {t('common.confirm')}
        </Button>
      </DialogFooter>
    </div>
  )
}
