// Core hotkey management types
export type HotkeyCombo = string // e.g., "Ctrl+s", "$mod+Shift+d", "Escape"

// Hotkey action with metadata
export interface HotkeyAction {
  id: string
  combo: HotkeyCombo
  handler: (
    event: KeyboardEvent,
    context?: FocusContext,
  ) => void | Promise<void>
  description?: string
  category?: string
  disabled?: boolean
  preventDefault?: boolean
  stopPropagation?: boolean
  priority?: number
}

// Hotkey binding for registration
export interface HotkeyBinding extends Omit<HotkeyAction, 'id'> {
  scopeId: string
}

// Resolved hotkey after scope processing
export interface ResolvedHotkey extends HotkeyAction {
  scopeId: string
  resolutionReason: 'override' | 'union' | 'additive' | 'intersection'
  originalBinding: HotkeyBinding
}

// Focus context information
export interface FocusContext {
  element: HTMLElement
  scopeId: string
  scopePath: HotkeyScope[]
  priority: number
}

// Scope activation strategy
export enum ScopeActivationStrategy {
  UNION = 'union', // All parent scope hotkeys are activated
  INTERSECTION = 'intersection', // Only common hotkeys are activated
  OVERRIDE = 'override', // Child scope overrides parent scope
  ADDITIVE = 'additive', // Child scope adds to parent, no override
}

// Centralized scope identifiers for common scopes used across the module
export enum HotkeyScope {
  GLOBAL = 'global',
  APP = 'app',
  MODAL = 'modal',
  TABLE = 'table',
}

// Hotkey inheritance rule
export interface HotkeyInheritanceRule {
  fromScope: string
  combos: string[] | '*'
  mode: 'inherit' | 'block' | 'override'
}

// Scope definition
export interface ScopeDefinition {
  id: string
  parentId?: string
  priority: number
  strategy: ScopeActivationStrategy
  hotkeyInheritance: HotkeyInheritanceRule[]
  conditionalActivation?: (context: FocusContext) => boolean
  autoActivate?: boolean
  focusSelector?: string
  metadata?: Record<string, any>
}

// Scope state
export interface ScopeState {
  id: string
  active: boolean
  element?: HTMLElement
  context?: FocusContext
  hotkeys: Map<HotkeyCombo, HotkeyBinding>
  lastActivated?: number
}

// Scope change information
export interface ScopeChange {
  activated: string[]
  deactivated: string[]
  unchanged: string[]
  context: FocusContext | null
}

// Hotkey registration options
export interface HotkeyRegistrationOptions {
  scope?: string
  description?: string
  category?: string
  disabled?: boolean
  preventDefault?: boolean
  stopPropagation?: boolean
  priority?: number
  waitFor?: () => boolean
}

// Focus scope options for React hook
export interface FocusScopeOptions {
  priority?: number
  parentScope?: string
  strategy?: ScopeActivationStrategy
  autoActivate?: boolean
  focusSelector?: string
  inheritFrom?: string[]
  metadata?: Record<string, any>
  conditionalActivation?: () => boolean
}

// Batch mode configuration
// Removed: BatchModeConfig (batch mode is not supported)

// Performance monitoring
export interface PerformanceMetrics {
  fps: number
  cpuUsage: number
  memoryUsage: number
  hotkeyLatency: number
}

// Hotkey manager configuration
export interface HotkeyConfig {
  enabled: boolean
  debugMode: boolean
  preventDefault: boolean
  stopPropagation: boolean
  maxScopeDepth: number
  debounceDelay: number
  enablePrediction: boolean
}

// Debug information
export interface HotkeyDebugInfo {
  activeScopes: string[]
  registeredHotkeys: Map<string, ResolvedHotkey>
  focusContext: FocusContext | null
  performanceMetrics: PerformanceMetrics
  scopeHierarchy: ScopeDefinition[]
}

// Events
export interface HotkeyEvent {
  type:
    | 'scope-activated'
    | 'scope-deactivated'
    | 'hotkey-triggered'
    | 'focus-changed'
  payload: any
  timestamp: number
}

// Manager interface
export interface HotkeyManagerInterface {
  register: (binding: HotkeyBinding) => string
  unregister: (id: string) => boolean
  activateScope: (scopeId: string, context?: FocusContext) => void
  deactivateScope: (scopeId: string) => void
  updateScopeState: (scopeId: string, state: Partial<ScopeState>) => void
  updateScopeCondition: (scopeId: string, condition: () => boolean) => void
  getActiveHotkeys: () => Map<string, ResolvedHotkey>
  getDebugInfo: () => HotkeyDebugInfo
  // Batch mode removed
}
