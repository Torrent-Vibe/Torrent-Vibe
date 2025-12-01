import { createNanoEvents } from 'nanoevents'

import type {
  FocusContext,
  HotkeyBinding,
  HotkeyConfig,
  HotkeyDebugInfo,
  HotkeyManagerInterface,
  ResolvedHotkey,
  ScopeDefinition,
  ScopeState,
} from '../types'
import { HotkeyScope, ScopeActivationStrategy } from '../types'
import { ScopeResolver } from './scope-resolver'
import { TinykeysAdapter } from './tinykeys-adapter'

class HotkeyManagerCore implements HotkeyManagerInterface {
  private registry = new Map<string, HotkeyBinding>()
  private scopeDefinitions = new Map<string, ScopeDefinition>()
  private scopeStates = new Map<string, ScopeState>()
  private activeScopes = new Set<string>()
  private resolvedHotkeys = new Map<string, ResolvedHotkey>()
  private currentFocusContext: FocusContext | null = null
  private idCounter = 0
  private emitter = createNanoEvents<{
    'scope-activated': (scopeId: string) => void
    'scope-deactivated': (scopeId: string) => void
    'hotkey-triggered': (combo: string, context: FocusContext | null) => void
    'focus-changed': (context: FocusContext | null) => void
  }>()

  private config: HotkeyConfig = {
    enabled: true,
    debugMode: false,
    preventDefault: true,
    stopPropagation: false,
    maxScopeDepth: 6,
    debounceDelay: 16,
    enablePrediction: true,
  }

  private tinykeysAdapter: TinykeysAdapter
  private scopeResolver: ScopeResolver
  private performanceMetrics = {
    fps: 60,
    cpuUsage: 0,
    memoryUsage: 0,
    hotkeyLatency: 0,
  }

  constructor() {
    this.tinykeysAdapter = new TinykeysAdapter(this.handleKeyEvent.bind(this))
    this.scopeResolver = new ScopeResolver()

    // Initialize global scope
    this.registerScope(HotkeyScope.GLOBAL, {
      id: HotkeyScope.GLOBAL,
      priority: 0,
      strategy: ScopeActivationStrategy.UNION,
      hotkeyInheritance: [],
      autoActivate: true,
    })

    this.activateScope(HotkeyScope.GLOBAL)
  }

  // Core registration methods
  register(binding: HotkeyBinding): string {
    const id = this.generateId()
    const fullBinding: HotkeyBinding = {
      ...binding,
      priority: binding.priority || 0,
      preventDefault: binding.preventDefault ?? this.config.preventDefault,
      stopPropagation: binding.stopPropagation ?? this.config.stopPropagation,
    }

    this.registry.set(id, fullBinding)

    // Add to scope state
    const scopeState = this.scopeStates.get(binding.scopeId)

    if (scopeState) {
      scopeState.hotkeys.set(binding.combo, fullBinding)
    } else if (import.meta.env.DEV) {
      throw new Error(`Scope ${binding.scopeId} not found`)
    }

    // Recalculate active hotkeys if scope is active
    if (this.activeScopes.has(binding.scopeId)) {
      this.reconcileHotkeys()
    }

    this.debugLog('Registered hotkey', { id, binding })
    return id
  }

  unregister(id: string): boolean {
    const binding = this.registry.get(id)
    if (!binding) return false

    this.registry.delete(id)

    // Remove from scope state
    const scopeState = this.scopeStates.get(binding.scopeId)
    if (scopeState) {
      scopeState.hotkeys.delete(binding.combo)
    }

    // Recalculate active hotkeys
    this.reconcileHotkeys()

    this.debugLog('Unregistered hotkey', { id, binding })
    return true
  }

  // Scope management
  registerScope(scopeId: string, definition: ScopeDefinition): void {
    this.scopeDefinitions.set(scopeId, definition)
    this.scopeStates.set(scopeId, {
      id: scopeId,
      active: false,
      hotkeys: new Map(),
    })

    this.scopeResolver.registerScope(definition)
    this.debugLog('Registered scope', { scopeId, definition })
  }

  unregisterScope(scopeId: string): void {
    this.scopeDefinitions.delete(scopeId)
    this.scopeStates.delete(scopeId)
    this.activeScopes.delete(scopeId)
    this.scopeResolver.unregisterScope(scopeId)
    this.debugLog('Unregistered scope', { scopeId })
  }

  // Accessors for scope definitions
  getScopeDefinition(scopeId: string): ScopeDefinition | undefined {
    return this.scopeDefinitions.get(scopeId)
  }

  activateScope(scopeId: string, context?: FocusContext): void {
    if (this.activeScopes.has(scopeId)) return

    const definition = this.scopeDefinitions.get(scopeId)
    if (!definition) {
      console.warn(`[Hotkey] Scope ${scopeId} not found`)
      return
    }

    // Check conditional activation
    if (
      definition.conditionalActivation &&
      context &&
      !definition.conditionalActivation(context)
    ) {
      return
    }

    const scopeState = this.scopeStates.get(scopeId)!
    scopeState.active = true
    scopeState.context = context
    scopeState.lastActivated = Date.now()

    this.activeScopes.add(scopeId)
    this.reconcileHotkeys()

    this.emitter.emit('scope-activated', scopeId)
    this.debugLog('Activated scope', { scopeId, context })
  }

