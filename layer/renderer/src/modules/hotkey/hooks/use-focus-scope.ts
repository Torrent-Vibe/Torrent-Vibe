import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useRef, useState } from 'react'

import { hotkeyManager } from '../core/hotkey-manager-core'
import type { FocusScopeOptions, ScopeDefinition } from '../types'
import { ScopeActivationStrategy } from '../types'

export function useFocusScope<T>(
  scopeId: string,
  options: FocusScopeOptions = {},
) {
  const elementRef = useRef<HTMLElement>(null)
  const [elementState, setElementState] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const element = elementState || elementRef.current

    if (!element) return

    // Set scope identifier on element
    element.dataset.hotkeyScope = scopeId

    // Set metadata if provided
    if (options.metadata) {
      Object.entries(options.metadata).forEach(([key, value]) => {
        element.dataset[
          `hotkeyMeta${key.charAt(0).toUpperCase() + key.slice(1)}`
        ] = String(value)
      })
    }

    // Create scope definition
    const scopeDefinition: ScopeDefinition = {
      id: scopeId,
      parentId: options.parentScope,
      priority: options.priority || 0,
      strategy: options.strategy || ScopeActivationStrategy.UNION,
      hotkeyInheritance: options.inheritFrom
        ? options.inheritFrom.map((fromScope) => ({
            fromScope,
            combos: '*',
            mode: 'inherit' as const,
          }))
        : [],
      autoActivate: options.autoActivate !== false,
      focusSelector: options.focusSelector,
      conditionalActivation: options.conditionalActivation,
      metadata: options.metadata,
    }

    // Register scope with hotkey manager
    hotkeyManager.registerScope(scopeId, scopeDefinition)

    // Auto-activate if configured
    if (scopeDefinition.autoActivate) {
      hotkeyManager.activateScope(scopeId)
    }

    return () => {
      // Clean up scope data
      delete element.dataset.hotkeyScope

      // Remove metadata
      if (options.metadata) {
        Object.keys(options.metadata).forEach((key) => {
          delete element.dataset[
            `hotkeyMeta${key.charAt(0).toUpperCase() + key.slice(1)}`
          ]
        })
      }

      // Deactivate and unregister scope
      hotkeyManager.deactivateScope(scopeId)
      // Note: Scope definitions are kept in manager for potential reuse
    }
  }, [
    scopeId,
    options.parentScope,
    options.priority,
    options.strategy,
    options.autoActivate,
    options.metadata,
    options.inheritFrom,
    options.focusSelector,
    options.conditionalActivation,
    elementState,
  ])

  return [elementRef, setElementState, elementState] as any as [
    React.RefObject<T>,
    Dispatch<SetStateAction<T>>,
    T | null,
  ]
}
