import type {
  FocusContext,
  HotkeyBinding,
  ResolvedHotkey,
  ScopeDefinition,
  ScopeState,
} from '../types'
import { ScopeActivationStrategy } from '../types'

export class ScopeResolver {
  private scopeDefinitions = new Map<string, ScopeDefinition>()

  registerScope(definition: ScopeDefinition): void {
    this.scopeDefinitions.set(definition.id, definition)
  }

  unregisterScope(scopeId: string): void {
    this.scopeDefinitions.delete(scopeId)
  }

  /**
   * Resolves active hotkeys based on current scope hierarchy and inheritance rules
   */
  resolveActiveHotkeys(
    activeScopes: ScopeDefinition[],
    scopeStates: Map<string, ScopeState>,
    focusContext?: FocusContext,
  ): Map<string, ResolvedHotkey> {
    const resolvedHotkeys = new Map<string, ResolvedHotkey>()

    // Sort scopes by priority (lowest to highest for proper override behavior)
    const orderedScopes = this.getScopesInResolutionOrder(activeScopes)

    for (const scope of orderedScopes) {
      const scopeState = scopeStates.get(scope.id)
      if (!scopeState?.active) continue

      const scopeHotkeys = scopeState.hotkeys
      if (scopeHotkeys.size === 0) continue

      // Simplified strategy support: UNION and ADDITIVE only
      if (scope.strategy === ScopeActivationStrategy.ADDITIVE) {
        this.mergeAdditive(resolvedHotkeys, scopeHotkeys, scope)
      } else {
        this.mergeUnion(resolvedHotkeys, scopeHotkeys, scope)
      }
    }

    // Conditional filtering only (inheritance removed for simplicity)
    this.applyConditionalFiltering(resolvedHotkeys, focusContext)

    return resolvedHotkeys
  }

  private getScopesInResolutionOrder(
    scopes: ScopeDefinition[],
  ): ScopeDefinition[] {
    // Create dependency graph
    const graph = new Map<string, string[]>()
    const visited = new Set<string>()
    const result: ScopeDefinition[] = []

    // Build dependency graph
    scopes.forEach((scope) => {
      graph.set(scope.id, scope.parentId ? [scope.parentId] : [])
    })

    // Topological sort with priority consideration
    const visit = (scopeId: string) => {
      if (visited.has(scopeId)) return
      visited.add(scopeId)

      const dependencies = graph.get(scopeId) || []
      dependencies.forEach((depId) => {
        if (graph.has(depId)) {
          visit(depId)
        }
      })

      const scope = scopes.find((s) => s.id === scopeId)
      if (scope) {
        result.push(scope)
      }
    }

    // Visit all scopes in dependency order
    scopes.forEach((scope) => visit(scope.id))

    // Final sort by priority for scopes at the same dependency level
    return result.sort((a, b) => a.priority - b.priority)
  }

  private mergeUnion(
    resolved: Map<string, ResolvedHotkey>,
    incoming: Map<string, HotkeyBinding>,
    scope: ScopeDefinition,
  ): void {
    // Union: Combine all hotkeys, higher priority wins for conflicts
    incoming.forEach((binding, combo) => {
      const existing = resolved.get(combo)
      const priority = binding.priority || 0

      if (!existing || priority > (existing.priority || 0)) {
        resolved.set(combo, this.createResolvedHotkey(binding, scope, 'union'))
      }
    })
  }

  private mergeAdditive(
    resolved: Map<string, ResolvedHotkey>,
    incoming: Map<string, HotkeyBinding>,
    scope: ScopeDefinition,
  ): void {
    // Additive: Only add new hotkeys, don't replace existing ones
    incoming.forEach((binding, combo) => {
      if (!resolved.has(combo)) {
        resolved.set(
          combo,
          this.createResolvedHotkey(binding, scope, 'additive'),
        )
      }
    })
  }

  // Removed: mergeOverride, mergeIntersection, and inheritance handling

  private applyConditionalFiltering(
    resolved: Map<string, ResolvedHotkey>,
    focusContext?: FocusContext,
  ): void {
    // Filter out hotkeys based on current context conditions
    const toRemove: string[] = []

    resolved.forEach((hotkey, combo) => {
      // Check if hotkey should be disabled based on current context
      if (this.shouldDisableHotkey(hotkey, focusContext)) {
        toRemove.push(combo)
      }
    })

    toRemove.forEach((combo) => resolved.delete(combo))
  }