  deactivateScope(scopeId: string): void {
    if (!this.activeScopes.has(scopeId)) return

    const scopeState = this.scopeStates.get(scopeId)!
    scopeState.active = false
    scopeState.context = undefined

    this.activeScopes.delete(scopeId)
    this.reconcileHotkeys()

    this.emitter.emit('scope-deactivated', scopeId)
    this.debugLog('Deactivated scope', { scopeId })
  }

  updateScopeState(scopeId: string, state: Partial<ScopeState>): void {
    const scopeState = this.scopeStates.get(scopeId)
    if (!scopeState) return

    Object.assign(scopeState, state)

    // Recheck conditional activation if state changed
    if (state.context && this.activeScopes.has(scopeId)) {
      const definition = this.scopeDefinitions.get(scopeId)
      if (
        definition?.conditionalActivation &&
        !definition.conditionalActivation(state.context)
      ) {
        this.deactivateScope(scopeId)
      }
    }
  }

  updateScopeCondition(scopeId: string, condition: () => boolean): void {
    const definition = this.scopeDefinitions.get(scopeId)
    if (!definition) return

    definition.conditionalActivation = () => condition()

    // Re-evaluate if scope is currently active
    if (this.activeScopes.has(scopeId) && !condition()) {
      this.deactivateScope(scopeId)
    }
  }

  // Core hotkey resolution
  private reconcileHotkeys(): void {
    const startTime = performance.now()

    // Get active scope hierarchy
    const activeScopes = Array.from(this.activeScopes)
      .map((id) => this.scopeDefinitions.get(id)!)
      .filter(Boolean)
      .sort((a, b) => b.priority - a.priority)

    // Resolve hotkeys using scope resolver
    this.resolvedHotkeys = this.scopeResolver.resolveActiveHotkeys(
      activeScopes,
      this.scopeStates,
      this.currentFocusContext || undefined,
    )

    // Update tinykeys bindings
    this.tinykeysAdapter.updateBindings(this.resolvedHotkeys)

    // Update performance metrics (minimal)
    this.performanceMetrics.hotkeyLatency = performance.now() - startTime

    this.debugLog('Reconciled hotkeys', {
      activeScopes: activeScopes.map((s) => s.id),
      resolvedCount: this.resolvedHotkeys.size,
    })
  }

  private handleKeyEvent(combo: string, event: KeyboardEvent): void {
    const resolvedHotkey = this.resolvedHotkeys.get(combo)
    if (!resolvedHotkey || resolvedHotkey.disabled) return

    // Handle event options
    if (resolvedHotkey.preventDefault) {
      event.preventDefault()
    }
    if (resolvedHotkey.stopPropagation) {
      event.stopPropagation()
    }

    // Execute handler
    try {
      resolvedHotkey.handler(event, this.currentFocusContext || undefined)
      this.emitter.emit('hotkey-triggered', combo, this.currentFocusContext)
    } catch (error) {
      console.error(`[Hotkey] Error executing handler for ${combo}:`, error)
    }
  }

  // Focus context management
  updateFocusContext(context: FocusContext | null): void {
    const previousContext = this.currentFocusContext
    this.currentFocusContext = context

    if (context) {
      // Activate scopes based on context
      context.scopePath.forEach((scopeId) => {
        this.activateScope(scopeId, context)
      })

      // Deactivate scopes not in current path
      this.activeScopes.forEach((scopeId) => {
        if (
          scopeId !== HotkeyScope.GLOBAL &&
          !context.scopePath.includes(scopeId as HotkeyScope)
        ) {
          this.deactivateScope(scopeId)
        }
      })
    } else {
      this.activeScopes.clear()
      this.debugLog('Focus context cleared')
    }

    this.emitter.emit('focus-changed', context || null)
    this.debugLog('Focus context updated', {
      previous: previousContext,
      current: context,
    })
  }

  // Utility methods
  getActiveHotkeys(): Map<string, ResolvedHotkey> {
    return new Map(this.resolvedHotkeys)
  }

  getDebugInfo(): HotkeyDebugInfo {
    return {
      activeScopes: Array.from(this.activeScopes),
      registeredHotkeys: new Map(this.resolvedHotkeys),
      focusContext: this.currentFocusContext,
      performanceMetrics: { ...this.performanceMetrics },
      scopeHierarchy: Array.from(this.scopeDefinitions.values()),
    }
  }

  // Configuration
  updateConfig(config: Partial<HotkeyConfig>): void {
    this.config = { ...this.config, ...config }
    this.tinykeysAdapter.updateConfig(this.config)
  }

  // Event subscription
  on(event: 'scope-activated', callback: (scopeId: string) => void): () => void
  on(
    event: 'scope-deactivated',
    callback: (scopeId: string) => void,
  ): () => void
  on(
    event: 'hotkey-triggered',
    callback: (combo: string, context: FocusContext | null) => void,
  ): () => void
  on(
    event: 'focus-changed',
    callback: (context: FocusContext | null) => void,
  ): () => void
  on(event: string, callback: (...args: any[]) => void): () => void {
    return this.emitter.on(event as any, callback)
  }

  // Utility methods
  private generateId(): string {
    return `hotkey_${++this.idCounter}_${Date.now()}`
  }

  private debugLog(message: string, data?: any): void {
    if (this.config.debugMode) {
      console.info(`[HotkeyManager] ${message}`, data)
    }
  }

  // Cleanup
  destroy(): void {
    this.tinykeysAdapter.destroy()
    this.registry.clear()
    this.scopeDefinitions.clear()
    this.scopeStates.clear()
    this.activeScopes.clear()
    this.resolvedHotkeys.clear()
  }
}

// Global instance
export const hotkeyManager = new HotkeyManagerCore()
