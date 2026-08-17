import { useAtomValue, useSetAtom } from 'jotai'
import { m } from 'motion/react'
import { useCallback, useMemo, useState } from 'react'

import { Button } from '~/components/ui/button'
import { Switch } from '~/components/ui/switch'
import { cn } from '~/lib/cn'
import { Spring } from '~/lib/spring'

import { mobileCellConfigAtom } from '../atoms/mobile-layout'
import {
  ALL_MOBILE_FIELDS,
  DEFAULT_MOBILE_FIELDS,
} from '../constants/mobile-fields'

interface MobileFieldSelectorContentProps {
  onClose?: () => void
}

export const MobileFieldSelectorContent = ({
  onClose,
}: MobileFieldSelectorContentProps) => {
  const config = useAtomValue(mobileCellConfigAtom)
  const setConfig = useSetAtom(mobileCellConfigAtom)

  // Local state for preview
  const [previewFields, setPreviewFields] = useState(config.fields)

  // Group fields by category for better organization
  const fieldGroups = useMemo(() => {
    return {
      primary: ALL_MOBILE_FIELDS.filter((f) => f.category === 'primary'),
      details: ALL_MOBILE_FIELDS.filter((f) => f.category === 'details'),
      speeds: ALL_MOBILE_FIELDS.filter((f) => f.category === 'speeds'),
      dates: ALL_MOBILE_FIELDS.filter((f) => f.category === 'dates'),
      advanced: ALL_MOBILE_FIELDS.filter((f) => f.category === 'advanced'),
    }
  }, [])

  const handleFieldToggle = useCallback((fieldId: string) => {
    setPreviewFields((prev) =>
      prev.map((field) =>
        field.id === fieldId ? { ...field, visible: !field.visible } : field,
      ),
    )
  }, [])

  const handleApply = useCallback(() => {
    // Validate that at least one primary field is visible
    const hasPrimaryField = previewFields.some((f) => f.primary && f.visible)
    if (!hasPrimaryField) {
      // Show error or force enable name field
      const updatedFields = previewFields.map((f) =>
        f.id === 'name' ? { ...f, visible: true } : f,
      )
      setConfig((prev) => ({ ...prev, fields: updatedFields }))
    } else {
      setConfig((prev) => ({ ...prev, fields: previewFields }))
    }
    onClose?.()
  }, [previewFields, setConfig, onClose])

  const handleReset = useCallback(() => {
    setPreviewFields(DEFAULT_MOBILE_FIELDS)
  }, [])

  const handleCancel = useCallback(() => {
    setPreviewFields(config.fields)
    onClose?.()
  }, [config.fields, onClose])

  return (
    <>
      {/* Header */}
      <div className="px-6 pb-4">
        <h2 className="text-lg font-semibold text-text">
          Customize Cell Fields
        </h2>
        <p className="text-sm text-placeholder-text mt-1">
          Choose which information to display on torrent cells
        </p>
      </div>

      {/* Fields List */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
        {Object.entries(fieldGroups).map(([groupKey, fields]) => {
          if (fields.length === 0) return null

          const groupLabels = {
            primary: 'Primary Information',
            details: 'Details',
            speeds: 'Speed & Progress',
            dates: 'Dates & Time',
            advanced: 'Advanced',
          }

          return (
            <div className="space-y-3" key={groupKey}>
              <h4 className="text-xs font-medium text-placeholder-text uppercase tracking-wide">
                {groupLabels[groupKey as keyof typeof groupLabels]}
              </h4>
              <div className="space-y-2">
                {fields.map((field) => {
                  const previewField = previewFields.find(
                    (f) => f.id === field.id,
                  )
                  const isChecked = previewField?.visible ?? field.visible
                  const isDisabled = field.id === 'name' // Name is always required

                  return (
                    <m.div
                      layout
                      key={field.id}
                      transition={Spring.presets.smooth}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg border border-border',
                        'bg-material-medium hover:bg-fill-secondary transition-colors',
                        isDisabled && 'opacity-50',
                      )}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {field.icon && (
                          <i
                            className={cn('text-placeholder-text', field.icon)}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-text">
                            {field.label}
                          </div>
                          {field.description && (
                            <div className="text-xs text-placeholder-text mt-0.5">
                              {field.description}
                            </div>
                          )}
                        </div>
                      </div>

                      <Switch
                        checked={isChecked}
                        disabled={isDisabled}
                        onCheckedChange={() =>
                          !isDisabled && handleFieldToggle(field.id)
                        }
                      />
                    </m.div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Preview section */}
      <div className="px-6 pb-4">
        <div className="border-t border-border pt-4">
          <h4 className="text-xs font-medium text-placeholder-text uppercase tracking-wide mb-3">
            Preview
          </h4>
          <div className="text-xs text-placeholder-text mb-2">
            {previewFields.filter((f) => f.visible).length} fields selected
          </div>
          <div className="flex flex-wrap gap-1">
            {previewFields
              .filter((f) => f.visible)
              .map((field) => (
                <span
                  className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-fill-secondary text-text border border-border"
                  key={field.id}
                >
                  {field.icon && <i className={cn('mr-1', field.icon)} />}
                  {field.label}
                </span>
              ))}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between gap-3 px-6 pb-6 pt-2 border-t border-border mt-auto">
        <Button
          className="flex-1"
          size="sm"
          variant="secondary"
          onClick={handleReset}
        >
          Reset to Default
        </Button>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <Button className="min-w-[80px]" size="sm" onClick={handleApply}>
            Apply
          </Button>
        </div>
      </div>
    </>
  )
}