  private shouldDisableHotkey(
    hotkey: ResolvedHotkey,
    focusContext?: FocusContext,
  ): boolean {
    // Disable if explicitly disabled
    if (hotkey.disabled) return true

    // Check focus context requirements
    if (focusContext) {
      const scope = this.scopeDefinitions.get(hotkey.scopeId)
      if (
        scope?.conditionalActivation &&
        !scope.conditionalActivation(focusContext)
      ) {
        return true
      }

      // Disable input-conflicting hotkeys when focused on form elements
      if (
        this.isFormElementFocused(focusContext) &&
        this.isInputConflict(hotkey.combo)
      ) {
        return true
      }
    }

    return false
  }

  private isFormElementFocused(context: FocusContext): boolean {
    const { element } = context
    return (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement ||
      element.contentEditable === 'true' ||
      element.role === 'textbox'
    )
  }

  private isInputConflict(combo: string): boolean {
    // Check if hotkey combo conflicts with normal text input
    const inputConflicts = [
      // Letter keys without modifiers
      /^[a-z]$/i,
      // Number keys without modifiers
      /^\d$/,
      // Space without modifiers
      /^Space$/,
      // Common editing keys
      /^(Backspace|Delete|Enter|Tab)$/,
    ]

    return inputConflicts.some((pattern) => pattern.test(combo))
  }

  private createResolvedHotkey(
    binding: HotkeyBinding,
    scope: ScopeDefinition,
    resolutionReason: ResolvedHotkey['resolutionReason'],
  ): ResolvedHotkey {
    return {
      id: `resolved_${scope.id}_${binding.combo}_${Date.now()}`,
      combo: binding.combo,
      handler: binding.handler,
      description: binding.description,
      category: binding.category,
      disabled: binding.disabled,
      preventDefault: binding.preventDefault,
      stopPropagation: binding.stopPropagation,
      priority: binding.priority || scope.priority,
      scopeId: scope.id,
      resolutionReason,
      originalBinding: binding,
    }
  }

  // Utility methods for debugging and introspection
  getScopeHierarchy(scopeId: string): string[] {
    const hierarchy: string[] = []
    let currentId: string | undefined = scopeId

    while (currentId) {
      hierarchy.unshift(currentId)
      const scope = this.scopeDefinitions.get(currentId)
      currentId = scope?.parentId
    }

    return hierarchy
  }

  getConflictingHotkeys(
    resolved: Map<string, ResolvedHotkey>,
  ): Map<string, ResolvedHotkey[]> {
    const conflicts = new Map<string, ResolvedHotkey[]>()
    const comboMap = new Map<string, ResolvedHotkey[]>()

    // Group by combo
    resolved.forEach((hotkey) => {
      const { combo } = hotkey
      if (!comboMap.has(combo)) {
        comboMap.set(combo, [])
      }
      comboMap.get(combo)!.push(hotkey)
    })

    // Find conflicts (same combo, different scopes)
    comboMap.forEach((hotkeys, combo) => {
      if (hotkeys.length > 1) {
        const uniqueScopes = new Set(hotkeys.map((h) => h.scopeId))
        if (uniqueScopes.size > 1) {
          conflicts.set(combo, hotkeys)
        }
      }
    })

    return conflicts
  }

  validateScopeHierarchy(): string[] {
    const errors: string[] = []

    this.scopeDefinitions.forEach((scope) => {
      // Check for circular dependencies
      const visited = new Set<string>()
      let current: string | undefined = scope.id

      while (current) {
        if (visited.has(current)) {
          errors.push(
            `Circular dependency detected in scope hierarchy: ${Array.from(visited).join(' -> ')} -> ${current}`,
          )
          break
        }

        visited.add(current)
        const currentScope = this.scopeDefinitions.get(current)
        current = currentScope?.parentId
      }

      // Check for invalid parent references
      if (scope.parentId && !this.scopeDefinitions.has(scope.parentId)) {
        errors.push(
          `Scope "${scope.id}" references non-existent parent "${scope.parentId}"`,
        )
      }

      // Check for invalid inheritance rules
      scope.hotkeyInheritance.forEach((rule) => {
        if (!this.scopeDefinitions.has(rule.fromScope)) {
          errors.push(
            `Scope "${scope.id}" has inheritance rule from non-existent scope "${rule.fromScope}"`,
          )
        }
      })
    })

    return errors
  }
}
