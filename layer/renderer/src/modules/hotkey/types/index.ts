// Core hotkey management types
export type HotkeyCombo = string // e.g., "Ctrl+s", "$mod+Shift+d", "Escape"

// Hotkey action with metadata
export interface HotkeyAction {
  category?: string
  combo: HotkeyCombo
  description?: string
  disabled?: boolean
  handler: (
    event: KeyboardEvent,
    context?: FocusContext,
  ) => void | Promise<void>
  id: string
  preventDefault?: boolean
  priority?: number
  stopPropagation?: boolean
}

// Hotkey binding for registration
export interface HotkeyBinding extends Omit<HotkeyAction, 'id'> {
  scopeId: string
}

// Resolved hotkey after scope processing
export interface ResolvedHotkey extends HotkeyAction {
  originalBinding: HotkeyBinding
  resolutionReason: 'override' | 'union' | 'additive' | 'intersection'
  scopeId: string
}

// Focus context information
export interface FocusContext {
  element: HTMLElement
  priority: number
  scopeId: string
  scopePath: HotkeyScope[]
}

// Scope activation strategy
export enum ScopeActivationStrategy {
  ADDITIVE = 'additive', // Child scope adds to parent, no override
  INTERSECTION = 'intersection', // Only common hotkeys are activated
  OVERRIDE = 'override', // Child scope overrides parent scope
  UNION = 'union', // All parent scope hotkeys are activated
}

// Centralized scope identifiers for common scopes used across the module
export enum HotkeyScope {
  APP = 'app',
  GLOBAL = 'global',
  MODAL = 'modal',
  TABLE = 'table',
}

// Hotkey inheritance rule
export interface HotkeyInheritanceRule {
  combos: string[] | '*'
  fromScope: string
  mode: 'inherit' | 'block' | 'override'
}

// Scope definition
export interface ScopeDefinition {
  autoActivate?: boolean
  conditionalActivation?: (context: FocusContext) => boolean
  focusSelector?: string
  hotkeyInheritance: HotkeyInheritanceRule[]
  id: string
  metadata?: Record<string, any>
  parentId?: string
  priority: number
  strategy: ScopeActivationStrategy
}

// Scope state
export interface ScopeState {
  active: boolean
  context?: FocusContext
  element?: HTMLElement
  hotkeys: Map<HotkeyCombo, HotkeyBinding>
  id: string
  lastActivated?: number
}

// Scope change information
export interface ScopeChange {
  activated: string[]
  context: FocusContext | null
  deactivated: string[]
  unchanged: string[]
}

// Hotkey registration options
export interface HotkeyRegistrationOptions {
  category?: string
  description?: string
  disabled?: boolean
  preventDefault?: boolean
  priority?: number
  scope?: string
  stopPropagation?: boolean
  waitFor?: () => boolean
}

// Focus scope options for React hook
export interface FocusScopeOptions {
  autoActivate?: boolean
  conditionalActivation?: () => boolean
  focusSelector?: string
  inheritFrom?: string[]
  metadata?: Record<string, any>
  parentScope?: string
  priority?: number
  strategy?: ScopeActivationStrategy
}

// Batch mode configuration
// Removed: BatchModeConfig (batch mode is not supported)

// Performance monitoring
export interface PerformanceMetrics {
  cpuUsage: number
  fps: number
  hotkeyLatency: number
  memoryUsage: number
}

// Hotkey manager configuration
export interface HotkeyConfig {
  debounceDelay: number
  debugMode: boolean
  enabled: boolean
  enablePrediction: boolean
  maxScopeDepth: number
  preventDefault: boolean
  stopPropagation: boolean
}

// Debug information
export interface HotkeyDebugInfo {
  activeScopes: string[]
  focusContext: FocusContext | null
  performanceMetrics: PerformanceMetrics
  registeredHotkeys: Map<string, ResolvedHotkey>
  scopeHierarchy: ScopeDefinition[]
}

// Events
export interface HotkeyEvent {
  payload: any
  timestamp: number
  type:
    | 'scope-activated'
    | 'scope-deactivated'
    | 'hotkey-triggered'
    | 'focus-changed'
}

// Manager interface
export interface HotkeyManagerInterface {
  activateScope: (scopeId: string, context?: FocusContext) => void
  deactivateScope: (scopeId: string) => void
  getActiveHotkeys: () => Map<string, ResolvedHotkey>
  getDebugInfo: () => HotkeyDebugInfo
  register: (binding: HotkeyBinding) => string
  unregister: (id: string) => boolean
  updateScopeCondition: (scopeId: string, condition: () => boolean) => void
  updateScopeState: (scopeId: string, state: Partial<ScopeState>) => void
  // Batch mode removed
}
