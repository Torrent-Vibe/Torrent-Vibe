import { useEffect, useRef } from 'react'

import { hotkeyManager } from '../core/hotkey-manager-core'
import type { FocusContext, HotkeyRegistrationOptions } from '../types'
import { HotkeyScope } from '../types'

export function useHotkey(
  combo: string,
  handler: (
    event: KeyboardEvent,
    context?: FocusContext,
  ) => void | Promise<void>,
  options: HotkeyRegistrationOptions = {},
): void {
  const handlerRef = useRef(handler)
  const registrationIdRef = useRef<string | null>(null)

  handlerRef.current = handler

  useEffect(() => {
    if (typeof options.waitFor === 'function' && !options.waitFor()) return
    const stableHandler = (event: KeyboardEvent, context?: FocusContext) => {
      return handlerRef.current(event, context)
    }

    const id = hotkeyManager.register({
      combo,
      handler: stableHandler,
      scopeId: options.scope || HotkeyScope.GLOBAL,
      description: options.description,
      category: options.category,
      disabled: options.disabled,
      preventDefault: options.preventDefault,
      stopPropagation: options.stopPropagation,
      priority: options.priority,
    })

    registrationIdRef.current = id

    return () => {
      if (registrationIdRef.current) {
        hotkeyManager.unregister(registrationIdRef.current)
        registrationIdRef.current = null
      }
    }
  }, [
    combo,
    options.scope,
    options.description,
    options.category,
    options.disabled,
    options.preventDefault,
    options.stopPropagation,
    options.priority,
    options.waitFor,
    options,
  ])
}
