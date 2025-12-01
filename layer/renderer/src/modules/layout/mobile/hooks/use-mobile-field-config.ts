import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useMemo } from 'react'

import { mobileCellConfigAtom } from '../atoms/mobile-layout'
import {
  ALL_MOBILE_FIELDS,
  DEFAULT_MOBILE_FIELDS,
} from '../constants/mobile-fields'
import type { MobileCellConfig,MobileCellField } from '../types'

export interface MobileFieldConfigHook {
  // Current configuration
  config: MobileCellConfig
  fields: MobileCellField[]
  visibleFields: MobileCellField[]

  // Field management
  updateFieldVisibility: (fieldId: string, visible: boolean) => void
  updateFieldsConfig: (fields: MobileCellField[]) => void
  resetFields: () => void

  // Layout management
  setLayout: (layout: 'compact' | 'detailed') => void
  toggleProgressDisplay: () => void

  // Validation
  validateConfig: (fields: MobileCellField[]) => {
    valid: boolean
    errors: string[]
  }
}

export const useMobileFieldConfig = (): MobileFieldConfigHook => {
  const config = useAtomValue(mobileCellConfigAtom)
  const setConfig = useSetAtom(mobileCellConfigAtom)

  // Get current fields with visibility from config
  const fields = useMemo(() => {
    return ALL_MOBILE_FIELDS.map((field) => {
      const configField = config.fields.find((f) => f.id === field.id)
      return {
        ...field,
        visible: configField?.visible ?? field.visible,
      }
    })
  }, [config.fields])

  // Get only visible fields
  const visibleFields = useMemo(() => {
    return fields.filter((field) => field.visible)
  }, [fields])

  // Update individual field visibility
  const updateFieldVisibility = useCallback(
    (fieldId: string, visible: boolean) => {
      setConfig((prev) => ({
        ...prev,
        fields: prev.fields.map((field) =>
          field.id === fieldId ? { ...field, visible } : field,
        ),
      }))
    },
    [setConfig],
  )

  // Update entire fields configuration
  const updateFieldsConfig = useCallback(
    (newFields: MobileCellField[]) => {
      const validation = validateConfig(newFields)
      if (!validation.valid) {
        console.warn('Invalid field configuration:', validation.errors)
        return
      }

      setConfig((prev) => ({
        ...prev,
        fields: newFields,
      }))
    },
    [setConfig],
  )

  // Reset to default configuration
  const resetFields = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      fields: DEFAULT_MOBILE_FIELDS,
    }))
  }, [setConfig])

  // Update layout mode
  const setLayout = useCallback(
    (layout: 'compact' | 'detailed') => {
      setConfig((prev) => ({
        ...prev,
        layout,
      }))
    },
    [setConfig],
  )

  // Toggle progress bar display
  const toggleProgressDisplay = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      showProgress: !prev.showProgress,
    }))
  }, [setConfig])

  // Validate field configuration
  const validateConfig = useCallback((fieldsToValidate: MobileCellField[]) => {
    const errors: string[] = []

    // Must have at least one primary field visible
    const hasPrimaryField = fieldsToValidate.some((f) => f.primary && f.visible)
    if (!hasPrimaryField) {
      errors.push('At least one primary field (like Name) must be visible')
    }

    // Name field should always be visible (enforced in UI)
    const nameField = fieldsToValidate.find((f) => f.id === 'name')
    if (nameField && !nameField.visible) {
      errors.push('Name field should remain visible for usability')
    }

    // Reasonable number of visible fields (mobile space constraint)
    const visibleCount = fieldsToValidate.filter((f) => f.visible).length
    if (visibleCount > 10) {
      errors.push(
        'Too many fields selected. Consider reducing for better mobile experience',
      )
    }
    if (visibleCount === 0) {
      errors.push('At least one field must be visible')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }, [])

  return {
    config,
    fields,
    visibleFields,
    updateFieldVisibility,
    updateFieldsConfig,
    resetFields,
    setLayout,
    toggleProgressDisplay,
    validateConfig,
  }
}
