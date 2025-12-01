import type { KeyBindingMap, KeyBindingOptions } from 'tinykeys'
import { tinykeys } from 'tinykeys'

import type { HotkeyConfig, ResolvedHotkey } from '../types'

export type KeyEventHandler = (combo: string, event: KeyboardEvent) => void

export class TinykeysAdapter {
  private currentBindings = new Map<string, ResolvedHotkey>()
  private unsubscribe: (() => void) | null = null
  private eventHandler: KeyEventHandler
  private config: Partial<HotkeyConfig> = {
    enabled: true,
    preventDefault: true,
    stopPropagation: false,
  }

  constructor(eventHandler: KeyEventHandler) {
    this.eventHandler = eventHandler
  }

  updateBindings(resolvedHotkeys: Map<string, ResolvedHotkey>): void {
    if (!this.config.enabled) return

    // Check if bindings have actually changed to avoid unnecessary updates
    if (this.areBindingsEqual(this.currentBindings, resolvedHotkeys)) {
      return
    }

    // Cleanup existing bindings
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }

    // Update current bindings
    this.currentBindings = new Map(resolvedHotkeys)

    // Create new bindings if we have any
    if (resolvedHotkeys.size > 0) {
      this.setupTinykeysBindings(resolvedHotkeys)
    }
  }

  private areBindingsEqual(
    current: Map<string, ResolvedHotkey>,
    incoming: Map<string, ResolvedHotkey>,
  ): boolean {
    if (current.size !== incoming.size) return false

    for (const [combo, hotkey] of incoming) {
      const currentHotkey = current.get(combo)
      if (!currentHotkey || !this.areHotkeysEqual(currentHotkey, hotkey)) {
        return false
      }
    }

    return true
  }

  private areHotkeysEqual(h1: ResolvedHotkey, h2: ResolvedHotkey): boolean {
    return (
      h1.combo === h2.combo &&
      h1.scopeId === h2.scopeId &&
      h1.disabled === h2.disabled &&
      h1.preventDefault === h2.preventDefault &&
      h1.stopPropagation === h2.stopPropagation
    )
  }

  private setupTinykeysBindings(
    resolvedHotkeys: Map<string, ResolvedHotkey>,
  ): void {
    // Convert resolved hotkeys to tinykeys format
    const keyBindingMap: KeyBindingMap = {}
    const options: KeyBindingOptions = {
      event: 'keydown',
    }

    resolvedHotkeys.forEach((hotkey, combo) => {
      if (!hotkey.disabled) {
        // Normalize combo for tinykeys
        const normalizedCombo = this.normalizeCombo(combo)

        keyBindingMap[normalizedCombo] = (event) => {
          this.handleKeyEvent(hotkey, combo, event)
        }
      }
    })

    // Setup tinykeys with the bindings
    if (Object.keys(keyBindingMap).length > 0) {
      this.unsubscribe = tinykeys(window, keyBindingMap, options)
    }
  }

  private normalizeCombo(combo: string): string {
    // Normalize key combinations for consistent tinykeys usage
    return (
      combo
        .toLowerCase()
        // Fix spacing
        .replaceAll(/\s+/g, '')
        .split('+')
        .map((part) => part.trim())
        .join('+')
    )
  }

  private handleKeyEvent(
    hotkey: ResolvedHotkey,
    originalCombo: string,
    event: KeyboardEvent,
  ): void {
    // Apply event handling options
    let shouldPreventDefault = hotkey.preventDefault
    let shouldStopPropagation = hotkey.stopPropagation

    // Override with global config if not explicitly set
    if (shouldPreventDefault === undefined) {
      shouldPreventDefault = this.config.preventDefault ?? true
    }
    if (shouldStopPropagation === undefined) {
      shouldStopPropagation = this.config.stopPropagation ?? false
    }

    // Apply event modifications
    if (shouldPreventDefault) {
      event.preventDefault()
    }
    if (shouldStopPropagation) {
      event.stopPropagation()
    }

    // Call the event handler
    try {
      this.eventHandler(originalCombo, event)
    } catch (error) {
      console.error(
        `[TinykeysAdapter] Error handling key event for ${originalCombo}:`,
        error,
      )
    }
  }

  // Configuration management
  updateConfig(config: Partial<HotkeyConfig>): void {
    this.config = { ...this.config, ...config }

    // If enabled state changed, update bindings
    if (config.enabled !== undefined) {
      if (config.enabled) {
        this.updateBindings(this.currentBindings)
      } else {
        this.disable()
      }
    }
  }

  enable(): void {
    this.config.enabled = true
    this.updateBindings(this.currentBindings)
  }

  disable(): void {
    this.config.enabled = false
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }
  }

  // Removed: simulate key press and browser conflict handling for simplicity

  // Cleanup
  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }

    this.currentBindings.clear()
  }
}
