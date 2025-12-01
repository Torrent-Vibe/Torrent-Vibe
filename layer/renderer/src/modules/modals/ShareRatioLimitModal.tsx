import { useCallback, useState } from 'react'

import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import { DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import type {
  ModalComponent,
  ModalComponentProps,
} from '~/components/ui/modal/types'
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio'

interface ShareRatioLimitModalOwnProps {
  currentRatio?: number
  currentSeedingTime?: number
  currentInactiveSeedingTime?: number
  onConfirm: (settings: {
    ratioLimit?: number
    seedingTimeLimit?: number
    inactiveSeedingTimeLimit?: number
  }) => void
}

type ShareRatioLimitModalProps = ShareRatioLimitModalOwnProps &
  ModalComponentProps

type LimitMode = 'global' | 'unlimited' | 'custom'

export const ShareRatioLimitModal: ModalComponent<
  ShareRatioLimitModalOwnProps
> = ({
  currentRatio = -1,
  currentSeedingTime = -1,
  currentInactiveSeedingTime = -1,
  onConfirm,
  dismiss,
}: ShareRatioLimitModalProps) => {
  // Determine initial mode based on current values
  const getInitialMode = (): LimitMode => {
    if (currentRatio === -2) return 'global'
    if (currentRatio === -1) return 'unlimited'
    return 'custom'
  }

  const [limitMode, setLimitMode] = useState<LimitMode>(() => getInitialMode())
  const [ratio, setRatio] = useState(
    currentRatio > 0 ? currentRatio.toString() : '0.00',
  )
  const [seedingTime, setSeedingTime] = useState(
    currentSeedingTime > 0 ? currentSeedingTime.toString() : '0',
  )
  const [inactiveSeedingTime, setInactiveSeedingTime] = useState(
    currentInactiveSeedingTime > 0
      ? currentInactiveSeedingTime.toString()
      : '0',
  )

  const [useRatio, setUseRatio] = useState(currentRatio > 0)
  const [useSeedingTime, setUseSeedingTime] = useState(currentSeedingTime > 0)
  const [useInactiveSeedingTime, setUseInactiveSeedingTime] = useState(
    currentInactiveSeedingTime > 0,
  )

  const handleSave = useCallback(() => {
    const settings: {
      ratioLimit: number
      seedingTimeLimit: number
      inactiveSeedingTimeLimit: number
    } = {
      ratioLimit: -1,
      seedingTimeLimit: -1,
      inactiveSeedingTimeLimit: -1,
    }

    switch (limitMode) {
      case 'global': {
        settings.ratioLimit = -2
        settings.seedingTimeLimit = -2
        settings.inactiveSeedingTimeLimit = -2
        break
      }
      case 'unlimited': {
        break
      }
      case 'custom': {
        if (useRatio) {
          const ratioValue = Number.parseFloat(ratio)
          settings.ratioLimit = !Number.isNaN(ratioValue) ? ratioValue : -1
        }
        if (useSeedingTime) {
          const timeValue = Number.parseInt(seedingTime, 10)
          settings.seedingTimeLimit = !Number.isNaN(timeValue) ? timeValue : -1
        }
        if (useInactiveSeedingTime) {
          const inactiveTimeValue = Number.parseInt(inactiveSeedingTime, 10)
          settings.inactiveSeedingTimeLimit = !Number.isNaN(inactiveTimeValue)
            ? inactiveTimeValue
            : -1
        }
        break
      }
    }

    onConfirm(settings)
    dismiss()
  }, [
    limitMode,
    ratio,
    seedingTime,
    inactiveSeedingTime,
    useRatio,
    useSeedingTime,
    useInactiveSeedingTime,
    onConfirm,
    dismiss,
  ])

  return (
    <div>
      {/* Header */}
      <DialogHeader>
        <DialogTitle>Torrent Upload/Download Ratio Limit</DialogTitle>
      </DialogHeader>

      {/* Radio options */}
      <div className="mb-6 mt-4">
        <RadioGroup
          value={limitMode}
          onValueChange={(value) => setLimitMode(value as LimitMode)}
          className="flex flex-col gap-2"
        >
          {/* Global share limit */}
          <label className="flex items-center gap-3 cursor-button">
            <RadioGroupItem value="global" />
            <span className="text-text">Use global share limits</span>
          </label>

          {/* Unlimited */}
          <label className="flex items-center gap-3 cursor-button">
            <RadioGroupItem value="unlimited" />
            <span className="text-text">Set as unlimited share limit</span>
          </label>

          {/* Custom limits */}
          <label className="flex items-center gap-3 cursor-button">
            <RadioGroupItem value="custom" />
            <span className="text-text">Set share limits as</span>
          </label>
        </RadioGroup>

        {/* Custom options - only show when custom is selected */}
        {limitMode === 'custom' && (
          <div className="ml-7 space-y-1.5 mt-1">
            {/* Ratio */}
            <div className="flex items-center gap-3">
              <Checkbox
                id="ratio"
                size="sm"
                checked={useRatio}
                onCheckedChange={(checked) => setUseRatio(Boolean(checked))}
                className="shrink-0"
              />
              <label
                htmlFor="ratio"
                className="text-text min-w-0 text-sm flex-1"
              >
                Ratio
              </label>
              <Input
                size="sm"
                type="number"
                value={ratio}
                onChange={(e) => setRatio(e.target.value)}
                disabled={!useRatio}
                className="w-24"
                step="0.01"
                min="0"
                placeholder="0.00"
              />
            </div>

            {/* Seeding time */}
            <div className="flex items-center gap-3">
              <Checkbox
                id="seedingTime"
                size="sm"
                checked={useSeedingTime}
                onCheckedChange={(checked) =>
                  setUseSeedingTime(Boolean(checked))
                }
                className="shrink-0"
              />
              <label
                htmlFor="seedingTime"
                className="text-text min-w-0 text-sm flex-1"
              >
                Total minutes
              </label>
              <Input
                size="sm"
                type="number"
                value={seedingTime}
                onChange={(e) => setSeedingTime(e.target.value)}
                disabled={!useSeedingTime}
                className="w-24"
                min="0"
                placeholder="0"
              />
            </div>

            {/* Inactive seeding time */}
            <div className="flex items-center gap-3">
              <Checkbox
                id="inactiveSeedingTime"
                checked={useInactiveSeedingTime}
                onCheckedChange={(checked) =>
                  setUseInactiveSeedingTime(Boolean(checked))
                }
                size="sm"
                className="shrink-0"
              />
              <label
                htmlFor="inactiveSeedingTime"
                className="text-text min-w-0 text-sm flex-1"
              >
                Inactive minutes
              </label>
              <Input
                size="sm"
                type="number"
                value={inactiveSeedingTime}
                onChange={(e) => setInactiveSeedingTime(e.target.value)}
                disabled={!useInactiveSeedingTime}
                className="w-24"
                min="0"
                placeholder="0"
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <Button onClick={handleSave} size="sm" className="px-6">
          Save
        </Button>
      </div>
    </div>
  )
}
